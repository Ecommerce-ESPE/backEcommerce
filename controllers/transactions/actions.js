const mongoose = require("mongoose");
const Decimal = require("decimal.js");

const {
  orderModel,
  transactionModel,
  itemModel
} = require("../../models/index");

const { validateTransactionData } = require("../../utils/validation/transactionValidation");
const { validateAndPriceItems } = require("../../services/pricing/itemPricingService");
const { calculateShippingCost, createOrder, updateOrderStatus } = require("../../services/orders/orderService");
const { processPayment } = require("../../services/payments/paymentService");
const { createInvoice } = require("../../services/invoices/invoiceService");
const { updateStock } = require("../../services/stock/stockService");
const { handlePaidOrderAnalytics } = require("../../services/analytics/analyticsProcessor");
const { computeTaxSnapshot, getProductTaxRate } = require("../../utils/tax");
const { buildOrderNumber } = require("../../utils/numbering");

const resolveCheckoutMode = (req) => {
  const origin = String(req.header("x-checkout-origin") || "")
    .trim()
    .toLowerCase();

  if (origin === "pos" || origin === "direct") return "DIRECT";
  if (origin === "ticket") return "TICKET";
  if (origin === "online" || origin === "web") return "ONLINE";

  return "ONLINE";
};

const normalizePaymentStatus = (paymentResult) => {
  const status = String(paymentResult?.status || "").toLowerCase();
  if (status === "refunded") return "refunded";
  if (status === "failed") return "failed";
  if (status === "pending" || status === "processing") return "pending";
  if (paymentResult?.success) return "paid";
  return "failed";
};

const initializeWorkflow = async (orderId, tenantConfig) => {
  const stages = (tenantConfig?.operations?.workflow?.stages || []).filter(
    (stage) => stage.enabled !== false
  );
  if (stages.length === 0) return;
  const first = stages[0];
  await orderModel.updateOne(
    { _id: orderId, currentStageKey: null },
    {
      $set: {
        workflowId: tenantConfig?.operations?.workflow?.id || "default",
        currentStageKey: first.key
      },
      $push: {
        stageHistory: {
          stageKey: first.key,
          role: first.role,
          status: "PENDING"
        }
      }
    }
  );
};

const processTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transactionData = req.body;

    const validationErrors = validateTransactionData(transactionData);
    if (validationErrors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: validationErrors.join(" "),
        errorType: "validation_error",
      });
    }

    const shippingCost = await calculateShippingCost(
      transactionData.order.shipping.methodId,
      session,
    );

    const {
      itemsWithPrices,
      discountAmount,
      discountPercentage,
      discountMessage,
      discountedSubtotal,
    } = await validateAndPriceItems(
      transactionData.order.items,
      transactionData.discountCode,
      session,
    );

    const tenantConfig = req.tenantConfig;
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const orderNumber = await buildOrderNumber(
      tenantId,
      branchId,
      tenantConfig?.numbers?.orderNumber?.format
    );

    const productIds = itemsWithPrices.map((item) => item.productId);
    const products = await itemModel
      .find({ _id: { $in: productIds } })
      .select("category tags sku nameProduct")
      .lean();

    const productMap = new Map(
      products.map((product) => [String(product._id), product])
    );

    const nowISO = new Date().toISOString();
    const itemsForTax = itemsWithPrices.map((item) => {
      const product = productMap.get(String(item.productId)) || {};
      const ivaRateApplied = getProductTaxRate(tenantConfig, product, nowISO);
      return {
        productId: item.productId,
        name: item.name || product.nameProduct,
        sku: product.sku,
        qty: item.quantity,
        unitPrice: item.price,
        ivaRateApplied
      };
    });

    const taxBreakdown = computeTaxSnapshot({
      items: itemsForTax,
      dateISO: nowISO,
      config: tenantConfig,
      shipping: shippingCost
    });

    if (taxBreakdown?.strategy && taxBreakdown.strategy !== "ecuador_iva") {
      console.warn(
        `[Tax] Estrategia inesperada: ${taxBreakdown.strategy} (orderNumber: ${orderNumber})`
      );
    }

    const subtotal = taxBreakdown.totals.subtotal;
    const tax = taxBreakdown.totals.totalTax;
    const total = taxBreakdown.totals.total;

    const isCredits = transactionData.payment.method === "credits";
    const checkoutMode = resolveCheckoutMode(req);

    let paymentResult = null;
    let order = null;
    let isPaid = false;
    let orderStatus = "pending";
    let orderPaidAt = null;

    if (isCredits) {
      order = await createOrder({
        items: itemsWithPrices,
        customer: transactionData.customer,
        discountAmount,
        subtotal,
        tax,
        total,
        taxBreakdown,
        shipping: {
          methodId: transactionData.order.shipping.methodId,
          address: transactionData.order.shipping.address,
          cost: shippingCost,
        },
        checkoutMode,
        payment: transactionData.payment,
        status: "pending",
        session,
        discountCode: transactionData.discountCode || null,
        tenantId,
        branchId,
        orderNumber,
        billingInfo: transactionData.billingInfo || null,
        customerIdNumber: transactionData.customer?.idNumber || null
      });

      await initializeWorkflow(order._id, tenantConfig);

      const amountCents = Math.round(total * 100);
      const idempotencyKey = `order:${order._id}:credits`;

      paymentResult = await processPayment(
        transactionData.payment,
        total,
        session,
        {
          orderId: order._id,
          userId: transactionData.customer.userId,
          amountCents,
          idempotencyKey,
        },
      );

      if (!paymentResult.success) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: paymentResult.error || "Pago fallido",
          paymentStatus: paymentResult.errorCode,
          errorType: "payment_failed",
        });
      }

      isPaid =
        paymentResult.success &&
        ["completed", "paid"].includes(String(paymentResult.status));

      orderStatus = isPaid
        ? "completed"
        : paymentResult.success
          ? "processing"
          : "failed";

      orderPaidAt = isPaid ? new Date() : null;

      const paymentStatus = normalizePaymentStatus(paymentResult);

      await updateOrderStatus(order._id, orderStatus, session, paymentStatus);

      if (orderPaidAt) {
        await orderModel.updateOne(
          { _id: order._id },
          { $set: { paidAt: orderPaidAt } },
          { session },
        );
      }
    } else {
      paymentResult = await processPayment(
        transactionData.payment,
        total,
        session,
        { orderId: null },
      );

      if (!paymentResult.success) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: paymentResult.error || "Pago fallido",
          paymentStatus: paymentResult.errorCode,
          errorType: "payment_failed",
        });
      }

      isPaid =
        paymentResult.success &&
        ["completed", "paid"].includes(String(paymentResult.status));

      orderStatus = isPaid
        ? "completed"
        : paymentResult.success
          ? "processing"
          : "failed";

      orderPaidAt = isPaid ? new Date() : null;

      order = await createOrder({
        items: itemsWithPrices,
        customer: transactionData.customer,
        discountAmount,
        subtotal,
        tax,
        total,
        taxBreakdown,
        shipping: {
          methodId: transactionData.order.shipping.methodId,
          address: transactionData.order.shipping.address,
          cost: shippingCost,
        },
        checkoutMode,
        paymentStatus: normalizePaymentStatus(paymentResult),
        payment: transactionData.payment,
        status: orderStatus,
        paidAt: orderPaidAt,
        session,
        discountCode: transactionData.discountCode || null,
        tenantId,
        branchId,
        orderNumber,
        billingInfo: transactionData.billingInfo || null,
        customerIdNumber: transactionData.customer?.idNumber || null
      });

      await initializeWorkflow(order._id, tenantConfig);
    }

    const transaction = await createTransaction(
      order._id,
      transactionData.payment,
      paymentResult,
      total,
      taxBreakdown,
      tenantId,
      branchId,
      { session },
    );

    if (order && Math.abs(Number(order.total) - Number(total)) > 0.01) {
      console.warn(
        `[Order/Tx] Total inconsistente: order.total=${order.total}, calculated=${total}, orderId=${order._id}`
      );
    }

    if (paymentResult.success) {
      await updateStock(itemsWithPrices, session);
    }

    const invoice = await createInvoice(
      order,
      transaction,
      paymentResult.success ? "paid" : "failed",
      discountPercentage,
      session,
      tenantConfig,
      req.branch
    );

    await session.commitTransaction();

    if (isPaid) {
      try {
        await handlePaidOrderAnalytics(order._id);
      } catch (error) {
        console.error("[Analytics] Error procesando venta:", error.message);
      }
    }

    return res.json({
      success: true,
      orderId: order._id,
      transactionId: transaction._id,
      invoiceId: invoice._id,
      total: total.toFixed(2),
      discountApplied: discountAmount,
      discountMessage: discountMessage || null,
      paymentStatus: paymentResult.success ? "completed" : "failed",
      ...(transactionData.payment.method === "credits" && {
        remainingCredits: Number((paymentResult.remainingCredits || 0).toFixed(2)),
      }),
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Transaction Error:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({
      success: false,
      error: error.message,
      errorType: "transaction_failed",
      ...(error.code && { errorCode: error.code }),
    });
  } finally {
    session.endSession();
  }
};

const createTransaction = async (
  orderId,
  paymentData,
  paymentResult,
  amount,
  taxBreakdown,
  tenantId,
  branchId,
  options = {},
) => {
  const status =
    paymentResult.status || (paymentResult.success ? "completed" : "failed");

  const transaction = new transactionModel({
    tenantId: tenantId || "DEFAULT",
    branchId: branchId || "DEFAULT",
    orderId,
    method: paymentData.method,
    amount,
    status,
    gatewayTransactionId: paymentResult.transactionId,
    taxBreakdown: taxBreakdown || null,
    history: [
      {
        status,
        timestamp: new Date(),
        message: paymentResult.message || `Pago ${status}`,
      },
    ],
    ...(paymentResult.error && {
      errorMessage: paymentResult.error,
      errorCode: paymentResult.errorCode,
    }),
  });

  return await transaction.save(options);
};

module.exports = {
  processTransaction,
};
