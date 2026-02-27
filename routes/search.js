const { Router } = require("express");
const { getSuggest, getResults } = require("../controllers/search/actions");

const router = Router();

router.get("/suggest", getSuggest);
router.get("/results", getResults);

module.exports = router;
