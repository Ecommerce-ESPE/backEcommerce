const mongoose = require("mongoose");
const { orderModel } = require("../../models/index");
const {
  chargeCredits,
  refundCredits,
} = require("../../services/creditsPaymentService");
const {
  handlePaidOrderAnalytics,
} = require("../../services/analytics/analyticsProcessor");

const charge = async (req, res) => {
  try {
    const { orderId, amountCents, idempotencyKey, metadata } = req.body;
    const userId = req.uid;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, message: "orderId invalido" });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
    }
    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ ok: false, message: "idempotencyKey requerido" });
    }

    const order = await orderModel.findById(orderId).select("userId").lean();
    if (!order) {
      return res.status(404).json({ ok: false, message: "Orden no encontrada" });
    }
    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({
        ok: false,
        message: "No puedes cobrar creditos para otra orden",
      });
    }

    const result = await chargeCredits({
      orderId,
      userId,
      amountCents: Number(amountCents),
      idempotencyKey,
      metadata,
    });

    if (result.status === "completed") {
      await orderModel.updateOne(
        { _id: orderId },
        { $set: { status: "completed", paidAt: new Date() } },
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
      remainingCredits: result.remainingCredits,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

const refund = async (req, res) => {
  try {
    const { orderId, amountCents, idempotencyKey, reason, metadata } = req.body;
    const userId = req.uid;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ ok: false, message: "orderId invalido" });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
    }
    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ ok: false, message: "idempotencyKey requerido" });
    }

    const order = await orderModel.findById(orderId).select("userId").lean();
    if (!order) {
      return res.status(404).json({ ok: false, message: "Orden no encontrada" });
    }
    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({
        ok: false,
        message: "No puedes reembolsar creditos para otra orden",
      });
    }

    const result = await refundCredits({
      orderId,
      userId,
      amountCents: Number(amountCents),
      idempotencyKey,
      reason,
      metadata,
    });

    await orderModel.updateOne({ _id: orderId }, { $set: { status: "refunded" } });

    return res.json({
      ok: true,
      orderId,
      transactionId: result.transactionId,
      paymentStatus: result.status,
      remainingCredits: result.remainingCredits,
    });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
};

module.exports = { charge, refund };
