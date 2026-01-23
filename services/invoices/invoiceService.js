const { invoiceModel } = require("../../models/index");

const createInvoice = async (
  order,
  transaction,
  status,
  discountPercentage,
  session,
) => {
  const originalSubtotal = order.products.reduce((sum, item) => {
    const priceWithDiscount = Number(item.price);
    const originalPrice = discountPercentage
      ? priceWithDiscount / (1 - discountPercentage / 100)
      : priceWithDiscount;
    return sum + originalPrice * item.quantity;
  }, 0);

  const invoiceData = {
    orderId: order._id,
    transactionId: transaction._id,
    items: order.products.map((item) => ({
      product: item.productId,
      variant: item.variantId,
      name: item.name,
      variantName: item.variantName,
      price: item.price,
      unitPriceCharged: item.unitPriceCharged ?? item.price,
      originalPrice: item.originalPrice ?? null,
      pricingSource: item.pricingSource || "none",
      promoPercentageApplied: item.promoPercentageApplied || 0,
      promoId: item.promoId || null,
      quantity: item.quantity,
      total: item.price * item.quantity,
    })),
    subtotal: order.subtotal,
    tax: order.tax,
    shippingCost: order.shippingCost,
    discount: order.discountAmount,
    discountPercentage: discountPercentage || 0,
    originalSubtotal: originalSubtotal,
    total: order.total,
    status,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    companyDetails: {
      name: "Mi Tienda",
      address: "Av. Principal 123",
      phone: "0999999999",
      email: "ventas@mitienda.com",
      logoUrl: "../../storage/logo.svg",
    },
  };

  const invoice = new invoiceModel(invoiceData);
  return await invoice.save({ session });
};

module.exports = {
  createInvoice,
};
