require("dotenv").config();
const mongoose = require("mongoose");
const { itemModel, bannerPromotionModel } = require("../models/index");

const rangesOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB);
};

const buildConflictFilter = (item, promotion) => ({
  tipo: "promo",
  startDate: { $lte: promotion.endDate },
  endDate: { $gte: promotion.startDate },
  $or: [
    { applyAll: true },
    { products: item._id },
    { subcategories: item.subcategory },
    { categories: item.category },
  ],
});

const run = async () => {
  const uri = process.env.DB_URI;
  if (!uri) {
    throw new Error("DB_URI no definido");
  }

  await mongoose.connect(uri);
  console.log("DB conectada");

  const cursor = itemModel.find({ "promotion.active": true }).cursor();
  let processed = 0;
  let cleared = 0;

  for await (const item of cursor) {
    processed += 1;

    const promotion = item.promotion || {};
    if (
      !promotion.active ||
      !promotion.startDate ||
      !promotion.endDate
    ) {
      continue;
    }

    const conflict = await bannerPromotionModel
      .findOne(buildConflictFilter(item, promotion))
      .select("_id title startDate endDate");

    if (!conflict) continue;

    item.promotion = {
      active: false,
      percentage: 0,
      startDate: null,
      endDate: null,
    };
    await item.save();
    cleared += 1;

    console.log(
      `limpiado item=${item._id} nombre="${item.nameProduct}" conflicto="${conflict.title || conflict._id}"`,
    );
  }

  console.log(`final revisados=${processed} limpiados=${cleared}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Error en cleanup:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
