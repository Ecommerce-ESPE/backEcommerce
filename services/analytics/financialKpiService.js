const { orderModel, itemModel } = require("../../models/index");

const buildPaidMatch = () => ({
  $or: [
    { paymentStatus: { $in: ["paid", "PAID"] } },
    { status: { $in: ["completed", "COMPLETED", "paid", "PAID"] } },
  ],
});

const buildDateMatchExpr = (startDate, endDate) => ({
  $and: [
    { $gte: [{ $ifNull: ["$paidAt", "$createdAt"] }, startDate] },
    { $lte: [{ $ifNull: ["$paidAt", "$createdAt"] }, endDate] },
  ],
});

const buildVariantLookupPipeline = () => [
  { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
  {
    $project: {
      _id: 0,
      costPrice: {
        $let: {
          vars: {
            variant: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$value",
                    as: "v",
                    cond: { $eq: ["$$v._id", "$$vid"] },
                  },
                },
                0,
              ],
            },
          },
          in: { $ifNull: ["$$variant.costPrice", 0] },
        },
      },
    },
  },
];

const getFinancialSummary = async (startDate, endDate) => {
  const paidMatch = buildPaidMatch();
  const dateExpr = buildDateMatchExpr(startDate, endDate);

  const [summaryAgg] = await orderModel.aggregate([
    { $match: paidMatch },
    {
      $match: {
        $expr: dateExpr,
      },
    },
    {
      $facet: {
        orderTotals: [
          {
            $group: {
              _id: null,
              ordersCount: { $sum: 1 },
              revenueProducts: { $sum: { $ifNull: ["$subtotal", 0] } },
              shippingRevenue: { $sum: { $ifNull: ["$shippingCost", 0] } },
              taxRevenue: { $sum: { $ifNull: ["$tax", 0] } },
              discounts: { $sum: { $ifNull: ["$discountAmount", 0] } },
            },
          },
        ],
        unitsAndCogs: [
          { $unwind: { path: "$products", preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from: "items",
              let: { pid: "$products.productId", vid: "$products.variantId" },
              pipeline: buildVariantLookupPipeline(),
              as: "productCost",
            },
          },
          {
            $addFields: {
              qty: { $ifNull: ["$products.quantity", 0] },
              variantCost: {
                $ifNull: [{ $arrayElemAt: ["$productCost.costPrice", 0] }, 0],
              },
            },
          },
          {
            $group: {
              _id: null,
              unitsSold: { $sum: "$qty" },
              costCOGS: { $sum: { $multiply: ["$qty", "$variantCost"] } },
            },
          },
        ],
      },
    },
  ]);

  const orderTotals = summaryAgg?.orderTotals?.[0] || {};
  const unitsAndCogs = summaryAgg?.unitsAndCogs?.[0] || {};

  const ordersCount = Number(orderTotals.ordersCount || 0);
  const unitsSold = Number(unitsAndCogs.unitsSold || 0);
  const revenueProducts = Number(orderTotals.revenueProducts || 0);
  const shippingRevenue = Number(orderTotals.shippingRevenue || 0);
  const taxRevenue = Number(orderTotals.taxRevenue || 0);
  const discounts = Number(orderTotals.discounts || 0);
  const totalRevenue = revenueProducts + shippingRevenue + taxRevenue - discounts;
  const costCOGS = Number(unitsAndCogs.costCOGS || 0);
  const grossMargin = revenueProducts - costCOGS;
  const grossMarginPct = revenueProducts > 0 ? (grossMargin / revenueProducts) * 100 : 0;
  const AOV = ordersCount > 0 ? totalRevenue / ordersCount : 0;

  const [inventoryAgg] = await itemModel.aggregate([
    { $unwind: { path: "$value", preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: null,
        inventoryValue: {
          $sum: {
            $multiply: [
              { $ifNull: ["$value.stock", 0] },
              { $ifNull: ["$value.costPrice", 0] },
            ],
          },
        },
        outOfStockCount: {
          $sum: {
            $cond: [{ $lte: [{ $ifNull: ["$value.stock", 0] }, 0] }, 1, 0],
          },
        },
      },
    },
  ]);

  return {
    ordersCount,
    unitsSold,
    revenueProducts,
    shippingRevenue,
    taxRevenue,
    discounts,
    totalRevenue,
    costCOGS,
    grossMargin,
    grossMarginPct,
    AOV,
    inventoryValue: Number(inventoryAgg?.inventoryValue || 0),
    outOfStockCount: Number(inventoryAgg?.outOfStockCount || 0),
  };
};

const getFinancialDaily = async (startDate, endDate) => {
  const paidMatch = buildPaidMatch();
  const dateExpr = buildDateMatchExpr(startDate, endDate);

  const [dailyAgg] = await orderModel.aggregate([
    { $match: paidMatch },
    {
      $match: {
        $expr: dateExpr,
      },
    },
    {
      $addFields: {
        orderDate: { $ifNull: ["$paidAt", "$createdAt"] },
      },
    },
    {
      $facet: {
        orderByDay: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$orderDate",
                  timezone: "UTC",
                },
              },
              ordersCount: { $sum: 1 },
              revenueProducts: { $sum: { $ifNull: ["$subtotal", 0] } },
            },
          },
        ],
        unitCogsByDay: [
          { $unwind: { path: "$products", preserveNullAndEmptyArrays: false } },
          {
            $lookup: {
              from: "items",
              let: { pid: "$products.productId", vid: "$products.variantId" },
              pipeline: buildVariantLookupPipeline(),
              as: "productCost",
            },
          },
          {
            $addFields: {
              dayKey: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$orderDate",
                  timezone: "UTC",
                },
              },
              qty: { $ifNull: ["$products.quantity", 0] },
              variantCost: {
                $ifNull: [{ $arrayElemAt: ["$productCost.costPrice", 0] }, 0],
              },
            },
          },
          {
            $group: {
              _id: "$dayKey",
              unitsSold: { $sum: "$qty" },
              costCOGS: { $sum: { $multiply: ["$qty", "$variantCost"] } },
            },
          },
        ],
      },
    },
  ]);

  const orderMap = new Map((dailyAgg?.orderByDay || []).map((row) => [row._id, row]));
  const cogsMap = new Map((dailyAgg?.unitCogsByDay || []).map((row) => [row._id, row]));
  const dayKeys = Array.from(new Set([...orderMap.keys(), ...cogsMap.keys()])).sort();

  return dayKeys.map((dayKey) => {
    const orderRow = orderMap.get(dayKey) || {};
    const cogsRow = cogsMap.get(dayKey) || {};
    const revenueProducts = Number(orderRow.revenueProducts || 0);
    const grossMargin = revenueProducts - Number(cogsRow.costCOGS || 0);

    return {
      date: `${dayKey}T00:00:00.000Z`,
      revenueProducts,
      ordersCount: Number(orderRow.ordersCount || 0),
      unitsSold: Number(cogsRow.unitsSold || 0),
      grossMargin,
    };
  });
};

module.exports = {
  getFinancialSummary,
  getFinancialDaily,
};
