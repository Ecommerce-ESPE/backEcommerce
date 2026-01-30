const {
  getSalesByWeek,
  getSalesByMonth,
  getSalesByDay,
  getTopProductsByRange,
  getTopCategoriesByRange
} = require("../../services/analytics/historicalAnalyticsService");

const buildDefaultRange = (daysBack) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
};

const parseDateRange = (req, res, { defaultDays } = {}) => {
  const { start, end } = req.query;
  if (!start && !end) {
    if (defaultDays) return buildDefaultRange(defaultDays);
    res.status(400).json({ ok: false, message: "start y end son requeridos" });
    return null;
  }
  if (!start || !end) {
    res.status(400).json({ ok: false, message: "start y end son requeridos" });
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    res.status(400).json({ ok: false, message: "Fechas inválidas" });
    return null;
  }
  return { startDate, endDate };
};

const getSalesWeekly = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 28 });
    if (!range) return;
    const data = await getSalesByWeek(range.startDate, range.endDate);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSalesMonthly = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 180 });
    if (!range) return;
    const data = await getSalesByMonth(range.startDate, range.endDate);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSalesDaily = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const data = await getSalesByDay(range.startDate, range.endDate);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const data = await getTopProductsByRange(
      range.startDate,
      range.endDate,
      limit
    );
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getTopCategories = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const data = await getTopCategoriesByRange(
      range.startDate,
      range.endDate,
      limit
    );
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  getSalesWeekly,
  getSalesMonthly,
  getSalesDaily,
  getTopProducts,
  getTopCategories
};
