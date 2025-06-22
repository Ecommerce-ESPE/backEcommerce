// routes/transaction.js
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');

router.post('/process', transactionController.processTransaction);
router.get('/invoices/:id', transactionController.downloadInvoice);

module.exports = router;