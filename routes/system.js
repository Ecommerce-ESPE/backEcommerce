const { Router } = require("express");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { getSystemStatus } = require("../controllers/tenantConfig.controller");

const router = Router();

router.use(resolveTenant);
router.get("/status", getSystemStatus);

module.exports = router;
