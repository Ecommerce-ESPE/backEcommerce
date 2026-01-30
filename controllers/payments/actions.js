const mongoose = require("mongoose");
const { orderModel } = require("../../models/index");
const { chargeCredits, refundCredits } = require("../../services/creditsPaymentService");
const { handlePaidOrderAnalytics } = require("../../services/analytics/analyticsProcessor");

const charge = async (req, res) => {
  try {
    const { orderId, userId, amountCents, idempotencyKey, metadata } = req.body;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, message: "orderId inválido" });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, message: "userId inválido" });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ ok: false, message: "idempotencyKey requerido" });
    }

    const result = await chargeCredits({
      orderId,
      userId,
      amountCents: Number(amountCents),
      idempotencyKey,
      metadata
    });

    if (result.status === "completed") {
      await orderModel.updateOne(
        { _id: orderId },
        { $set: { status: "completed", paidAt: new Date() } }
      );

      try {
        await handlePaidOrderAnalytics(orderId);
      } catch (error) {
        console.error("[Analytics] Error procesando venta:", error.message);
      }
    }

    return res.json({
      ok: true,
      orderId,
      transactionId: result.transactionId,
      paymentStatus: result.status,
      remainingCredits: result.remainingCredits
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

const refund = async (req, res) => {
  try {
    const { orderId, userId, amountCents, idempotencyKey, reason, metadata } = req.body;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, message: "orderId inválido" });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, message: "userId inválido" });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ ok: false, message: "idempotencyKey requerido" });
    }

    const result = await refundCredits({
      orderId,
      userId,
      amountCents: Number(amountCents),
      idempotencyKey,
      reason,
      metadata
    });

    await orderModel.updateOne(
      { _id: orderId },
      { $set: { status: "refunded" } }
    );

    return res.json({
      ok: true,
      orderId,
      transactionId: result.transactionId,
      paymentStatus: result.status,
      remainingCredits: result.remainingCredits
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

module.exports = { charge, refund };
