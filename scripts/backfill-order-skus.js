require("dotenv").config();
const mongoose = require("mongoose");
const { orderModel, itemModel } = require("../models/index");

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

  const cursor = orderModel
    .find({
      $or: [
        { "products.sku": { $exists: false } },
        { "products.sku": null },
        { "products.sku": "" }
      ]
    })
    .select("_id orderNumber products")
    .lean()
    .cursor();

  const bulk = [];
  let processed = 0;
  let updated = 0;

  for await (const order of cursor) {
    const products = Array.isArray(order.products) ? order.products : [];
    if (products.length === 0) continue;

    const missingSku = products.filter((p) => !p.sku && p.productId);
    if (missingSku.length === 0) continue;

    const productIds = [
      ...new Set(missingSku.map((p) => String(p.productId)))
    ];

    const items = await itemModel
      .find({ _id: { $in: productIds } })
      .select("_id sku")
      .lean();

    const skuMap = new Map(items.map((i) => [String(i._id), i.sku]));

    let changed = false;
    const nextProducts = products.map((p) => {
      if (p.sku) return p;
      const sku = skuMap.get(String(p.productId)) || null;
      if (!sku) return p;
      changed = true;
      return { ...p, sku };
    });

    if (changed) {
      bulk.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { products: nextProducts } }
        }
      });
      updated += 1;
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

  console.log(`Backfill SKU completado. Ordenes actualizadas: ${updated}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Error en backfill SKU:", error);
  process.exit(1);
});
