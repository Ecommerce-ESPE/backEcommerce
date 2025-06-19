const {Router} = require('express');
const router = Router();

const {moreSold} = require("../controllers/anality");

//Todo: Route ITEMS 
router.get("/moreSold", moreSold);
router.post("/");
module.exports = router;