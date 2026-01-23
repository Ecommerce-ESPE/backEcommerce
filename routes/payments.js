const express = require("express");
const { charge, refund } = require("../controllers/creditsPayment.controller");

const router = express.Router();

router.post("/credits/charge", charge);
router.post("/credits/refund", refund);

module.exports = router;
