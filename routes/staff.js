const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");
const { resolveBranch } = require("../middlewares/resolveBranch");
const { resolveMembership } = require("../middlewares/resolveMembership");
const { requireRole } = require("../middlewares/requireRole");
const { requireScope } = require("../middlewares/requireScope");
const {
  heartbeat,
  updateStatus,
  getMe
} = require("../controllers/staff");

const router = Router();

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveBranch);
router.use(resolveMembership);
router.use(
  requireRole([
    "TENANT_ADMIN",
    "BRANCH_ADMIN",
    "CASHIER",
    "KITCHEN",
    "DISPATCH",
    "COURIER"
  ])
);
router.use(requireScope());

router.post("/heartbeat", heartbeat);
router.post("/status", updateStatus);
router.get("/me", getMe);

module.exports = router;
