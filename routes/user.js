const {Router} = require('express');
const router = Router();

const {
    createUser, getUserAll,
} = require("../controllers/user");

//Todo: Route ITEMS 
router.get("/", getUserAll);
router.post("/",createUser);
module.exports = router;