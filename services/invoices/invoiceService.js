const { invoiceModel } = require("../../models/index");

const buildQrData = ({ tenantId, invoiceNumber, accessKey }) => {
  if (accessKey) {
    return `SRI|${accessKey}`;
  }
  return `INVOICE|${tenantId || "DEFAULT"}|${invoiceNumber || ""}`;
};

const createInvoice = async (
  order,
  transaction,
  status,
  discountPercentage,
  session,
  tenantConfig,
  branch,
) => {
  const taxBreakdown = order.taxBreakdown || null;
  const totals = taxBreakdown?.totals || {};

  const originalSubtotal = order.products.reduce((sum, item) => {
    const priceWithDiscount = Number(item.price);
    const originalPrice = discountPercentage
      ? priceWithDiscount / (1 - discountPercentage / 100)
      : priceWithDiscount;
    return sum + originalPrice * item.quantity;
  }, 0);

  const invoiceData = {
    tenantId: order.tenantId || "DEFAULT",
    branchId: order.branchId || "DEFAULT",
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
    orderNumber: order.orderNumber || "",
    subtotal: totals.subtotal ?? order.subtotal,
    tax: totals.totalTax ?? order.tax,
    shippingCost: totals.shipping ?? order.shippingCost,
    discount: order.discountAmount,
    discountPercentage: discountPercentage || 0,
    originalSubtotal: originalSubtotal,
    total: totals.total ?? order.total,
    status: status || "ISSUED",
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    tenantSnapshot: {
      name: tenantConfig?.business?.name || "",
      ruc: tenantConfig?.business?.ruc || "",
      legalName: tenantConfig?.business?.name || "",
      commercialName: tenantConfig?.business?.name || "",
      branding: {
        logoUrl: tenantConfig?.branding?.logoUrl || "",
        theme: tenantConfig?.branding?.theme || null
      }
    },
    branchSnapshot: {
      branchId: branch?.branchId || order.branchId || "",
      name: branch?.name || "",
      address: branch?.address?.line1 || "",
      establishmentCode: branch?.invoicing?.establishmentCode || "",
      emissionPoint: branch?.invoicing?.emissionPoint || ""
    },
    customerSnapshot: {
      name: order.customerName || "",
      idNumber: order.customerIdNumber || "",
      email: order.customerEmail || "",
      phone: order.customerPhone || "",
      address: order.shippingAddress?.callePrincipal || ""
    },
    termsAndConditions: tenantConfig?.invoice?.termsAndConditions || "",
    showShippingAddress:
      tenantConfig?.invoice?.showShippingAddress !== undefined
        ? tenantConfig.invoice.showShippingAddress
        : true,
    showBranchInfo:
      tenantConfig?.invoice?.showBranchInfo !== undefined
        ? tenantConfig.invoice.showBranchInfo
        : true,
    sriSnapshot: {
      enabled: tenantConfig?.invoice?.sri?.enabled || false,
      environment: tenantConfig?.invoice?.sri?.environment || "",
      emissionType: tenantConfig?.invoice?.sri?.emissionType || "",
      obligatedAccounting: tenantConfig?.invoice?.sri?.obligatedAccounting || "",
      specialContributor: tenantConfig?.invoice?.sri?.specialContributor || "",
      mainOfficeAddress: tenantConfig?.invoice?.sri?.mainOfficeAddress || "",
      authorizationNumber: tenantConfig?.invoice?.sri?.authorizationNumber || "",
      accessKey: tenantConfig?.invoice?.sri?.accessKey || ""
    },
    taxBreakdown: taxBreakdown || null,
    companyDetails: {
      name:
        branch?.invoicing?.commercialName ||
        tenantConfig?.business?.name ||
        "Mi Tienda",
      address:
        branch?.invoicing?.addressForInvoice ||
        branch?.address?.line1 ||
        "Av. Principal 123",
      phone: branch?.contact?.phone || "0999999999",
      email: branch?.contact?.email || "ventas@mitienda.com",
      logoUrl:
        tenantConfig?.branding?.logoUrl || "../../storage/logo.svg",
    },
  };

  const invoice = new invoiceModel(invoiceData);
  const saved = await invoice.save({ session });
  const qrData = buildQrData({
    tenantId: saved.tenantId,
    invoiceNumber: saved.invoiceNumber,
    accessKey: saved.sriSnapshot?.accessKey
  });
  if (qrData) {
    await invoiceModel.updateOne(
      { _id: saved._id },
      { $set: { qrData } },
      { session }
    );
    saved.qrData = qrData;
  }
  return saved;
};

module.exports = {
  createInvoice,
};
