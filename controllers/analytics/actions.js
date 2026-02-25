const {
  getTotalsByRange,
  getSalesByWeek,
  getSalesByMonth,
  getSalesByDay,
  getSalesHourlyByDate,
  getTopProductsByRange,
  getTopCategoriesByRange,
  getTopBrandsByRange
} = require("../../services/analytics/historicalAnalyticsService");
const {
  getFinancialSummary,
  getFinancialDaily,
} = require("../../services/analytics/financialKpiService");
const { round2 } = require("../../helpers/round2");

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const roundFieldIfNumber = (value) =>
  typeof value === "number" ? round2(value) : value;

const formatTotals = (totals = {}) => ({
  ...totals,
  revenue: roundFieldIfNumber(totals.revenue),
  margin: roundFieldIfNumber(totals.margin),
  totalRevenue: roundFieldIfNumber(totals.totalRevenue),
  taxRevenue: roundFieldIfNumber(totals.taxRevenue),
  shippingRevenue: roundFieldIfNumber(totals.shippingRevenue),
  discounts: roundFieldIfNumber(totals.discounts),
});

const formatDataRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    revenue: roundFieldIfNumber(row.revenue),
    margin: roundFieldIfNumber(row.margin),
    cost: roundFieldIfNumber(row.cost),
  }));

const parseIsoRange = (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ ok: false, message: "start y end son requeridos (ISO)" });
    return null;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    res.status(400).json({ ok: false, message: "Fechas inválidas. Usa ISO" });
    return null;
  }

  if (startDate.getTime() > endDate.getTime()) {
    res.status(400).json({ ok: false, message: "Rango inválido: start no puede ser mayor que end" });
    return null;
  }

  return { startDate, endDate };
};

const parseDateOnly = (value) => {
  if (!DATE_ONLY_REGEX.test(value)) return null;
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const buildDefaultRange = (daysBack) => {
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - daysBack);
  return { startDate, endDate };
};

const parseDateRange = (req, res, { defaultDays } = {}) => {
  const { start, end } = req.query;
  if (!start && !end) {
    if (defaultDays) return buildDefaultRange(defaultDays);
    res.status(400).json({ ok: false, message: "start y end son requeridos (YYYY-MM-DD)" });
    return null;
  }

  if (!start || !end) {
    res.status(400).json({ ok: false, message: "start y end son requeridos (YYYY-MM-DD)" });
    return null;
  }

  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate) {
    res.status(400).json({ ok: false, message: "Fechas inválidas. Usa formato YYYY-MM-DD" });
    return null;
  }

  if (startDate.getTime() > endDate.getTime()) {
    res.status(400).json({ ok: false, message: "Rango inválido: start no puede ser mayor que end" });
    return null;
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  if (diffDays > MAX_RANGE_DAYS) {
    res.status(400).json({
      ok: false,
      message: `Rango demasiado grande. Máximo permitido: ${MAX_RANGE_DAYS} días`
    });
    return null;
  }

  return { startDate, endDate };
};

const parsePagination = (req) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  return { page, limit };
};

const toISODate = (date) => new Date(date).toISOString();

const attachMeta = (range, extras = {}) => ({
  range: {
    start: toISODate(range.startDate),
    end: toISODate(range.endDate)
  },
  ...extras
});

const getSalesWeekly = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 28 });
    if (!range) return;

    const [data, totals] = await Promise.all([
      getSalesByWeek(range.startDate, range.endDate),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(data),
      totals: formatTotals(totals),
      meta: attachMeta(range)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSalesMonthly = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 180 });
    if (!range) return;

    const [data, totals] = await Promise.all([
      getSalesByMonth(range.startDate, range.endDate),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(data),
      totals: formatTotals(totals),
      meta: attachMeta(range)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSalesDaily = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;

    const [data, totals] = await Promise.all([
      getSalesByDay(range.startDate, range.endDate),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(data),
      totals: formatTotals(totals),
      meta: attachMeta(range)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const pagination = parsePagination(req);

    const [topResult, totals] = await Promise.all([
      getTopProductsByRange(range.startDate, range.endDate, pagination),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(topResult.items),
      pagination: topResult.pagination,
      totals: formatTotals(totals),
      meta: attachMeta(range, pagination)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getTopCategories = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const pagination = parsePagination(req);

    const [topResult, totals] = await Promise.all([
      getTopCategoriesByRange(range.startDate, range.endDate, pagination),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(topResult.items),
      pagination: topResult.pagination,
      totals: formatTotals(totals),
      meta: attachMeta(range, pagination)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getTopBrands = async (req, res) => {
  try {
    const range = parseDateRange(req, res, { defaultDays: 30 });
    if (!range) return;
    const pagination = parsePagination(req);

    const [topResult, totals] = await Promise.all([
      getTopBrandsByRange(range.startDate, range.endDate, pagination),
      getTotalsByRange(range.startDate, range.endDate)
    ]);

    res.json({
      ok: true,
      data: formatDataRows(topResult.items),
      pagination: topResult.pagination,
      totals: formatTotals(totals),
      meta: attachMeta(range, pagination)
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getAnalyticsSummary = async (req, res) => {
  try {
    const range = parseIsoRange(req, res);
    if (!range) return;
    const [totalsRaw, dailyRaw] = await Promise.all([
      getFinancialSummary(range.startDate, range.endDate),
      getFinancialDaily(range.startDate, range.endDate),
    ]);

    const totals = {
      ordersCount: Number(totalsRaw.ordersCount || 0),
      unitsSold: Number(totalsRaw.unitsSold || 0),
      revenueProducts: round2(totalsRaw.revenueProducts),
      shippingRevenue: round2(totalsRaw.shippingRevenue),
      taxRevenue: round2(totalsRaw.taxRevenue),
      discounts: round2(totalsRaw.discounts),
      totalRevenue: round2(totalsRaw.totalRevenue),
      costCOGS: round2(totalsRaw.costCOGS),
      grossMargin: round2(totalsRaw.grossMargin),
      grossMarginPct: round2(totalsRaw.grossMarginPct),
      AOV: round2(totalsRaw.AOV),
      inventoryValue: round2(totalsRaw.inventoryValue),
      outOfStockCount: Number(totalsRaw.outOfStockCount || 0),
    };

    const daily = (dailyRaw || []).map((row) => ({
      date: row.date,
      revenueProducts: round2(row.revenueProducts),
      ordersCount: Number(row.ordersCount || 0),
      unitsSold: Number(row.unitsSold || 0),
      grossMargin: round2(row.grossMargin),
    }));

    res.json({
      ok: true,
      totals,
      daily,
      meta: {
        start: range.startDate.toISOString(),
        end: range.endDate.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getAnalyticsDaily = async (req, res) => {
  try {
    const range = parseIsoRange(req, res);
    if (!range) return;
    const [totalsRaw, dailyRaw] = await Promise.all([
      getFinancialSummary(range.startDate, range.endDate),
      getFinancialDaily(range.startDate, range.endDate),
    ]);

    const totals = {
      ordersCount: Number(totalsRaw.ordersCount || 0),
      unitsSold: Number(totalsRaw.unitsSold || 0),
      revenueProducts: round2(totalsRaw.revenueProducts),
      shippingRevenue: round2(totalsRaw.shippingRevenue),
      taxRevenue: round2(totalsRaw.taxRevenue),
      discounts: round2(totalsRaw.discounts),
      totalRevenue: round2(totalsRaw.totalRevenue),
      costCOGS: round2(totalsRaw.costCOGS),
      grossMargin: round2(totalsRaw.grossMargin),
      grossMarginPct: round2(totalsRaw.grossMarginPct),
      AOV: round2(totalsRaw.AOV),
      inventoryValue: round2(totalsRaw.inventoryValue),
      outOfStockCount: Number(totalsRaw.outOfStockCount || 0),
    };

    const daily = (dailyRaw || []).map((row) => ({
      date: row.date,
      revenueProducts: round2(row.revenueProducts),
      ordersCount: Number(row.ordersCount || 0),
      unitsSold: Number(row.unitsSold || 0),
      grossMargin: round2(row.grossMargin),
    }));

    res.json({
      ok: true,
      totals,
      daily,
      meta: {
        start: range.startDate.toISOString(),
        end: range.endDate.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

const getSalesHourly = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ ok: false, message: "date es requerido (YYYY-MM-DD)" });
    }

    const targetDate = parseDateOnly(date);
    if (!targetDate) {
      return res.status(400).json({ ok: false, message: "Fecha inválida. Usa formato YYYY-MM-DD" });
    }

    const data = await getSalesHourlyByDate(targetDate);
    res.json({
      ok: true,
      data: formatDataRows(data),
      meta: {
        date: toISODate(targetDate)
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
};

module.exports = {
  getSalesWeekly,
  getSalesMonthly,
  getSalesDaily,
  getTopProducts,
  getTopCategories,
  getTopBrands,
  getAnalyticsSummary,
  getAnalyticsDaily,
  getSalesHourly
};
