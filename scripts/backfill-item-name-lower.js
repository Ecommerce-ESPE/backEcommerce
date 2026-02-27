require("dotenv").config();
const mongoose = require("mongoose");
const { itemModel } = require("../models/index");

const normalizeSearchText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const run = async () => {
  const uri = process.env.DB_URI;
  if (!uri) {
    throw new Error("DB_URI no definido");
  }

  await mongoose.connect(uri);
  console.log("DB conectada");

  const cursor = itemModel.find({}, { _id: 1, nameProduct: 1, nameProductLower: 1 }).cursor();
  const bulkOps = [];
  let processed = 0;
  let updated = 0;

  for await (const item of cursor) {
    processed += 1;
    const normalized = normalizeSearchText(item.nameProduct);
    if (item.nameProductLower === normalized) continue;

    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { nameProductLower: normalized } },
      },
    });

    if (bulkOps.length >= 500) {
      const result = await itemModel.bulkWrite(bulkOps, { ordered: false });
      updated += Number(result.modifiedCount || 0);
      bulkOps.length = 0;
      console.log(`procesados=${processed} actualizados=${updated}`);
    }
  }

  if (bulkOps.length > 0) {
    const result = await itemModel.bulkWrite(bulkOps, { ordered: false });
    updated += Number(result.modifiedCount || 0);
  }

  console.log(`final procesados=${processed} actualizados=${updated}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Error en backfill:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
