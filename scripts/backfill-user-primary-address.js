require("dotenv").config();
const mongoose = require("mongoose");
const { userModel } = require("../models/index");

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

  const cursor = userModel
    .find({
      address: { $exists: true, $ne: [] },
      $or: [
        { "address.isPrimary": { $exists: false } },
        { "address.isPrimary": false },
        { "address.isPrimary": null }
      ]
    })
    .select("_id address")
    .lean()
    .cursor();

  const bulk = [];
  let processed = 0;
  let updated = 0;

  for await (const user of cursor) {
    const addresses = Array.isArray(user.address) ? user.address : [];
    if (addresses.length === 0) continue;

    const hasPrimary = addresses.some((addr) => addr?.isPrimary === true);
    if (hasPrimary) continue;

    const nextAddresses = addresses.map((addr, idx) => ({
      ...addr,
      isPrimary: idx === 0
    }));

    bulk.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { address: nextAddresses } }
      }
    });
    updated += 1;

    if (bulk.length >= 200) {
      await userModel.bulkWrite(bulk);
      bulk.length = 0;
    }

    processed += 1;
    if (processed % 500 === 0) {
      console.log(`Procesados ${processed} usuarios...`);
    }
  }

  if (bulk.length > 0) {
    await userModel.bulkWrite(bulk);
  }

  console.log(`Backfill completado. Usuarios actualizados: ${updated}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Error en backfill:", error);
  process.exit(1);
});
