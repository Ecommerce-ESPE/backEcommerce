const express = require("express");
const {
  getSalesWeekly,
  getSalesMonthly,
  getSalesDaily,
  getTopProducts,
  getTopCategories
} = require("../controllers/analytics");

const router = express.Router();

router.get("/sales/weekly", getSalesWeekly);
router.get("/sales/monthly", getSalesMonthly);
router.get("/sales/daily", getSalesDaily);
router.get("/top/products", getTopProducts);
router.get("/top/categories", getTopCategories);

module.exports = router;
