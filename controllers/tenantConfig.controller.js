const { tenantConfigModel, tenantSecretModel } = require("../models/index");
const forge = require("node-forge");
const { deepMerge } = require("../helpers/deepMerge");
const { applyPreset } = require("../helpers/applyPreset");
const { getOrCreateTenantConfig } = require("../helpers/getTenantConfig");
const { validateTenantConfig } = require("../helpers/tenantConfig.validators");
const { isMaintenanceModeEnabled } = require("../helpers/maintenance");
const { encryptSecret, decryptSecret } = require("../helpers/secretCipher");
const { PRESETS, PRESET_MAP } = require("../presets");

const sendValidationError = (res, details, message = "Configuracion invalida") =>
  res.status(400).json({
    ok: false,
    code: "VALIDATION_ERROR",
    message,
    details
  });

const SECRET_INTEGRATION_FIELDS = ["secretKey", "apiKey", "apiSecret", "token", "password", "pin"];
const MASKED_VALUE = "********";

const sanitizeIntegration = (integration = {}) => {
  const sanitized = { ...integration };
  SECRET_INTEGRATION_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(sanitized, field)) {
      const hasValue = Boolean(sanitized[field]);
      sanitized[`has${field.charAt(0).toUpperCase()}${field.slice(1)}`] = hasValue;
      sanitized[field] = hasValue ? MASKED_VALUE : "";
    }
  });
  return sanitized;
};

const sanitizeTenantConfigResponse = (configDoc) => {
  const config =
    typeof configDoc?.toObject === "function" ? configDoc.toObject() : { ...(configDoc || {}) };
  const integrations = config.integrations || {};
  config.integrations = {
    ...integrations,
    payments: sanitizeIntegration(integrations.payments || {}),
    sri: sanitizeIntegration(integrations.sri || {}),
    whatsapp: sanitizeIntegration(integrations.whatsapp || {}),
    email: sanitizeIntegration(integrations.email || {}),
    maps: sanitizeIntegration(integrations.maps || {})
  };

  if (config.integrations?.sri?.signature) {
    const signature = config.integrations.sri.signature;
    const hasCertificate = Boolean(signature.hasCertificate);
    const pinSet = Boolean(signature.pinSet);
    config.integrations.sri.signature = {
      ...signature,
      pinSet,
      hasCertificate,
      signatureLoaded: hasCertificate,
      signatureReady: hasCertificate && pinSet
    };
  }

  return config;
};

const stripSensitiveIntegrationPatch = (payload = {}) => {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  const integrations = clone.integrations;
  if (!integrations || typeof integrations !== "object") return clone;

  ["payments", "sri", "whatsapp", "email", "maps"].forEach((key) => {
    const cfg = integrations[key];
    if (!cfg || typeof cfg !== "object") return;
    SECRET_INTEGRATION_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(cfg, field)) {
        delete cfg[field];
      }
    });
  });

  if (integrations?.sri?.signature && typeof integrations.sri.signature === "object") {
    delete integrations.sri.signature.pin;
    delete integrations.sri.signature.certificate;
    delete integrations.sri.signature.privateKey;
  }

  return clone;
};

const upsertTenantSecret = async (tenantId, key, plainText, metadata = {}) => {
  const encryptedPayload = encryptSecret(plainText);
  await tenantSecretModel.updateOne(
    { tenantId, key },
    {
      $set: {
        ...encryptedPayload,
        metadata: metadata || {}
      }
    },
    { upsert: true }
  );
};

const getTenantSecretPlain = async (tenantId, key) => {
  const secret = await tenantSecretModel.findOne({ tenantId, key }).lean();
  if (!secret) return null;
  return decryptSecret(secret);
};

const getSriSecretState = async (tenantId) => {
  const [cert, pin] = await Promise.all([
    tenantSecretModel.findOne({ tenantId, key: "sri.signature.certificate" }).lean(),
    tenantSecretModel.findOne({ tenantId, key: "sri.signature.pin" }).lean()
  ]);
  return {
    hasCertificate: Boolean(cert),
    pinSet: Boolean(pin)
  };
};

const extractCertificateMetadata = (certificateBuffer, pin) => {
  if (!certificateBuffer || certificateBuffer.length === 0) {
    const error = new Error("Archivo de certificado vacio");
    error.code = "CERT_EMPTY";
    throw error;
  }
  if (!String(pin || "").trim()) {
    const error = new Error("PIN requerido");
    error.code = "PIN_REQUIRED";
    throw error;
  }

  let p12;
  try {
    const binaryDer = certificateBuffer.toString("binary");
    const asn1 = forge.asn1.fromDer(binaryDer);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, String(pin));
  } catch (err) {
    const error = new Error("PIN incorrecto o certificado invalido");
    error.code = "CERT_PIN_INVALID";
    throw error;
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })?.[forge.pki.oids.certBag] || [];
  if (certBags.length === 0 || !certBags[0].cert) {
    const error = new Error("No se encontro certificado X.509 en el archivo");
    error.code = "CERT_NOT_FOUND";
    throw error;
  }

  const privateKeyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })?.[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] || [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })?.[forge.pki.oids.keyBag] || [];
  if (privateKeyBags.length === 0 && keyBags.length === 0) {
    const error = new Error("El certificado no contiene llave privada");
    error.code = "PRIVATE_KEY_MISSING";
    throw error;
  }

  const cert = certBags[0].cert;
  const now = new Date();
  const validFrom = cert.validity.notBefore;
  const validTo = cert.validity.notAfter;
  if (now < validFrom) {
    const error = new Error("El certificado aun no es valido");
    error.code = "CERT_NOT_YET_VALID";
    throw error;
  }
  if (now > validTo) {
    const error = new Error("El certificado esta expirado");
    error.code = "CERT_EXPIRED";
    throw error;
  }

  return {
    serialNumber: String(cert.serialNumber || "").toUpperCase(),
    validFrom: validFrom.toISOString().slice(0, 10),
    validTo: validTo.toISOString().slice(0, 10),
    subject: (cert.subject?.attributes || [])
      .map((item) => `${item.shortName || item.name}=${item.value}`)
      .join(", "),
  };
};

const getTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);
    const sanitized = sanitizeTenantConfigResponse(config);
    const secretState = await getSriSecretState(tenantId);
    if (!sanitized.integrations) sanitized.integrations = {};
    if (!sanitized.integrations.sri) sanitized.integrations.sri = {};
    if (!sanitized.integrations.sri.signature) sanitized.integrations.sri.signature = {};
    sanitized.integrations.sri.signature.hasCertificate = secretState.hasCertificate;
    sanitized.integrations.sri.signature.pinSet = secretState.pinSet;
    sanitized.integrations.sri.signature.signatureLoaded = secretState.hasCertificate;
    sanitized.integrations.sri.signature.signatureReady =
      secretState.hasCertificate && secretState.pinSet;
    return res.json({ ok: true, data: sanitized, message: "OK" });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const patchTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);

    const safePayload = stripSensitiveIntegrationPatch(req.body || {});
    const merged = deepMerge(config.toObject(), safePayload);
    const validation = validateTenantConfig(merged);
    if (!validation.valid) {
      return sendValidationError(res, validation.details);
    }

    config.set(validation.sanitized);
    await config.save();
    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const listPresets = async (req, res) => {
  const data = PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    description: preset.description,
    defaultsSummary: preset.defaultsSummary
  }));
  return res.json({ ok: true, data, message: "OK" });
};

const applyTenantPreset = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const { presetKey, mode = "merge" } = req.body || {};

    if (!presetKey || !PRESET_MAP[presetKey]) {
      return sendValidationError(res, [{ path: "presetKey", message: "Preset no encontrado" }]);
    }
    if (!["merge", "replace"].includes(mode)) {
      return sendValidationError(res, [{ path: "mode", message: "Mode debe ser merge o replace" }]);
    }

    const config = await getOrCreateTenantConfig(tenantId);
    const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
    const updatedObject = applyPreset(config, PRESET_MAP[presetKey], mode, defaults);
    const validation = validateTenantConfig(updatedObject);
    if (!validation.valid) {
      return sendValidationError(res, validation.details);
    }

    config.set(validation.sanitized);
    await config.save();
    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const patchMaintenance = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);

    const allowed = [
      "storeMaintenanceMode",
      "maintenanceMessage",
      "disableStorefront",
      "disablePOS",
      "allowAdminAccess",
      "equipmentTracking",
      "allowPrefixes",
      "allowExact"
    ];
    const maintenancePatch = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        maintenancePatch[key] = req.body[key];
      }
    });

    const merged = deepMerge(config.toObject(), { maintenance: maintenancePatch });
    const validation = validateTenantConfig(merged);
    if (!validation.valid) {
      return sendValidationError(res, validation.details);
    }

    config.set(validation.sanitized);
    await config.save();
    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const uploadSriSignature = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Archivo de certificado requerido"
      });
    }

    const config = await getOrCreateTenantConfig(tenantId);
    const certificateBase64 = file.buffer.toString("base64");
    await upsertTenantSecret(tenantId, "sri.signature.certificate", certificateBase64, {
      fileName: file.originalname || "",
      mimeType: file.mimetype || ""
    });

    const now = new Date();
    config.set({
      integrations: {
        ...config.integrations?.toObject?.(),
        ...config.integrations,
        sri: {
          ...config.integrations?.sri?.toObject?.(),
          ...config.integrations?.sri,
          signature: {
            ...config.integrations?.sri?.signature?.toObject?.(),
            ...config.integrations?.sri?.signature,
            provider: req.body?.provider || config.integrations?.sri?.signature?.provider || "vault",
            hasCertificate: true,
            certificateAlias: req.body?.certificateAlias || "",
            serialNumber: req.body?.serialNumber || "",
            validFrom: req.body?.validFrom || "",
            validTo: req.body?.validTo || "",
            vaultKeyRef: req.body?.vaultKeyRef || "",
            lastRotatedAt: now
          }
        }
      }
    });
    await config.save();

    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "Certificado cargado"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const validateAndSaveSriSignature = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const file = req.file;
    const pin = String(req.body?.pin || "").trim();

    if (!file || !file.buffer) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Archivo de certificado requerido"
      });
    }

    let metadata;
    try {
      metadata = extractCertificateMetadata(file.buffer, pin);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        code: error.code || "SIGNATURE_VALIDATION_ERROR",
        message: error.message
      });
    }

    const certificateBase64 = file.buffer.toString("base64");
    await Promise.all([
      upsertTenantSecret(tenantId, "sri.signature.certificate", certificateBase64, {
        fileName: file.originalname || "",
        mimeType: file.mimetype || ""
      }),
      upsertTenantSecret(tenantId, "sri.signature.pin", pin)
    ]);

    const config = await getOrCreateTenantConfig(tenantId);
    const now = new Date();
    config.set({
      integrations: {
        ...config.integrations?.toObject?.(),
        ...config.integrations,
        sri: {
          ...config.integrations?.sri?.toObject?.(),
          ...config.integrations?.sri,
          signature: {
            ...config.integrations?.sri?.signature?.toObject?.(),
            ...config.integrations?.sri?.signature,
            provider: req.body?.provider || config.integrations?.sri?.signature?.provider || "vault",
            hasCertificate: true,
            pinSet: true,
            certificateAlias: req.body?.certificateAlias || "",
            serialNumber: metadata.serialNumber,
            validFrom: metadata.validFrom,
            validTo: metadata.validTo,
            vaultKeyRef: req.body?.vaultKeyRef || "",
            lastRotatedAt: now,
            lastTestAt: now,
            lastTestStatus: "ok"
          }
        }
      }
    });
    await config.save();

    return res.json({
      ok: true,
      data: {
        signature: {
          serialNumber: metadata.serialNumber,
          validFrom: metadata.validFrom,
          validTo: metadata.validTo,
          subject: metadata.subject
        },
        config: sanitizeTenantConfigResponse(config)
      },
      message: "Certificado y PIN validos, guardados correctamente"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const setSriSignaturePin = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const pin = String(req.body?.pin || "").trim();
    if (!pin) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "PIN requerido"
      });
    }

    await upsertTenantSecret(tenantId, "sri.signature.pin", pin);

    const config = await getOrCreateTenantConfig(tenantId);
    config.set({
      integrations: {
        ...config.integrations?.toObject?.(),
        ...config.integrations,
        sri: {
          ...config.integrations?.sri?.toObject?.(),
          ...config.integrations?.sri,
          signature: {
            ...config.integrations?.sri?.signature?.toObject?.(),
            ...config.integrations?.sri?.signature,
            pinSet: true,
            lastRotatedAt: new Date()
          }
        }
      }
    });
    const secretState = await getSriSecretState(tenantId);
    config.set("integrations.sri.signature.hasCertificate", secretState.hasCertificate);
    config.set("integrations.sri.signature.pinSet", secretState.pinSet);
    await config.save();

    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "PIN actualizado"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const testSriSignature = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const [certBase64, pin] = await Promise.all([
      getTenantSecretPlain(tenantId, "sri.signature.certificate"),
      getTenantSecretPlain(tenantId, "sri.signature.pin")
    ]);

    if (!certBase64 || !pin) {
      const config = await getOrCreateTenantConfig(tenantId);
      config.set({
        integrations: {
          ...config.integrations?.toObject?.(),
          ...config.integrations,
          sri: {
            ...config.integrations?.sri?.toObject?.(),
            ...config.integrations?.sri,
            signature: {
              ...config.integrations?.sri?.signature?.toObject?.(),
              ...config.integrations?.sri?.signature,
              lastTestAt: new Date(),
              lastTestStatus: "missing_secrets"
            }
          }
        }
      });
      const secretState = await getSriSecretState(tenantId);
      config.set("integrations.sri.signature.hasCertificate", secretState.hasCertificate);
      config.set("integrations.sri.signature.pinSet", secretState.pinSet);
      await config.save();
      return res.status(400).json({
        ok: false,
        code: "MISSING_SIGNATURE_SECRETS",
        message: "Faltan certificado o PIN"
      });
    }

    let metadata;
    try {
      metadata = extractCertificateMetadata(Buffer.from(certBase64, "base64"), pin);
    } catch (error) {
      const config = await getOrCreateTenantConfig(tenantId);
      config.set({
        integrations: {
          ...config.integrations?.toObject?.(),
          ...config.integrations,
          sri: {
            ...config.integrations?.sri?.toObject?.(),
            ...config.integrations?.sri,
            signature: {
              ...config.integrations?.sri?.signature?.toObject?.(),
              ...config.integrations?.sri?.signature,
              lastTestAt: new Date(),
              lastTestStatus: error.code || "invalid_signature"
            }
          }
        }
      });
      const secretState = await getSriSecretState(tenantId);
      config.set("integrations.sri.signature.hasCertificate", secretState.hasCertificate);
      config.set("integrations.sri.signature.pinSet", secretState.pinSet);
      await config.save();
      return res.status(400).json({
        ok: false,
        code: error.code || "SIGNATURE_VALIDATION_ERROR",
        message: error.message
      });
    }

    const config = await getOrCreateTenantConfig(tenantId);
    config.set({
      integrations: {
        ...config.integrations?.toObject?.(),
        ...config.integrations,
        sri: {
          ...config.integrations?.sri?.toObject?.(),
          ...config.integrations?.sri,
          signature: {
            ...config.integrations?.sri?.signature?.toObject?.(),
            ...config.integrations?.sri?.signature,
            lastTestAt: new Date(),
            lastTestStatus: "ok",
            serialNumber: metadata.serialNumber,
            validFrom: metadata.validFrom,
            validTo: metadata.validTo
          }
        }
      }
    });
    const secretState = await getSriSecretState(tenantId);
    config.set("integrations.sri.signature.hasCertificate", secretState.hasCertificate);
    config.set("integrations.sri.signature.pinSet", secretState.pinSet);
    await config.save();

    return res.status(200).json({
      ok: true,
      data: {
        hasCertificate: true,
        pinSet: true,
        status: "ok",
        serialNumber: metadata.serialNumber,
        validFrom: metadata.validFrom,
        validTo: metadata.validTo,
        subject: metadata.subject
      },
      message: "Firma valida"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const deleteSriSignature = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    await tenantSecretModel.deleteMany({
      tenantId,
      key: { $in: ["sri.signature.certificate", "sri.signature.pin"] }
    });

    const config = await getOrCreateTenantConfig(tenantId);
    config.set({
      integrations: {
        ...config.integrations?.toObject?.(),
        ...config.integrations,
        sri: {
          ...config.integrations?.sri?.toObject?.(),
          ...config.integrations?.sri,
          signature: {
            ...config.integrations?.sri?.signature?.toObject?.(),
            ...config.integrations?.sri?.signature,
            hasCertificate: false,
            pinSet: false,
            certificateAlias: "",
            serialNumber: "",
            validFrom: "",
            validTo: "",
            vaultKeyRef: ""
          }
        }
      }
    });
    await config.save();

    return res.json({
      ok: true,
      data: sanitizeTenantConfigResponse(config),
      message: "Firma eliminada"
    });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const patchFooter = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);

    const allowed = [
      "enabled",
      "aboutText",
      "showContact",
      "showSchedule",
      "showSocial",
      "showQuickLinks",
      "showLegalLinks",
      "contactSource",
      "contact",
      "social",
      "quickLinks",
      "legalLinks",
      "copyrightText"
    ];
    const footerPatch = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        footerPatch[key] = req.body[key];
      }
    });

    const merged = deepMerge(config.toObject(), { footer: footerPatch });
    const validation = validateTenantConfig(merged);
    if (!validation.valid) {
      return sendValidationError(res, validation.details);
    }

    config.set(validation.sanitized);
    await config.save();
    return res.json({ ok: true, data: config.footer, message: "OK" });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const getSystemStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);
    const maintenanceMode = isMaintenanceModeEnabled(config);
    const data = {
      maintenanceMode,
      storefrontAvailable:
        !maintenanceMode || (maintenanceMode && !config?.maintenance?.disableStorefront),
      posAvailable: !maintenanceMode || (maintenanceMode && !config?.maintenance?.disablePOS)
    };
    return res.json({ ok: true, data, message: "OK" });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

module.exports = {
  getTenantConfig,
  patchTenantConfig,
  listPresets,
  applyTenantPreset,
  patchMaintenance,
  patchFooter,
  getSystemStatus,
  uploadSriSignature,
  validateAndSaveSriSignature,
  setSriSignaturePin,
  testSriSignature,
  deleteSriSignature
};
