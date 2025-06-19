const {Router} = require('express');
const router = Router();

const {getFactoryAll, createFactura} = require("../controllers/factura");

//Todo: Route ITEMS 
router.get("/", getFactoryAll);
router.post("/", createFactura);
module.exports = router;