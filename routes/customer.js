const { Router } = require("express");
const { getInvoiceCustomer } = require("../controllers/invoices-api");
const { validarJWT } = require("../middlewares/validar-jwt");
const { resolveTenant } = require("../middlewares/resolveTenant");
const { loadTenantConfig } = require("../middlewares/loadTenantConfig");

const router = Router();

router.use(validarJWT);
router.use(resolveTenant);
router.use(loadTenantConfig);
// MODULO DE FACTURACIÓN, para clientes
router.get("/invoices/:id", getInvoiceCustomer);

module.exports = router;
