const jwt = require("jsonwebtoken");
const { branchModel } = require("../models/index");

const resolveBranch = async (req, res, next) => {
  try {
    let branchId = req.branchId;

    if (!branchId && req.user && req.user.branchId) {
      branchId = req.user.branchId;
    }

    if (!branchId) {
      const token = req.header("x-token") || req.query.token;
      if (token) {
        const decoded = jwt.decode(token);
        if (decoded && decoded.branchId) {
          branchId = decoded.branchId;
        }
      }
    }

    if (!branchId) {
      const headerBranch = req.header("x-branch-id");
      const queryBranch = req.query.branchId;
      if (process.env.NODE_ENV !== "production" && headerBranch) {
        branchId = headerBranch;
      } else if (queryBranch) {
        branchId = queryBranch;
      }
    }

    const defaultBranchId =
      req.tenantConfig?.operations?.defaultBranchId || "DEFAULT";
    branchId = branchId || defaultBranchId;

    const tenantId = req.tenantId || "DEFAULT";
    let branch = await branchModel.findOne({ tenantId, branchId });

    if (!branch && !req.tenantConfig?.operations?.multiBranchEnabled) {
      branch = await branchModel.create({
        tenantId,
        branchId: defaultBranchId,
        name: "Sucursal Principal",
        address: { line1: "", city: "", province: "", country: "EC" }
      });
    }

    if (!branch) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Sucursal no encontrada"
      });
    }

    req.branchId = branchId;
    req.branch = branch;
    return next();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error resolviendo sucursal"
    });
  }
};

module.exports = { resolveBranch };
