const {Router} = require('express');
const router = Router();

const { validarJWT } = require("../middlewares/validar-jwt");
const {
  redemptionCode,
  createRedemptionCode,
  creatediscountCode,
  validateDiscount,
  getDiscountCode,
  getMyWallet,
  getMyWalletTransactions,
  getWalletSummary
} = require("../controllers/wallet");

//Todo: Route ITEMS 
//router.get("/", getItemsAll);

// Ruta para canjear (token)
router.post("/redeem", validarJWT, redemptionCode);
// Ruta para crear el codigo de canje 
router.post("/redeem/code", validarJWT, createRedemptionCode );
// Ruta para crear descuentos
router.post("/discountCode",creatediscountCode );

router.get("/discountCode",getDiscountCode );
// Ruta para validar el descuento
router.post("/validateDiscount", validateDiscount);

// Wallet by token (x-token or ?token)
router.get("/me", validarJWT, getMyWallet);
router.get("/me/transactions", validarJWT, getMyWalletTransactions);
router.get("/summary", validarJWT, getWalletSummary);
module.exports = router;
