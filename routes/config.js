const { Router } = require("express");
const router = Router();

const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');

const {
  getShippingAddresses,
  createShippingMethod,
  patchShippingMethod,
  deleteShippingMethod,
  getShippingMethods,
  getShippingMethodById,
  getAvailableShippingMethods,
  getShippingMethodHighlights
} = require("../controllers/config");

// Rutas direcciones (requiere auth)
router.get("/shipping-addresses", getShippingAddresses);

// Rutas métodos de envío
router.get("/shipping-methods", getShippingMethods); // pública o puedes protegerla
router.get("/shipping-methods/highlights", getShippingMethodHighlights);
router.get("/shipping-methods/available", [validarJWT], getAvailableShippingMethods);
router.get("/shipping-methods/:id", getShippingMethodById);
router.post("/shipping-methods", [validarJWT, validarAdmin], createShippingMethod);
router.patch("/shipping-methods/:id", [validarJWT, validarAdmin], patchShippingMethod);
router.delete("/shipping-methods/:id", [validarJWT, validarAdmin], deleteShippingMethod);

module.exports = router;
