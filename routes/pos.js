const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");
const { resolveBranch } = require("../middlewares/resolveBranch");
const { resolveMembership } = require("../middlewares/resolveMembership");
const { requireRole } = require("../middlewares/requireRole");
const { requireScope } = require("../middlewares/requireScope");
const { requireModule } = require("../middlewares/requireModule");
const { createPosOrder } = require("../controllers/pos");

const router = Router();

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveBranch);
router.use(resolveMembership);
router.use(requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]));
router.use(requireScope());
router.use(requireModule("pos"));
// Rutas para el módulo POS
// Crear una orden desde el POS

router.post("/orders", createPosOrder);

module.exports = router;
