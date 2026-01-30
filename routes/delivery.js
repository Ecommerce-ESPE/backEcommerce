const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");
const { resolveBranch } = require("../middlewares/resolveBranch");
const { resolveMembership } = require("../middlewares/resolveMembership");
const { requireRole } = require("../middlewares/requireRole");
const { requireScope } = require("../middlewares/requireScope");
const { requireModule } = require("../middlewares/requireModule");
const {
  listDeliveryOrders,
  assignDeliveryOrder,
  markOutForDelivery,
  markDelivered
} = require("../controllers/delivery");

const router = Router();

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveBranch);
router.use(resolveMembership);
router.use(requireRole(["COURIER", "DISPATCH", "BRANCH_ADMIN", "TENANT_ADMIN"]));
router.use(requireScope());
router.use(requireModule("delivery"));

router.get("/orders", listDeliveryOrders);
router.post("/orders/:id/assign", assignDeliveryOrder);
router.post("/orders/:id/out", markOutForDelivery);
router.post("/orders/:id/delivered", markDelivered);

module.exports = router;
