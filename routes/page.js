const { Router } = require("express");
const { resolvePage } = require("../controllers/page");

const router = Router();

router.get("/resolve", resolvePage);

module.exports = router;
