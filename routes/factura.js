const {Router} = require('express');
const router = Router();

const {getInvoicesAll,
  getInvoicesByCustomer,
  createInvoice,
  generateInvoicePDF,} = require("../controllers/factura");

//Todo: Route ITEMS 
router.get("/", getInvoicesAll);

module.exports = router;