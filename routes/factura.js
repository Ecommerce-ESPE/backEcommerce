const {Router} = require('express');
const router = Router();

const {getInvoicesAll,
  getInvoicesByCustomer,
  createInvoice,
  generateInvoicePDF,} = require("../controllers/invoices");

//Todo: Route ITEMS 
router.get("/", getInvoicesAll);

module.exports = router;