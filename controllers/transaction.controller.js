const mongoose = require("mongoose");
const Decimal = require("decimal.js");

const {
  orderModel,
  transactionModel,
} = require("../models/index");

const { validateTransactionData } = require("../utils/validation/transactionValidation");
const { validateAndPriceItems } = require("../services/pricing/itemPricingService");
const { calculateShippingCost, createOrder, updateOrderStatus } = require("../services/orders/orderService");
const { processPayment } = require("../services/payments/paymentService");
const { createInvoice } = require("../services/invoices/invoiceService");
const { updateStock } = require("../services/stock/stockService");
const { handlePaidOrderAnalytics } = require("../services/analytics/analyticsProcessor");

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

    const taxRate = 0.12;
    const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
    const total = Math.round(
      (discountedSubtotal + tax + shippingCost) * 100,
    ) / 100;

    const isCredits = transactionData.payment.method === "credits";

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
        subtotal: discountedSubtotal,
        tax,
        total,
        shipping: {
          methodId: transactionData.order.shipping.methodId,
          address: transactionData.order.shipping.address,
          cost: shippingCost,
        },
        payment: transactionData.payment,
        status: "pending",
        session,
        discountCode: transactionData.discountCode || null,
      });

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

      await updateOrderStatus(order._id, orderStatus, session);

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
        subtotal: discountedSubtotal,
        tax,
        total,
        shipping: {
          methodId: transactionData.order.shipping.methodId,
          address: transactionData.order.shipping.address,
          cost: shippingCost,
        },
        payment: transactionData.payment,
        status: orderStatus,
        paidAt: orderPaidAt,
        session,
        discountCode: transactionData.discountCode || null,
      });
    }

    const transaction = await createTransaction(
      order._id,
      transactionData.payment,
      paymentResult,
      total,
      { session },
    );

    if (paymentResult.success) {
      await updateStock(itemsWithPrices, session);
    }

    const invoice = await createInvoice(
      order,
      transaction,
      paymentResult.success ? "paid" : "failed",
      discountPercentage,
      session,
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
  options = {},
) => {
  const status =
    paymentResult.status || (paymentResult.success ? "completed" : "failed");

  const transaction = new transactionModel({
    orderId,
    method: paymentData.method,
    amount,
    status,
    gatewayTransactionId: paymentResult.transactionId,
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
