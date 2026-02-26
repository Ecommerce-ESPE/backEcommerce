const { tenantConfigModel } = require("../../models/index");

const deepMerge = (target, source) => {
  const result = { ...target };
  Object.entries(source || {}).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = deepMerge(target?.[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
};

const getTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    let config = await tenantConfigModel.findOne({ tenantId });
    if (!config) {
      const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
      config = await tenantConfigModel.create(defaults);
    }
    return res.json({ ok: true, data: config, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo configuración"
    });
  }
};

const updateTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    let config = await tenantConfigModel.findOne({ tenantId });
    if (!config) {
      const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
      config = await tenantConfigModel.create(defaults);
    }

    const patch = req.body || {};
    const merged = deepMerge(config.toObject(), patch);
    config.set(merged);
    await config.save();

    return res.json({
      ok: true,
      data: config,
      message: "Configuración actualizada"
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: error.message || "Error actualizando configuración"
    });
  }
};

const resetTenantConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    await tenantConfigModel.deleteOne({ tenantId });
    const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
    const config = await tenantConfigModel.create(defaults);
    return res.json({
      ok: true,
      data: config,
      message: "Configuración reiniciada"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error reiniciando configuración"
    });
  }
};

const getPublicBranding = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const config = await tenantConfigModel.findOne({ tenantId }).lean();
    if (!config) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Tenant no encontrado"
      });
    }
    const businessName = config?.business?.name || "";
    return res.json({
      ok: true,
      data: {
        ...(config.branding || {}),
        businessName,
        storeName: businessName
      },
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo branding"
    });
  }
};

const getPublicModules = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const config = await tenantConfigModel.findOne({ tenantId }).lean();
    if (!config) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Tenant no encontrado"
      });
    }
    return res.json({
      ok: true,
      data: config.modules || {},
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo módulos"
    });
  }
};

const getPublicStoreSettings = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const config = await tenantConfigModel.findOne({ tenantId }).lean();
    if (!config) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Tenant no encontrado"
      });
    }

    return res.json({
      ok: true,
      data: {
        business: {
          name: config?.business?.name || "",
          currency: config?.business?.currency || "USD",
          locale: config?.business?.locale || "es-EC",
          timezone: config?.business?.timezone || "America/Guayaquil"
        },
        branding: config.branding || {},
        tax: {
          strategy: config?.tax?.strategy || "ecuador_iva",
          priceIncludesTax: Boolean(config?.tax?.priceIncludesTax),
          iva: {
            enabled: (config?.tax?.strategy || "ecuador_iva") === "ecuador_iva",
            defaultRate: Number(config?.tax?.iva?.defaultRate || 0)
          }
        }
      },
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo configuracion publica"
    });
  }
};

module.exports = {
  getTenantConfig,
  updateTenantConfig,
  resetTenantConfig,
  getPublicBranding,
  getPublicModules,
  getPublicStoreSettings
};
