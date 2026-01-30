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
  createTicketHandler,
  claimNextTicketHandler,
  startTicketHandler,
  closeTicketHandler,
  skipTicketHandler
} = require("../controllers/tickets");

const router = Router();

router.use(resolveTenant);
router.use(loadTenantConfig);
router.use(resolveBranch);
router.use(
  requireModule("queuesTickets", {
    code: "MODULE_QUEUES_TICKETS_DISABLED",
    message: "Módulo de colas/tickets deshabilitado"
  })
);

router.post("/", validarJWT, resolveMembership, requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]), requireScope(), createTicketHandler);
router.post("/next", validarJWT, resolveMembership, requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]), requireScope(), claimNextTicketHandler);
router.post("/:id/start", validarJWT, resolveMembership, requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]), requireScope(), startTicketHandler);
router.post("/:id/close", validarJWT, resolveMembership, requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]), requireScope(), closeTicketHandler);
router.post("/:id/skip", validarJWT, resolveMembership, requireRole(["CASHIER", "BRANCH_ADMIN", "TENANT_ADMIN"]), requireScope(), skipTicketHandler);

module.exports = router;
