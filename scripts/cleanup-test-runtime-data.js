require("dotenv").config();
const mongoose = require("mongoose");
const {
  orderModel,
  transactionModel,
  invoiceModel,
  facturaModel,
  salesItemModel,
  salesSummaryDailyModel,
  realtimeProductMinuteModel,
  realtimeCategoryMinuteModel,
  realtimeTotalsMinuteModel,
} = require("../models/index");

const TARGETS = [
  { name: "orders", model: orderModel },
  { name: "transactions", model: transactionModel },
  { name: "invoices", model: invoiceModel },
  { name: "facturas", model: facturaModel },
  { name: "sales_items", model: salesItemModel },
  { name: "sales_summary_daily", model: salesSummaryDailyModel },
  { name: "realtime_product_minute", model: realtimeProductMinuteModel },
  { name: "realtime_category_minute", model: realtimeCategoryMinuteModel },
  { name: "realtime_totals_minute", model: realtimeTotalsMinuteModel },
];

const hasConfirmFlag = process.argv.includes("--confirm");

const run = async () => {
  const DB_URI = process.env.DB_URI;
  if (!DB_URI) {
    console.error("DB_URI no definido");
    process.exit(1);
  }

  if (!hasConfirmFlag) {
    console.error(
      "Accion bloqueada. Usa --confirm para ejecutar la limpieza.\n" +
        "Ejemplo: node scripts/cleanup-test-runtime-data.js --confirm"
    );
    process.exit(1);
  }

  await mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("[cleanup] Conexion exitosa. Iniciando limpieza...");
  const summary = {};

  for (const target of TARGETS) {
    const result = await target.model.deleteMany({});
    summary[target.name] = result.deletedCount || 0;
    console.log(`[cleanup] ${target.name}: ${summary[target.name]} eliminados`);
  }

  console.log("[cleanup] Limpieza finalizada.");
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("[cleanup] Error:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
