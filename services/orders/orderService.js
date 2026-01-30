const { orderModel, shippingMethodModel } = require("../../models/index");

const normalizeOrderStatusFromLegacy = (status) => {
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

const resolveDeliveryStatusNormalized = (shipping, allowNoShipping) => {
  if (allowNoShipping || !shipping?.address) return "none";
  return "none";
};

const calculateShippingCost = async (methodId, session) => {
  if (!methodId) return 0;

  const method = await shippingMethodModel.findById(methodId).session(session);
  if (!method) throw new Error("MÃ©todo de envÃ­o no encontrado");

  return method.costo || 0;
};

const createOrder = async ({
  items,
  customer,
  discountAmount,
  subtotal,
  tax,
  total,
  taxBreakdown,
  shipping,
  payment,
  session,
  status = "pending",
  paidAt = null,
  discountCode = null,
  tenantId = "DEFAULT",
  branchId = "DEFAULT",
  orderNumber = null,
  billingInfo = null,
  customerIdNumber = null,
  ticketId = null,
  checkoutMode = null,
  checkoutSessionId = null,
  queueKey = null,
  allowNoShipping = false,
  orderStatus = null,
  paymentStatus = null,
  deliveryStatusNormalized = null
}) => {
  if (!allowNoShipping) {
    if (!shipping) throw new Error("Se requiere la informaciÃ³n de envÃ­o");
    if (!shipping.address) throw new Error("La direcciÃ³n de envÃ­o es requerida");
  }

  if (!allowNoShipping) {
    const requiredAddressFields = ["provincia", "canton", "callePrincipal"];
    const missingFields = requiredAddressFields.filter(
      (field) => !shipping.address[field],
    );
    if (missingFields.length > 0) {
      throw new Error(
        `Faltan campos requeridos en la direcciÃ³n: ${missingFields.join(", ")}`,
      );
    }
  }

  const orderItems = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    name: item.name || `Producto ${item.productId}`,
    variantName: item.variantName || "",
    price: item.unitPriceCharged ?? item.price,
    unitPriceCharged: item.unitPriceCharged ?? item.price,
    originalPrice: item.originalPrice,
    quantity: item.quantity,
    image: item.image || null,
    pricingSource: item.pricingSource || "none",
    promoPercentageApplied: item.promoPercentageApplied || 0,
    promoId: item.promoId || null,
  }));

  const order = new orderModel({
    tenantId,
    branchId,
    ...(orderNumber ? { orderNumber } : {}),
    userId: customer.userId,
    customerName: customer.name,
    customerEmail: customer.email,
    customerIdNumber: customerIdNumber || customer.idNumber || "",
    customerPhone: customer.phone,
    products: orderItems,
    subtotal,
    tax,
    shippingCost: shipping?.cost || 0,
    discountAmount: discountAmount || 0,
    total,
    taxBreakdown: taxBreakdown || null,
    ...(ticketId ? { ticketId } : {}),
    checkoutMode: checkoutMode || "ONLINE",
    ...(checkoutSessionId ? { checkoutSessionId } : {}),
    ...(queueKey ? { queueKey } : {}),
    discountCode: discountCode || null,
    paymentMethod: payment.method,
    orderStatus: orderStatus || normalizeOrderStatusFromLegacy(status),
    paymentStatus: paymentStatus || "pending",
    deliveryStatusNormalized:
      deliveryStatusNormalized || resolveDeliveryStatusNormalized(shipping, allowNoShipping),
    ...(shipping?.methodId ? { shippingMethod: shipping.methodId } : {}),
    ...(shipping?.address
      ? {
          shippingAddress: {
            provincia: shipping.address.provincia || "N/A",
            canton: shipping.address.canton || "N/A",
            callePrincipal: shipping.address.callePrincipal || "N/A",
            ...(shipping.address.parroquia && { parroquia: shipping.address.parroquia }),
            ...(shipping.address.numeroCasa && { numeroCasa: shipping.address.numeroCasa }),
            ...(shipping.address.referencia && { referencia: shipping.address.referencia }),
            codigoPostal: shipping.address.codigoPostal || "",
          }
        }
      : {}),
    billingInfo: billingInfo || {
      name: customer.name || "",
      idNumber: customerIdNumber || customer.idNumber || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: shipping?.address?.callePrincipal || ""
    },
    status,
    ...(paidAt ? { paidAt } : {}),
    ...(payment.details && { paymentDetails: payment.details }),
  });

  return await order.save({ session });
};

const updateOrderStatus = async (orderId, status, session, paymentStatus = null) => {
  const update = {
    status,
    orderStatus: normalizeOrderStatusFromLegacy(status)
  };
  if (paymentStatus) {
    update.paymentStatus = paymentStatus;
  }
  await orderModel.findByIdAndUpdate(orderId, update, { session });
};

module.exports = {
  calculateShippingCost,
  createOrder,
  updateOrderStatus,
};
