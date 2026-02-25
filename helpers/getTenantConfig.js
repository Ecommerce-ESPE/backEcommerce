const { tenantConfigModel } = require("../models/index");

const getOrCreateTenantConfig = async (tenantId = "DEFAULT") => {
  let config = await tenantConfigModel.findOne({ tenantId });
  if (!config) {
    const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
    config = await tenantConfigModel.create(defaults);
  }
  return config;
};

module.exports = { getOrCreateTenantConfig };
