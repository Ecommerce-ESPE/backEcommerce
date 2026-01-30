const { tenantConfigModel, branchModel } = require("../models/index");

const ensureDefaultBranch = async (tenantId, config) => {
  if (config?.operations?.multiBranchEnabled) return null;
  const defaultBranchId = config?.operations?.defaultBranchId || "DEFAULT";
  let branch = await branchModel.findOne({ tenantId, branchId: defaultBranchId });
  if (!branch) {
    branch = new branchModel({
      tenantId,
      branchId: defaultBranchId,
      name: "Sucursal Principal",
      address: {
        line1: "",
        city: "",
        province: "",
        country: "EC"
      }
    });
    await branch.save();
  }
  return branch;
};

const loadTenantConfig = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    let config = await tenantConfigModel.findOne({ tenantId });
    if (!config) {
      const defaults = tenantConfigModel.buildDefaultTenantConfig(tenantId);
      config = await tenantConfigModel.create(defaults);
    }

    req.tenantConfig = config;
    await ensureDefaultBranch(tenantId, config);
    return next();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "No se pudo cargar la configuración del tenant"
    });
  }
};

module.exports = { loadTenantConfig };
