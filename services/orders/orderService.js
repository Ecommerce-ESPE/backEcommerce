const { orderModel, shippingMethodModel } = require("../../models/index");

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
  shipping,
  payment,
  session,
  status = "pending",
  paidAt = null,
  discountCode = null,
}) => {
  if (!shipping) throw new Error("Se requiere la informaciÃ³n de envÃ­o");
  if (!shipping.address) throw new Error("La direcciÃ³n de envÃ­o es requerida");

  const requiredAddressFields = ["provincia", "canton", "callePrincipal"];
  const missingFields = requiredAddressFields.filter(
    (field) => !shipping.address[field],
  );
  if (missingFields.length > 0) {
    throw new Error(
      `Faltan campos requeridos en la direcciÃ³n: ${missingFields.join(", ")}`,
    );
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
    userId: customer.userId,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    products: orderItems,
    subtotal,
    tax,
    shippingCost: shipping.cost,
    discountAmount: discountAmount || 0,
    total,
    discountCode: discountCode || null,
    paymentMethod: payment.method,
    shippingMethod: shipping.methodId,
    shippingAddress: {
      provincia: shipping.address.provincia,
      canton: shipping.address.canton,
      callePrincipal: shipping.address.callePrincipal,
      ...(shipping.address.parroquia && { parroquia: shipping.address.parroquia }),
      ...(shipping.address.numeroCasa && { numeroCasa: shipping.address.numeroCasa }),
      ...(shipping.address.referencia && { referencia: shipping.address.referencia }),
      codigoPostal: shipping.address.codigoPostal || "",
    },
    status,
    ...(paidAt ? { paidAt } : {}),
    ...(payment.details && { paymentDetails: payment.details }),
  });

  return await order.save({ session });
};

const updateOrderStatus = async (orderId, status, session) => {
  await orderModel.findByIdAndUpdate(orderId, { status }, { session });
};

module.exports = {
  calculateShippingCost,
  createOrder,
  updateOrderStatus,
};
