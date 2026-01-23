const {
  realtimeProductMinuteModel,
  realtimeCategoryMinuteModel,
  realtimeTotalsMinuteModel,
  itemModel,
  categoryModel
} = require("../../models/index");

const floorToMinuteUTC = (date) => {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  return d;
};

const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const recordRealtimeSales = async (order, paidAt) => {
  const paidDate = paidAt || order.paidAt || order.updatedAt || new Date();
  const bucket = floorToMinuteUTC(paidDate);

  const productIds = order.products.map((p) => p.productId);
  const products = await itemModel
    .find({ _id: { $in: productIds } })
    .select("nameProduct category subcategory value")
    .lean();

  const categories = await categoryModel.find().select("name subcategories").lean();
  const categoryMap = new Map(
    categories.map((c) => [String(c._id), c])
  );
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

  const productOps = [];
  const categoryOps = [];
  let totalUnits = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalMargin = 0;

  order.products.forEach((item) => {
    const info = productMap.get(String(item.productId)) || {};
    const category = categoryMap.get(String(info.categoryId));
    const categoryName = category?.name;
    const subcategoryName = (category?.subcategories || []).find(
      (s) => String(s._id) === String(info.subcategoryId)
    )?.name;
    const revenue = Number((item.price * item.quantity).toFixed(2));
    const unitCost = info.variantCosts
      ? Number(info.variantCosts.get(String(item.variantId)) || 0)
      : 0;
    const cost = Number((unitCost * item.quantity).toFixed(2));
    const margin = Number((revenue - cost).toFixed(2));

    totalUnits += item.quantity;
    totalRevenue += revenue;
    totalCost += cost;
    totalMargin += margin;

    productOps.push({
      updateOne: {
        filter: { bucket, productId: item.productId },
        update: {
          $setOnInsert: {
            bucket,
            productId: item.productId,
            productName: info.name || item.name
          },
          $inc: { units: item.quantity, revenue, cost, margin }
        },
        upsert: true
      }
    });

    categoryOps.push({
      updateOne: {
        filter: {
          bucket,
          categoryId: info.categoryId || null,
          subcategoryId: info.subcategoryId || null
        },
        update: {
          $setOnInsert: {
            bucket,
            categoryId: info.categoryId || null,
            subcategoryId: info.subcategoryId || null,
            categoryName,
            subcategoryName
          },
          $inc: { units: item.quantity, revenue, cost, margin }
        },
        upsert: true
      }
    });
  });

  if (productOps.length > 0) {
    await realtimeProductMinuteModel.bulkWrite(productOps, { ordered: false });
  }
  if (categoryOps.length > 0) {
    await realtimeCategoryMinuteModel.bulkWrite(categoryOps, { ordered: false });
  }

  await realtimeTotalsMinuteModel.updateOne(
    { bucket },
    {
      $setOnInsert: { bucket },
      $inc: {
        units: totalUnits,
        revenue: Number(totalRevenue.toFixed(2)),
        cost: Number(totalCost.toFixed(2)),
        margin: Number(totalMargin.toFixed(2))
      }
    },
    { upsert: true }
  );

  return { bucket, totalUnits, totalRevenue };
};

const buildRealtimePayload = async ({
  windowMinutes = 24 * 60,
  topLimit = 10
} = {}) => {
  const now = new Date();
  const start = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const dayStart = startOfDayUTC(now);

  const totalsAgg = await realtimeTotalsMinuteModel.aggregate([
    { $match: { bucket: { $gte: dayStart, $lte: now } } },
    {
      $group: {
        _id: null,
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    }
  ]);

  const series = await realtimeTotalsMinuteModel.aggregate([
    { $match: { bucket: { $gte: start, $lte: now } } },
    {
      $group: {
        _id: "$bucket",
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const topProductsByUnits = await realtimeProductMinuteModel.aggregate([
    { $match: { bucket: { $gte: start, $lte: now } } },
    {
      $group: {
        _id: "$productId",
        productName: { $first: "$productName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    { $sort: { units: -1 } },
    { $limit: topLimit }
  ]);

  const topProductsByRevenue = await realtimeProductMinuteModel.aggregate([
    { $match: { bucket: { $gte: start, $lte: now } } },
    {
      $group: {
        _id: "$productId",
        productName: { $first: "$productName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: topLimit }
  ]);

  const topCategories = await realtimeCategoryMinuteModel.aggregate([
    { $match: { bucket: { $gte: start, $lte: now } } },
    {
      $group: {
        _id: {
          categoryId: "$categoryId",
          subcategoryId: "$subcategoryId"
        },
        categoryName: { $first: "$categoryName" },
        subcategoryName: { $first: "$subcategoryName" },
        units: { $sum: "$units" },
        revenue: { $sum: "$revenue" },
        cost: { $sum: "$cost" },
        margin: { $sum: "$margin" }
      }
    },
    { $sort: { units: -1 } },
    { $limit: topLimit }
  ]);

  return {
    window: { start, end: now },
    totals: totalsAgg[0] || { units: 0, revenue: 0, cost: 0, margin: 0 },
    series: series.map((s) => ({
      bucket: s._id,
      units: s.units,
      revenue: s.revenue,
      cost: s.cost || 0,
      margin: s.margin || 0
    })),
    topProductsByUnits,
    topProductsByRevenue,
    topCategories
  };
};

module.exports = {
  recordRealtimeSales,
  buildRealtimePayload
};
