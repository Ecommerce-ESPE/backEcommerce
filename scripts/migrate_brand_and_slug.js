require("dotenv").config();
const mongoose = require("mongoose");
const { itemModel, brandModel } = require("../models/index");
const { slugifyText, ensureUniqueSlug } = require("../utils/slug");

const BRAND_HINTS = [
  { match: /iphone|ipad|macbook|airpods|apple/i, name: "Apple" },
  { match: /samsung|galaxy/i, name: "Samsung" },
  { match: /xiaomi|redmi|poco/i, name: "Xiaomi" },
  { match: /huawei|honor/i, name: "Huawei" },
  { match: /motorola|moto g|moto e/i, name: "Motorola" },
  { match: /lg\s|lg-/i, name: "LG" },
  { match: /sony|playstation/i, name: "Sony" },
];

const getBrandNameFromProduct = (product) => {
  const candidates = [
    product.brandName,
    product.marca,
    product.provider,
    product.providerName,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (typeof product.brand === "string" && product.brand.trim()) {
    return product.brand.trim();
  }

  if (product.nameProduct) {
    const name = product.nameProduct;
    const hit = BRAND_HINTS.find((hint) => hint.match.test(name));
    if (hit) return hit.name;
  }

  return "Generic";
};

const resolveBrand = async (brandName) => {
  const cleanName = String(brandName || "").trim() || "Generic";
  const baseSlug =
    cleanName.toLowerCase() === "generic"
      ? "gen"
      : slugifyText(cleanName) || "gen";

  let brand = await brandModel.findOne({ slug: baseSlug }).lean();
  if (brand) return brand;

  const uniqueSlug = await ensureUniqueSlug(brandModel, baseSlug);
  brand = await brandModel.create({
    name: cleanName,
    slug: uniqueSlug,
    active: true,
  });

  return brand;
};

const buildProductSlug = async (product, brandSlug) => {
  const nameSlug = slugifyText(product.nameProduct || "producto") || "producto";
  const baseSlug = `${brandSlug || "gen"}-${nameSlug}`;
  return ensureUniqueSlug(itemModel, baseSlug, { _id: { $ne: product._id } });
};

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

  const cursor = itemModel
    .find()
    .select("_id nameProduct brand brandName marca provider providerName slug")
    .cursor();

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for await (const product of cursor) {
    try {
      const brandName = getBrandNameFromProduct(product);
      const brand = await resolveBrand(brandName);

      const nextSlug = await buildProductSlug(product, brand.slug);

      const updates = {};
      if (!product.brand || String(product.brand) !== String(brand._id)) {
        updates.brand = brand._id;
      }
      if (!product.slug || product.slug !== nextSlug) {
        updates.slug = nextSlug;
      }

      if (Object.keys(updates).length > 0) {
        await itemModel.updateOne({ _id: product._id }, { $set: updates });
        updated += 1;
      }

      processed += 1;
      if (processed % 200 === 0) {
        console.log(`Procesados ${processed} productos...`);
      }
    } catch (error) {
      failed += 1;
      console.error(`Error en producto ${product._id}:`, error.message);
    }
  }

  console.log("Migración finalizada");
  console.log(`Total procesados: ${processed}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Fallidos: ${failed}`);

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Error en migración:", error);
  process.exit(1);
});
