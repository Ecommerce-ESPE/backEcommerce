const {Router} = require('express');
const router = Router();

const {redemptionCode , createRedemptionCode, creatediscountCode} = require("../controllers/wallet");

//Todo: Route ITEMS 
//router.get("/", getItemsAll);

// Ruta para canjear 
router.post("/redeem/:userId", redemptionCode);
// Ruta para crear el codigo de canje 
router.post("/redeem",createRedemptionCode );
// Ruta para crear descuentos
router.post("/discountCode",creatediscountCode );
module.exports = router;

