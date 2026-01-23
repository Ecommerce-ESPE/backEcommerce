const { orderModel } = require("../../models/index");
const { recordHistoricalSales } = require("./historicalAnalyticsService");
const { recordRealtimeSales, buildRealtimePayload } = require("./realtimeAnalyticsService");
const { getIO } = require("../socket");

const PAID_STATUSES = ["completed", "paid"];

const claimOrderForAnalytics = async (orderId) => {
  return orderModel.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: PAID_STATUSES },
      analyticsProcessed: { $ne: true },
      analyticsProcessing: { $ne: true }
    },
    { $set: { analyticsProcessing: true } },
    { new: true }
  );
};

const releaseOrderClaim = async (orderId, success, paidAt) => {
  if (success) {
    await orderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          analyticsProcessed: true,
          analyticsProcessing: false,
          analyticsProcessedAt: new Date(),
          ...(paidAt ? { paidAt } : {})
        }
      }
    );
  } else {
    await orderModel.updateOne(
      { _id: orderId },
      { $set: { analyticsProcessing: false } }
    );
  }
};

const handlePaidOrderAnalytics = async (orderId) => {
  const claimed = await claimOrderForAnalytics(orderId);
  if (!claimed) return null;

  const paidAt = claimed.paidAt || new Date();
  let payload = null;

  try {
    await recordHistoricalSales(claimed, paidAt);
    await recordRealtimeSales(claimed, paidAt);
    payload = await buildRealtimePayload();

    await releaseOrderClaim(orderId, true, paidAt);

    try {
      const io = getIO();
      io.to("admins").emit("analytics:update", payload);
    } catch (error) {
      // Socket no inicializado o fallo puntual; no bloquea analytics
    }
  } catch (error) {
    await releaseOrderClaim(orderId, false);
    throw error;
  }

  return payload;
};

module.exports = { handlePaidOrderAnalytics };
