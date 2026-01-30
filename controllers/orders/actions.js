const {
  orderModel,
  transactionModel,
  invoiceModel,
  shippingMethodModel,
  itemModel
} = require("../../models/index");

const mapLegacyOrderStatus = (status) => {
  switch (status) {
    case "pending":
      return "pending";
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "cancelled":
    case "failed":
    case "refunded":
      return "cancelled";
    default:
      return "pending";
  }
};

const mapLegacyDeliveryStatus = (legacyStatus, hasShipping) => {
  if (!hasShipping) return "none";
  switch (legacyStatus) {
    case "READY":
      return "assigned";
    case "OUT_FOR_DELIVERY":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "NONE":
    default:
      return "none";
  }
};

const mapLegacyPaymentStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "success":
    case "completed":
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "pending":
    case "processing":
      return "pending";
    default:
      return "pending";
  }
};

const mapLegacyStatuses = (order, transaction) => ({
  orderStatus: order.orderStatus || mapLegacyOrderStatus(order.status),
  paymentStatus: order.paymentStatus || mapLegacyPaymentStatus(transaction?.status),
  deliveryStatus:
    order.deliveryStatusNormalized ||
    mapLegacyDeliveryStatus(order.deliveryStatus, !!order.shippingAddress)
});

const buildOrderStatusFilter = (orderStatus) => {
  const legacyStatuses = {
    pending: ["pending"],
    processing: ["processing"],
    completed: ["completed"],
    cancelled: ["cancelled", "failed", "refunded"]
  }[orderStatus] || [];

  return {
    $or: [
      { orderStatus },
      { orderStatus: { $exists: false }, status: { $in: legacyStatuses } },
      { orderStatus: null, status: { $in: legacyStatuses } }
    ]
  };
};

const buildDeliveryStatusFilter = (deliveryStatus) => {
  const legacyStatuses = {
    none: ["NONE", null],
    assigned: ["READY"],
    in_transit: ["OUT_FOR_DELIVERY"],
    delivered: ["DELIVERED"]
  }[deliveryStatus] || [];

  return {
    $or: [
      { deliveryStatusNormalized: deliveryStatus },
      { deliveryStatusNormalized: { $exists: false }, deliveryStatus: { $in: legacyStatuses } },
      { deliveryStatusNormalized: null, deliveryStatus: { $in: legacyStatuses } }
    ]
  };
};

const toOrderSummaryDTO = (order, transaction) => {
  const { orderStatus, paymentStatus } = mapLegacyStatuses(order, transaction);
  return {
    id: order._id,
    orderNumber: order.orderNumber || "",
    createdAt: order.createdAt,
    orderStatus,
    paymentStatus,
    total: order.total,
    currency: transaction?.currency || "USD"
  };
};

const toOrderDetailDTO = (
  order,
  transaction,
  invoice,
  shippingMethodName = null,
  skuMap = new Map()
) => {
  const { orderStatus, paymentStatus, deliveryStatus } = mapLegacyStatuses(
    order,
    transaction
  );
  let missingSkuCount = 0;
  const items = Array.isArray(order.products)
    ? order.products.map((item) => {
        const sku =
          item.sku ||
          item.productSnapshot?.sku ||
          item.product?.sku ||
          item.variant?.sku ||
          skuMap.get(String(item.productId)) ||
          null;

        if (!sku) missingSkuCount += 1;

        return {
          name: item.name,
          variantName: item.variantName || null,
          sku,
          quantity: item.quantity,
          unitPrice: item.unitPriceCharged ?? item.price,
          total: Number(((item.unitPriceCharged ?? item.price) * item.quantity).toFixed(2)),
          image: item.image || null
        };
      })
    : [];

  if (missingSkuCount > 0) {
    console.warn(
      `[Order SKU] No se pudo resolver SKU para ${missingSkuCount} item(s) (orderNumber: ${order.orderNumber || order._id})`
    );
  }

  return {
    id: order._id,
    orderNumber: order.orderNumber || "",
    createdAt: order.createdAt,
    orderStatus,
    paymentStatus,
    deliveryStatus,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone
    },
    items,
    subtotal: order.subtotal,
    tax: order.tax,
    shippingCost: order.shippingCost,
    discountAmount: order.discountAmount,
    total: order.total,
    currency: transaction?.currency || "USD",
    paymentMethod: order.paymentMethod || null,
    shipping: order.shippingAddress
      ? {
          address: order.shippingAddress,
          methodName: shippingMethodName || "Envio",
          cost: order.shippingCost
        }
      : null,
    billingInfo: order.billingInfo || null,
    taxBreakdown: order.taxBreakdown || null,
    invoiceUrl: invoice ? `/api/transaction/invoices/${invoice._id}` : null
  };
};

const getOrders = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      deliveryStatus,
      from,
      to,
      paymentMethod,
      q,
      page = 1,
      limit = 15
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 15, 100);
    const skip = (pageNum - 1) * limitNum;

    const baseMatch = {};

    const isAdmin = req.rol === "ADMIN" || req.rol === "DEV";
    if (!isAdmin) {
      baseMatch.userId = req.uid;
    }

    if (paymentMethod) baseMatch.paymentMethod = paymentMethod;
    if (paymentStatus) baseMatch.paymentStatus = paymentStatus;

    if (from || to) {
      baseMatch.createdAt = {};
      if (from) baseMatch.createdAt.$gte = new Date(from);
      if (to) baseMatch.createdAt.$lte = new Date(to);
    }

    if (q) {
      baseMatch.$or = [
        { orderNumber: new RegExp(q, "i") },
        { customerEmail: new RegExp(q, "i") }
      ];
    }

    const andFilters = [];
    if (Object.keys(baseMatch).length > 0) andFilters.push(baseMatch);
    if (status) andFilters.push(buildOrderStatusFilter(status));
    if (deliveryStatus) andFilters.push(buildDeliveryStatusFilter(deliveryStatus));

    const match = andFilters.length ? { $and: andFilters } : baseMatch;

    const [orders, total] = await Promise.all([
      orderModel
        .find(match)
        .select(
          "orderNumber createdAt orderStatus status paymentStatus total deliveryStatus deliveryStatusNormalized"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      orderModel.countDocuments(match)
    ]);

    const orderIds = orders.map((o) => o._id);
    const transactions = await transactionModel
      .find({ orderId: { $in: orderIds } })
      .sort({ createdAt: -1 })
      .select("orderId status currency")
      .lean();

    const txByOrder = new Map();
    transactions.forEach((tx) => {
      const key = String(tx.orderId);
      if (!txByOrder.has(key)) txByOrder.set(key, tx);
    });

    const dto = orders.map((order) =>
      toOrderSummaryDTO(order, txByOrder.get(String(order._id)))
    );

    return res.json({
      data: dto,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo ordenes",
      detail: error.message
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findById(id).lean();

    if (!order) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const isAdmin = req.rol === "ADMIN" || req.rol === "DEV";
    if (!isAdmin && String(order.userId) !== String(req.uid)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const [transaction, invoice, shippingMethod] = await Promise.all([
      transactionModel.findOne({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
      invoiceModel.findOne({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
      order.shippingMethod
        ? shippingMethodModel.findById(order.shippingMethod).select("empresa descripcion").lean()
        : null
    ]);

    const methodName =
      shippingMethod?.empresa || shippingMethod?.descripcion || null;

    const missingSkuItems = Array.isArray(order.products)
      ? order.products.filter((item) => !item?.sku && item?.productId)
      : [];
    const productIds = [...new Set(missingSkuItems.map((item) => String(item.productId)))];
    const skuMap = new Map();
    if (productIds.length > 0) {
      const items = await itemModel
        .find({ _id: { $in: productIds } })
        .select("_id sku")
        .lean();
      items.forEach((p) => {
        if (p.sku) skuMap.set(String(p._id), p.sku);
      });
    }

    return res.json(toOrderDetailDTO(order, transaction, invoice, methodName, skuMap));
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo orden",
      detail: error.message
    });
  }
};

const getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderModel.findOne({ orderNumber }).lean();

    if (!order) {
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const isAdmin = req.rol === "ADMIN" || req.rol === "DEV";
    if (!isAdmin && String(order.userId) !== String(req.uid)) {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const [transaction, invoice, shippingMethod] = await Promise.all([
      transactionModel.findOne({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
      invoiceModel.findOne({ orderId: order._id }).sort({ createdAt: -1 }).lean(),
      order.shippingMethod
        ? shippingMethodModel.findById(order.shippingMethod).select("empresa descripcion").lean()
        : null
    ]);

    const methodName =
      shippingMethod?.empresa || shippingMethod?.descripcion || null;

    const missingSkuItems = Array.isArray(order.products)
      ? order.products.filter((item) => !item?.sku && item?.productId)
      : [];
    const productIds = [...new Set(missingSkuItems.map((item) => String(item.productId)))];
    const skuMap = new Map();
    if (productIds.length > 0) {
      const items = await itemModel
        .find({ _id: { $in: productIds } })
        .select("_id sku")
        .lean();
      items.forEach((p) => {
        if (p.sku) skuMap.set(String(p._id), p.sku);
      });
    }

    return res.json(toOrderDetailDTO(order, transaction, invoice, methodName, skuMap));
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo orden",
      detail: error.message
    });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  getOrderByNumber,
  mapLegacyStatuses,
  toOrderSummaryDTO,
  toOrderDetailDTO
};
