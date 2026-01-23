const {
  salesItemModel,
  salesSummaryDailyModel,
  itemModel,
  categoryModel
} = require("../../models/index");

const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const getCategoryNamesMap = (categories = []) => {
  const map = new Map();
  categories.forEach((cat) => {
    map.set(String(cat._id), { name: cat.name, subcategories: cat.subcategories || [] });
  });
  return map;
};

const resolveSubcategoryName = (cat, subcategoryId) => {
  if (!cat || !subcategoryId) return undefined;
  const sub = (cat.subcategories || []).find(
    (s) => String(s._id) === String(subcategoryId)
  );
  return sub?.name;
};

const buildDailySummaryOps = (day, items, orderTotals = null) => {
  const ops = [];

  let totalUnits = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalMargin = 0;

  items.forEach((item) => {
    totalUnits += item.quantity;
    totalRevenue += item.revenue;
    totalCost += item.cost || 0;
    totalMargin += item.margin || 0;

    ops.push({
      updateOne: {
        filter: {
          day,
          granularity: "product",
          productId: item.productId
        },
        update: {
          $setOnInsert: {
            day,
            granularity: "product",
            productId: item.productId,
            productName: item.productName
          },
          $inc: {
            units: item.quantity,
            revenue: item.revenue,
            cost: item.cost || 0,
            margin: item.margin || 0
          }
        },
        upsert: true
      }
    });

    if (item.categoryId) {
      ops.push({
        updateOne: {
          filter: {
            day,
            granularity: "category",
            categoryId: item.categoryId
          },
          update: {
            $setOnInsert: {
              day,
              granularity: "category",
              categoryId: item.categoryId,
              categoryName: item.categoryName
            },
          $inc: {
            units: item.quantity,
            revenue: item.revenue,
            cost: item.cost || 0,
            margin: item.margin || 0
          }
        },
        upsert: true
      }
      });
    }

    if (item.subcategoryId) {
      ops.push({
        updateOne: {
          filter: {
            day,
            granularity: "subcategory",
            categoryId: item.categoryId || null,
            subcategoryId: item.subcategoryId
          },
          update: {
            $setOnInsert: {
              day,
              granularity: "subcategory",
              categoryId: item.categoryId || null,
              subcategoryId: item.subcategoryId,
              categoryName: item.categoryName,
              subcategoryName: item.subcategoryName
            },
          $inc: {
            units: item.quantity,
            revenue: item.revenue,
            cost: item.cost || 0,
            margin: item.margin || 0
          }
        },
        upsert: true
      }
      });
    }
  });

  ops.push({
    updateOne: {
      filter: { day, granularity: "total" },
      update: {
        $setOnInsert: { day, granularity: "total" },
        $inc: {
          units: totalUnits,
          revenue: totalRevenue,
          cost: totalCost,
          margin: totalMargin,
          ...(orderTotals
            ? {
                shippingRevenue: orderTotals.shipping,
                taxRevenue: orderTotals.tax,
                totalRevenue: orderTotals.total
              }
            : {})
        }
      },
      upsert: true
    }
  });

  return ops;
};

const recordHistoricalSales = async (order, paidAt) => {
  const paidDate = paidAt || order.paidAt || order.updatedAt || new Date();
  const day = startOfDayUTC(paidDate);
  const year = paidDate.getUTCFullYear();
  const month = paidDate.getUTCMonth() + 1;

  const productIds = order.products.map((p) => p.productId);
  const products = await itemModel
    .find({ _id: { $in: productIds } })
    .select("nameProduct category subcategory value")
    .lean();

  const categories = await categoryModel.find().select("name subcategories").lean();
  const categoryMap = getCategoryNamesMap(categories);

  const productMap = new Map(
    products.map((p) => [
      String(p._id),
      {
        name: p.nameProduct,
        categoryId: p.category,
        subcategoryId: p.subcategory,
        variantCosts: new Map(
          (p.value || []).map((v) => [String(v._id), Number(v.costPrice || 0)])
        )
      }
    ])
  );

  const salesItems = order.products.map((item) => {
    const productInfo = productMap.get(String(item.productId)) || {};
    const categoryInfo = categoryMap.get(String(productInfo.categoryId));
    const categoryName = categoryInfo?.name;
    const subcategoryName = resolveSubcategoryName(categoryInfo, productInfo.subcategoryId);
    const revenue = Number((item.price * item.quantity).toFixed(2));
    const unitCost = productInfo.variantCosts
      ? Number(productInfo.variantCosts.get(String(item.variantId)) || 0)
      : 0;
    const cost = Number((unitCost * item.quantity).toFixed(2));
    const margin = Number((revenue - cost).toFixed(2));

    return {
      orderId: order._id,
      productId: item.productId,
      variantId: item.variantId,
      categoryId: productInfo.categoryId,
      subcategoryId: productInfo.subcategoryId,
      productName: productInfo.name || item.name,
      categoryName,
      subcategoryName,
      quantity: item.quantity,
      price: item.price,
      revenue,
      cost,
      margin,
      paidAt: paidDate,
      day,
      month,
      year
    };
  });

  if (salesItems.length > 0) {
    const orderTotals = {
      shipping: Number((order.shippingCost || 0).toFixed(2)),
      tax: Number((order.tax || 0).toFixed(2)),
      total: Number((order.total || 0).toFixed(2))
    };
    await salesItemModel.insertMany(salesItems, { ordered: false });
    const summaryOps = buildDailySummaryOps(day, salesItems, orderTotals);
    if (summaryOps.length > 0) {
      await salesSummaryDailyModel.bulkWrite(summaryOps, { ordered: false });
    }
  }

  return { salesItemsCount: salesItems.length, day };
};

const getSalesByWeek = async (startDate, endDate) =>
  salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "total",
        day: { $gte: startOfDayUTC(startDate), $lte: startOfDayUTC(endDate) }
      }
    },
    {
      $group: {
        _id: {
          year: { $isoWeekYear: "$day" },
          week: { $isoWeek: "$day" }
        },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" },
        shippingRevenue: { $sum: "$shippingRevenue" },
        taxRevenue: { $sum: "$taxRevenue" },
        totalRevenue: { $sum: "$totalRevenue" }
      }
    },
    { $sort: { "_id.year": 1, "_id.week": 1 } }
  ]);

const getSalesByMonth = async (startDate, endDate) =>
  salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "total",
        day: { $gte: startOfDayUTC(startDate), $lte: startOfDayUTC(endDate) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$day" },
          month: { $month: "$day" }
        },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" },
        shippingRevenue: { $sum: "$shippingRevenue" },
        taxRevenue: { $sum: "$taxRevenue" },
        totalRevenue: { $sum: "$totalRevenue" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

const getSalesByDay = async (startDate, endDate) =>
  salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "total",
        day: { $gte: startOfDayUTC(startDate), $lte: startOfDayUTC(endDate) }
      }
    },
    {
      $project: {
        _id: 0,
        day: "$day",
        units: 1,
        revenue: 1,
        cost: 1,
        margin: 1,
        shippingRevenue: 1,
        taxRevenue: 1,
        totalRevenue: 1
      }
    },
    { $sort: { day: 1 } }
  ]);

const getTopProductsByRange = async (startDate, endDate, limit = 10) =>
  salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "product",
        day: { $gte: startOfDayUTC(startDate), $lte: startOfDayUTC(endDate) }
      }
    },
    {
      $group: {
        _id: "$productId",
        productName: { $first: "$productName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: limit }
  ]);

const getTopCategoriesByRange = async (startDate, endDate, limit = 10) =>
  salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "category",
        day: { $gte: startOfDayUTC(startDate), $lte: startOfDayUTC(endDate) }
      }
    },
    {
      $group: {
        _id: "$categoryId",
        categoryName: { $first: "$categoryName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: limit }
  ]);

module.exports = {
  recordHistoricalSales,
  getSalesByWeek,
  getSalesByMonth,
  getSalesByDay,
  getTopProductsByRange,
  getTopCategoriesByRange
};
