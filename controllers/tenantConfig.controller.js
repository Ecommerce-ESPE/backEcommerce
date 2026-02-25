const { tenantConfigModel } = require("../models/index");
const { deepMerge } = require("../helpers/deepMerge");
const { applyPreset } = require("../helpers/applyPreset");
const { getOrCreateTenantConfig } = require("../helpers/getTenantConfig");
const { validateTenantConfig } = require("../helpers/tenantConfig.validators");
const { isMaintenanceModeEnabled } = require("../helpers/maintenance");
const { PRESETS, PRESET_MAP } = require("../presets");

const sendValidationError = (res, details, message = "Configuracion invalida") =>
  res.status(400).json({
    ok: false,
    code: "VALIDATION_ERROR",
    message,
    details
  });

const getTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);
    return res.json({ ok: true, data: config, message: "OK" });
  } catch (error) {
    return res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message });
  }
};

const patchTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = await getOrCreateTenantConfig(tenantId);

    const merged = deepMerge(config.toObject(), req.body || {});
    const validation = validateTenantConfig(merged);
    if (!validation.valid) {
      return sendValidationError(res, validation.details);
    }

    config.set(validation.sanitized);
    await config.save();
    return res.json({ ok: true, data: config, message: "OK" });
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
    return res.json({ ok: true, data: config, message: "OK" });
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
      "equipmentTracking"
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
    return res.json({ ok: true, data: config, message: "OK" });
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
  getSystemStatus
};
