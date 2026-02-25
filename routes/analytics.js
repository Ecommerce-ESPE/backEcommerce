const express = require("express");
const {
  getAnalyticsSummary,
  getAnalyticsDaily,
  getSalesWeekly,
  getSalesMonthly,
  getSalesDaily,
  getSalesHourly,
  getTopProducts,
  getTopCategories,
  getTopBrands
} = require("../controllers/analytics");

const router = express.Router();

router.get("/summary", getAnalyticsSummary);
router.get("/daily", getAnalyticsDaily);
router.get("/sales/weekly", getSalesWeekly);
router.get("/sales/monthly", getSalesMonthly);
router.get("/sales/daily", getSalesDaily);
router.get("/sales/hourly", getSalesHourly);
router.get("/top/products", getTopProducts);
router.get("/top/categories", getTopCategories);
router.get("/top/brands", getTopBrands);

module.exports = router;
