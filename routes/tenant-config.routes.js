const { Router } = require("express");
const multer = require("multer");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { resolveMembership } = require("../middlewares/resolveMembership");
const {
  getTenantConfig,
  patchTenantConfig,
  listPresets,
  applyTenantPreset,
  patchMaintenance,
  uploadSriSignature,
  validateAndSaveSriSignature,
  setSriSignaturePin,
  testSriSignature,
  deleteSriSignature
} = require("../controllers/tenantConfig.controller");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
router.post("/integrations/sri/signature/upload", upload.single("certificate"), uploadSriSignature);
router.post(
  "/integrations/sri/signature/validate-and-save",
  upload.single("certificate"),
  validateAndSaveSriSignature
);
router.post("/integrations/sri/signature/pin", setSriSignaturePin);
router.post("/integrations/sri/signature/test-sign", testSriSignature);
router.delete("/integrations/sri/signature", deleteSriSignature);

module.exports = router;
