const { Router } = require("express");
const {
  getPublicBranding,
  getPublicModules
} = require("../controllers/tenant");
const {
  getBranches,
  getQueueStatus,
  trackCode,
  getReadyOrders
} = require("../controllers/public");

const router = Router();
// Rutas públicas sin autenticación
// Obtener configuración pública
router.get("/branding", getPublicBranding);
router.get("/modules", getPublicModules);
router.get("/branches", getBranches);
router.get("/branches/:branchId/queues/:serviceType", getQueueStatus);
router.get("/track/:code", trackCode);
router.get("/orders/ready", getReadyOrders);

module.exports = router;
