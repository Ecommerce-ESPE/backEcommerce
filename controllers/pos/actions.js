const mongoose = require("mongoose");
const {
  itemModel,
  transactionModel,
  serviceTicketModel,
  userModel
} = require("../../models/index");
const { validateAndPriceItems } = require("../../services/pricing/itemPricingService");
const { createOrder } = require("../../services/orders/orderService");
const { updateStock } = require("../../services/stock/stockService");
const { computeTaxSnapshot, getProductTaxRate } = require("../../utils/tax");
const { getEnabledStages } = require("../../services/operations/workflowService");
const { buildOrderNumber } = require("../../utils/numbering");
const { emitEvent } = require("../../services/socket");
const { resolveCheckoutData } = require("../../services/pos/checkoutMode");

const sendError = (res, status, message, code) =>
  res.status(status).json({
    ok: false,
    data: null,
    message,
    ...(code ? { code } : {})
  });

const createPosOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const payload = req.body || {};

    const {
      items,
      customer,
      discountCode,
      payment,
      ticketId
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        ok: false,
        data: null,
        message: "items es requerido"
      });
    }

    const {
      itemsWithPrices,
      discountAmount,
      discountPercentage,
      discountedSubtotal
    } = await validateAndPriceItems(items, discountCode, session);

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
      const ivaRateApplied = getProductTaxRate(req.tenantConfig, product, nowISO);
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
      config: req.tenantConfig,
      shipping: 0
    });

    const subtotal = taxBreakdown.totals.subtotal;
    const tax = taxBreakdown.totals.totalTax;
    const total = taxBreakdown.totals.total;
    const orderNumber = await buildOrderNumber(
      tenantId,
      branchId,
      req.tenantConfig?.numbers?.orderNumber?.format
    );

    let ticket = null;
    if (req.tenantConfig?.modules?.queuesTickets) {
      if (!ticketId) {
        await session.abortTransaction();
        return sendError(res, 400, "ticketId es requerido", "TICKET_REQUIRED");
      }
      ticket = await serviceTicketModel
        .findOne({ _id: ticketId, tenantId, branchId })
        .lean();
      if (!ticket) {
        await session.abortTransaction();
        return sendError(res, 404, "Ticket no encontrado", "TICKET_NOT_FOUND");
      }
    }

    let checkoutData;
    try {
      checkoutData = resolveCheckoutData({
        tenantConfig: req.tenantConfig,
        ticket,
        ticketId,
        tenantId,
        branchId,
        defaultQueueKey: "checkout"
      });
    } catch (err) {
      await session.abortTransaction();
      return sendError(res, err.status || 400, err.message, err.code);
    }

    const finalConsumerId = "99999999999999";
    const isFinalConsumer =
      customer?.finalConsumer === true ||
      customer?.idNumber === finalConsumerId;

    const resolvedCustomer = isFinalConsumer
      ? {
          userId: req.uid,
          name: "CONSUMIDOR FINAL",
          email: "consumidor@final.com",
          phone: "0999999999",
          idNumber: finalConsumerId
        }
      : customer || {
          userId: req.uid,
          name: "Cliente POS",
          email: "pos@local.com",
          phone: "N/A"
        };

    const order = await createOrder({
      items: itemsWithPrices,
      customer: resolvedCustomer,
      discountAmount,
      subtotal,
      tax,
      total,
      taxBreakdown,
      shipping: null,
      payment: payment || { method: "cash" },
      paymentStatus: "paid",
      status: "completed",
      paidAt: new Date(),
      session,
      discountCode: discountCode || null,
      tenantId,
      branchId,
      orderNumber,
      ticketId: checkoutData.ticketId,
      checkoutMode: checkoutData.checkoutMode,
      checkoutSessionId: checkoutData.checkoutSessionId,
      queueKey: checkoutData.queueKey,
      customerIdNumber: resolvedCustomer?.idNumber || null,
      allowNoShipping: true
    });

    const stages = getEnabledStages(req.tenantConfig);
    if (stages.length > 0) {
      await order.updateOne({
        $set: {
          workflowId: req.tenantConfig?.operations?.workflow?.id || "default",
          currentStageKey: stages[0].key
        },
        $push: {
          stageHistory: {
            stageKey: stages[0].key,
            role: stages[0].role,
            status: "PENDING"
          }
        }
      });
    }

    const user = await userModel.findById(req.uid).select("name email").lean();
    const authorizedBy = user?.name || user?.email || null;

    const transaction = new transactionModel({
      tenantId,
      branchId,
      orderId: order._id,
      method: payment?.method || "cash",
      amount: total,
      status: "completed",
      history: [
        {
          status: "completed",
          timestamp: new Date(),
          message: "Pago POS"
        }
      ],
      metadata: authorizedBy ? { authorizedBy } : undefined,
      taxBreakdown: taxBreakdown || null
    });
    await transaction.save({ session });

    await updateStock(itemsWithPrices, session);

    if (checkoutData.ticketId) {
      await serviceTicketModel.updateOne(
        { _id: checkoutData.ticketId },
        { $set: { status: "CLOSED", closedAt: new Date() } },
        { session }
      );
      emitEvent("tickets:update", {
        action: "CLOSED",
        tenantId,
        branchId,
        ticketId: checkoutData.ticketId
      });
    }

    await session.commitTransaction();

    emitEvent("orders:created", {
      tenantId,
      branchId,
      orderId: order._id,
      orderNumber: order.orderNumber || "",
      currentStageKey: order.currentStageKey
    });

    return res.json({
      ok: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber || "",
        transactionId: transaction._id
      },
      message: "Orden POS creada"
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("[POS] Error creando orden", {
      message: error.message,
      stack: error.stack,
      tenantId: req.tenantId,
      branchId: req.branchId,
      userId: req.uid,
      ticketId: req.body?.ticketId
    });
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error creando orden POS"
    });
  } finally {
    session.endSession();
  }
};

module.exports = { createPosOrder };
