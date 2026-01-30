require("dotenv").config();
const mongoose = require("mongoose");
const { orderModel, transactionModel } = require("../models/index");

const mapLegacyOrderStatus = (status) => {
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

const mapLegacyPaymentStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "success":
    case "completed":
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "pending":
    case "processing":
      return "pending";
    default:
      return "pending";
  }
};

const mapLegacyDeliveryStatus = (legacyStatus, hasShipping) => {
  if (!hasShipping) return "none";
  switch (legacyStatus) {
    case "READY":
      return "assigned";
    case "OUT_FOR_DELIVERY":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "NONE":
    default:
      return "none";
  }
};

const run = async () => {
  const DB_URI = process.env.DB_URI;
  if (!DB_URI) {
    console.error("DB_URI no definido");
    process.exit(1);
  }

  await mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const query = {
    $or: [
      { orderStatus: { $exists: false } },
      { orderStatus: null },
      { paymentStatus: { $exists: false } },
      { paymentStatus: null },
      { deliveryStatusNormalized: { $exists: false } },
      { deliveryStatusNormalized: null }
    ]
  };

  const cursor = orderModel
    .find(query)
    .select("_id status orderStatus paymentStatus deliveryStatus deliveryStatusNormalized shippingAddress")
    .lean()
    .cursor();

  const bulk = [];
  let processed = 0;

  for await (const order of cursor) {
    const update = {};

    if (!order.orderStatus) {
      update.orderStatus = mapLegacyOrderStatus(order.status);
    }

    if (!order.paymentStatus) {
      const tx = await transactionModel
        .findOne({ orderId: order._id })
        .sort({ createdAt: -1 })
        .select("status")
        .lean();
      update.paymentStatus = mapLegacyPaymentStatus(tx?.status);
    }

    if (!order.deliveryStatusNormalized) {
      const hasShipping = !!order.shippingAddress;
      update.deliveryStatusNormalized = mapLegacyDeliveryStatus(order.deliveryStatus, hasShipping);
    }

    if (Object.keys(update).length > 0) {
      bulk.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: update }
        }
      });
    }

    if (bulk.length >= 200) {
      await orderModel.bulkWrite(bulk);
      bulk.length = 0;
    }

    processed += 1;
    if (processed % 500 === 0) {
      console.log(`Procesadas ${processed} ordenes...`);
    }
  }

  if (bulk.length > 0) {
    await orderModel.bulkWrite(bulk);
  }

  console.log(`Backfill completado. Ordenes procesadas: ${processed}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Error en backfill:", error);
  process.exit(1);
});
