const { Router } = require("express");
const { resolvePage } = require("../controllers/pageResolver");

const router = Router();

router.get("/resolve", resolvePage);

module.exports = router;
