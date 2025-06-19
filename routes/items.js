const {Router} = require('express');
const router = Router();

const {getItemsAll, createItem , getItemsById} = require("../controllers/item");

//Todo: Route ITEMS 
router.get("/", getItemsAll);
router.get("/:id", getItemsById);
router.post("/", createItem);
module.exports = router;