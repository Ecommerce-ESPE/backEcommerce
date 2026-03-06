const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { resolveMembership } = require("../middlewares/resolveMembership");
const {
  getTenantConfig,
  patchTenantConfig,
  listPresets,
  applyTenantPreset,
  patchMaintenance
} = require("../controllers/tenantConfig.controller");

const router = Router();

const requireTenantConfigAccess = (req, res, next) => {
  const userRole = String(req.user?.role || req.user?.rol || "").toUpperCase();
  if (userRole === "ADMIN") return next();

  const membership = req.membership;
  if (!membership || !membership.active) {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Membresia inactiva"
    });
  }

  const roles = membership.roles || [];
  if (roles.includes("TENANT_ADMIN") || roles.includes("BRANCH_ADMIN")) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    data: null,
    message: "Permisos insuficientes para configurar tenant"
  });
};

router.use(validarJWT);
router.use(resolveTenant);
router.use(resolveMembership);
router.use(requireTenantConfigAccess);

router.get("/", getTenantConfig);
router.get("/presets", listPresets);
router.patch("/", patchTenantConfig);
router.post("/apply-preset", applyTenantPreset);
router.patch("/maintenance", patchMaintenance);

module.exports = router;
