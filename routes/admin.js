const { Router } = require("express");
const {
  getTenantConfig,
  updateTenantConfig,
  resetTenantConfig
} = require("../controllers/tenant");
const {
  createUserAdmin,
  createMembership,
  getMemberships,
  updateMembership
} = require("../controllers/membership");
const {
  createInvoiceForOrder,
  getInvoiceAdmin
} = require("../controllers/invoices-api");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");
const { resolveBranch } = require("../middlewares/resolveBranch");
const { resolveMembership } = require("../middlewares/resolveMembership");
const { userModel } = require("../models/index");

const router = Router();

const requireAdminOrTenantAdmin = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.uid);
    if (user?.role === "ADMIN" || req.membership?.roles?.includes("TENANT_ADMIN")) {
      return next();
    }
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Acceso restringido"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error validando permisos"
    });
  }
};

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveMembership);
router.use(requireAdminOrTenantAdmin);

router.get("/tenant-config", getTenantConfig);
router.put("/tenant-config", updateTenantConfig);
router.post("/tenant-config/reset", resetTenantConfig);

router.post("/users", createUserAdmin);
router.post("/memberships", createMembership);
router.get("/memberships", getMemberships);
router.put("/memberships/:id", updateMembership);
// MODULO DE FACTURACIÓN, para administradores
// Crear factura para una orden
router.post("/orders/:id/invoice", resolveBranch, createInvoiceForOrder);
router.get("/invoices/:id", getInvoiceAdmin);

module.exports = router;
