const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const {
  getTenantConfig,
  patchTenantConfig,
  listPresets,
  applyTenantPreset,
  patchMaintenance
} = require("../controllers/tenantConfig.controller");

const router = Router();

router.use(resolveTenant);

router.get("/", getTenantConfig);
router.get("/presets", listPresets);
router.patch("/", validarJWT, patchTenantConfig);
router.post("/apply-preset", validarJWT, applyTenantPreset);
router.patch("/maintenance", validarJWT, patchMaintenance);

module.exports = router;
