const { Router } = require("express");
const router = Router();

const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');

const {
  getShippingAddresses,
  createShippingMethod,
  getShippingMethods,
  getAvailableShippingMethods,
  getShippingMethodHighlights
} = require("../controllers/config");

// Rutas direcciones (requiere auth)
router.get("/shipping-addresses", getShippingAddresses);

// Rutas métodos de envío
router.get("/shipping-methods", getShippingMethods); // pública o puedes protegerla
router.get("/shipping-methods/highlights", getShippingMethodHighlights);
router.post("/shipping-methods", [validarJWT, validarAdmin], createShippingMethod);
router.get("/shipping-methods/available", [validarJWT], getAvailableShippingMethods);

module.exports = router;
