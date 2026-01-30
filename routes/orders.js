const { Router } = require("express");
const router = Router();
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getOrders,
  getOrderById,
  getOrderByNumber
} = require("../controllers/orders");

router.get("/", validarJWT, getOrders);
router.get("/by-number/:orderNumber", validarJWT, getOrderByNumber);
router.get("/:id", validarJWT, getOrderById);

module.exports = router;
