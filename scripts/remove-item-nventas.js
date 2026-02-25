require("dotenv").config();
const mongoose = require("mongoose");
const { itemModel } = require("../models/index");

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

  const [withRootField, withVariantField] = await Promise.all([
    itemModel.countDocuments({ nventas: { $exists: true } }),
    itemModel.countDocuments({ "value.nventas": { $exists: true } })
  ]);

  console.log(
    `Items con nventas (raiz): ${withRootField}, items con value.nventas: ${withVariantField}`
  );

  const result = await itemModel.updateMany(
    {},
    {
      $unset: {
        nventas: "",
        "value.$[].nventas": ""
      }
    }
  );

  const modified =
    typeof result.modifiedCount === "number"
      ? result.modifiedCount
      : result.nModified || 0;

  console.log(`Migracion completada. Items modificados: ${modified}`);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Error eliminando nventas:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
