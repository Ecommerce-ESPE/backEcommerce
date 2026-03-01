const express = require("express");
const { charge, refund } = require("../controllers/payments");
const { validarJWT } = require("../middlewares/validar-jwt");

const router = express.Router();

router.post("/credits/charge", validarJWT, charge);
router.post("/credits/refund", validarJWT, refund);

module.exports = router;
