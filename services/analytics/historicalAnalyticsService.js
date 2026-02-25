const {
  salesItemModel,
  salesSummaryDailyModel,
  itemModel,
  categoryModel,
  brandModel,
  orderModel,
} = require("../../models/index");

const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const endOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

const getRangeMatch = (startDate, endDate) => ({
  $gte: startOfDayUTC(startDate),
  $lte: endOfDayUTC(endDate),
});

const getCategoryNamesMap = (categories = []) => {
  const map = new Map();
  categories.forEach((cat) => {
    map.set(String(cat._id), { name: cat.name, subcategories: cat.subcategories || [] });
  });
  return map;
};

const getBrandNamesMap = (brands = []) => {
  const map = new Map();
  brands.forEach((brand) => {
    map.set(String(brand._id), brand.name);
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

    if (item.brandId) {
      ops.push({
        updateOne: {
          filter: {
            day,
            granularity: "brand",
            brandId: item.brandId
          },
          update: {
            $setOnInsert: {
              day,
              granularity: "brand",
              brandId: item.brandId,
              brandName: item.brandName
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
                discounts: orderTotals.discounts,
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

const normalizeTopFacet = (agg = [], page = 1, limit = 10) => {
  const raw = Array.isArray(agg) && agg.length > 0 ? agg[0] : { items: [], meta: [] };
  const total = raw.meta?.[0]?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items: raw.items || [],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

const getTotalsByRange = async (startDate, endDate) => {
  const totalsAgg = await salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "total",
        day: getRangeMatch(startDate, endDate)
      }
    },
    {
      $group: {
        _id: null,
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" },
        shippingRevenue: { $sum: "$shippingRevenue" },
        taxRevenue: { $sum: "$taxRevenue" },
        discounts: { $sum: "$discounts" },
        totalRevenue: { $sum: "$totalRevenue" }
      }
    }
  ]);

  const totals = totalsAgg[0] || {
    units: 0,
    revenue: 0,
    cost: 0,
    margin: 0,
    shippingRevenue: 0,
    taxRevenue: 0,
    discounts: 0,
    totalRevenue: 0
  };

  return {
    units: totals.units || 0,
    revenue: totals.revenue || 0,
    cost: totals.cost || 0,
    margin: totals.margin || 0,
    shippingRevenue: totals.shippingRevenue || 0,
    taxRevenue: totals.taxRevenue || 0,
    discounts: totals.discounts || 0,
    totalRevenue: totals.totalRevenue || 0
  };
};

const recordHistoricalSales = async (order, paidAt) => {
  const paidDate = paidAt || order.paidAt || order.updatedAt || new Date();
  const day = startOfDayUTC(paidDate);
  const year = paidDate.getUTCFullYear();
  const month = paidDate.getUTCMonth() + 1;

  const productIds = order.products.map((p) => p.productId);
  const products = await itemModel
    .find({ _id: { $in: productIds } })
    .select("nameProduct category subcategory brand value")
    .lean();

  const categories = await categoryModel.find().select("name subcategories").lean();
  const categoryMap = getCategoryNamesMap(categories);

  const brandIds = [...new Set(products.map((p) => String(p.brand || "")).filter(Boolean))];
  const brands = brandIds.length > 0
    ? await brandModel.find({ _id: { $in: brandIds } }).select("name").lean()
    : [];
  const brandMap = getBrandNamesMap(brands);

  const productMap = new Map(
    products.map((p) => [
      String(p._id),
      {
        name: p.nameProduct,
        categoryId: p.category,
        subcategoryId: p.subcategory,
        brandId: p.brand,
        brandName: p.brand ? brandMap.get(String(p.brand)) : undefined,
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
      brandId: productInfo.brandId,
      productName: productInfo.name || item.name,
      categoryName,
      subcategoryName,
      brandName: productInfo.brandName,
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
      discounts: Number((order.discountAmount || 0).toFixed(2)),
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
        day: getRangeMatch(startDate, endDate)
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
        discounts: { $sum: "$discounts" },
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
        day: getRangeMatch(startDate, endDate)
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
        discounts: { $sum: "$discounts" },
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
        day: getRangeMatch(startDate, endDate)
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
        discounts: 1,
        totalRevenue: 1
      }
    },
    { $sort: { day: 1 } }
  ]);

const getTopProductsByRange = async (startDate, endDate, options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const agg = await salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "product",
        day: getRangeMatch(startDate, endDate)
      }
    },
    {
      $group: {
        _id: "$productId",
        productId: { $first: "$productId" },
        productName: { $first: "$productName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    {
      $project: {
        _id: 0,
        productId: 1,
        productName: 1,
        units: 1,
        revenue: 1,
        cost: 1,
        margin: 1
      }
    },
    { $sort: { revenue: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }]
      }
    }
  ]);

  return normalizeTopFacet(agg, page, limit);
};

const getTopCategoriesByRange = async (startDate, endDate, options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const agg = await salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "category",
        day: getRangeMatch(startDate, endDate)
      }
    },
    {
      $group: {
        _id: "$categoryId",
        categoryId: { $first: "$categoryId" },
        categoryName: { $first: "$categoryName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    {
      $project: {
        _id: 0,
        categoryId: 1,
        categoryName: 1,
        units: 1,
        revenue: 1,
        cost: 1,
        margin: 1
      }
    },
    { $sort: { revenue: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }]
      }
    }
  ]);

  return normalizeTopFacet(agg, page, limit);
};

const getTopBrandsByRange = async (startDate, endDate, options = {}) => {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const agg = await salesSummaryDailyModel.aggregate([
    {
      $match: {
        granularity: "brand",
        day: getRangeMatch(startDate, endDate)
      }
    },
    {
      $group: {
        _id: "$brandId",
        brandId: { $first: "$brandId" },
        brandName: { $first: "$brandName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    {
      $project: {
        _id: 0,
        brandId: 1,
        brandName: 1,
        units: 1,
        revenue: 1,
        cost: 1,
        margin: 1
      }
    },
    { $sort: { revenue: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }]
      }
    }
  ]);

  return normalizeTopFacet(agg, page, limit);
};

const getSummaryByRange = async (startDate, endDate) => {
  const [totals, ordersCount] = await Promise.all([
    getTotalsByRange(startDate, endDate),
    orderModel.countDocuments({
      paymentStatus: "paid",
      paidAt: getRangeMatch(startDate, endDate),
    }),
  ]);

  const avgOrderValue = ordersCount > 0
    ? Number((totals.totalRevenue / ordersCount).toFixed(2))
    : 0;

  return {
    ...totals,
    orders: ordersCount,
    avgOrderValue
  };
};

const getSalesHourlyByDate = async (date) => {
  const dayStart = startOfDayUTC(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const data = await salesItemModel.aggregate([
    {
      $match: {
        paidAt: { $gte: dayStart, $lt: dayEnd }
      }
    },
    {
      $group: {
        _id: { $hour: { date: "$paidAt", timezone: "UTC" } },
        units: { $sum: "$quantity" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const hourMap = new Map(data.map((row) => [row._id, row]));
  const series = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const current = hourMap.get(hour) || {};
    series.push({
      hour,
      units: current.units || 0,
      revenue: current.revenue || 0,
      cost: current.cost || 0,
      margin: current.margin || 0
    });
  }

  return series;
};

module.exports = {
  recordHistoricalSales,
  getTotalsByRange,
  getSummaryByRange,
  getSalesByWeek,
  getSalesByMonth,
  getSalesByDay,
  getSalesHourlyByDate,
  getTopProductsByRange,
  getTopCategoriesByRange,
  getTopBrandsByRange
};
