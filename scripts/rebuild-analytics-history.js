require("dotenv").config();

const mongoose = require("mongoose");
const { connectDB } = require("../config/config");
const {
  orderModel,
  salesItemModel,
  salesSummaryDailyModel,
  realtimeProductMinuteModel,
  realtimeCategoryMinuteModel,
  realtimeTotalsMinuteModel,
} = require("../models");
const { handlePaidOrderAnalytics } = require("../services/analytics/analyticsProcessor");

const PAID_STATUSES = ["completed", "paid"];

const ensureSalesSummaryIndexes = async () => {
  const collection = salesSummaryDailyModel.collection;
  const indexes = await collection.indexes();
  const legacyUniqueName = "day_1_granularity_1_productId_1_categoryId_1_subcategoryId_1";
  const hasLegacyUnique = indexes.some((idx) => idx.name === legacyUniqueName);

  if (hasLegacyUnique) {
    console.log("[analytics-rebuild] Eliminando indice unico legacy...");
    await collection.dropIndex(legacyUniqueName);
  }

  console.log("[analytics-rebuild] Creando indice unico actualizado...");
  await collection.createIndex(
    {
      day: 1,
      granularity: 1,
      productId: 1,
      categoryId: 1,
      subcategoryId: 1,
      brandId: 1
    },
    { unique: true, name: "day_1_granularity_1_productId_1_categoryId_1_subcategoryId_1_brandId_1" }
  );

  console.log("[analytics-rebuild] Asegurando indice day+granularity...");
  await collection.createIndex({ day: 1, granularity: 1 }, { name: "day_1_granularity_1" });
};

const run = async () => {
  const shouldCleanRealtime = process.argv.includes("--clean-realtime");

  await connectDB();
  await ensureSalesSummaryIndexes();

  console.log("[analytics-rebuild] Limpiando tablas historicas...");
  await salesItemModel.deleteMany({});
  await salesSummaryDailyModel.deleteMany({});

  if (shouldCleanRealtime) {
    console.log("[analytics-rebuild] Limpiando tablas realtime...");
    await realtimeProductMinuteModel.deleteMany({});
    await realtimeCategoryMinuteModel.deleteMany({});
    await realtimeTotalsMinuteModel.deleteMany({});
  }

  console.log("[analytics-rebuild] Reseteando flags de ordenes pagadas...");
  await orderModel.updateMany(
    { status: { $in: PAID_STATUSES } },
    {
      $set: {
        analyticsProcessed: false,
        analyticsProcessing: false
      },
      $unset: { analyticsProcessedAt: "" }
    }
  );

  const orders = await orderModel
    .find({ status: { $in: PAID_STATUSES } })
    .select("_id paidAt createdAt")
    .sort({ paidAt: 1, createdAt: 1 })
    .lean();

  console.log(`[analytics-rebuild] Reprocesando ${orders.length} ordenes...`);

  let ok = 0;
  let fail = 0;
  for (const order of orders) {
    try {
      await handlePaidOrderAnalytics(order._id);
      ok += 1;
      if (ok % 10 === 0 || ok === orders.length) {
        console.log(`[analytics-rebuild] Progreso ${ok}/${orders.length}`);
      }
    } catch (error) {
      fail += 1;
      console.error(`[analytics-rebuild] Error orden ${order._id}: ${error.message}`);
    }
  }

  console.log("[analytics-rebuild] Finalizado", { ok, fail, total: orders.length });
};

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[analytics-rebuild] Error fatal:", error);
    await mongoose.connection.close();
    process.exit(1);
  });
