require("dotenv").config();
const mongoose = require("mongoose");
const { itemModel, brandModel } = require("../models/index");
const { slugifyText, ensureUniqueSlug } = require("../utils/slug");

const run = async () => {
  const DB_URI = process.env.DB_URI;
  if (!DB_URI) {
    console.error("DB_URI no definido");
    process.exit(1);
  }

  await mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const cursor = itemModel.find().select("_id nameProduct brand slug").cursor();
  let processed = 0;
  let updated = 0;

  for await (const product of cursor) {
    if (!product.brand) {
      processed += 1;
      continue;
    }

    const brand = await brandModel
      .findById(product.brand)
      .select("slug")
      .lean();

    const brandSlug = brand?.slug || "gen";
    const nameSlug = slugifyText(product.nameProduct || "producto") || "producto";
    const baseSlug = `${brandSlug}-${nameSlug}`;
    const nextSlug = await ensureUniqueSlug(itemModel, baseSlug, {
      _id: { $ne: product._id },
    });

    if (product.slug !== nextSlug) {
      await itemModel.updateOne(
        { _id: product._id },
        { $set: { slug: nextSlug } },
      );
      updated += 1;
    }

    processed += 1;
  }

  console.log("Recalculo de slug finalizado");
  console.log(`Total procesados: ${processed}`);
  console.log(`Actualizados: ${updated}`);

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Error en recalculo de slug:", error);
  process.exit(1);
});
