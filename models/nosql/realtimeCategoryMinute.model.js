const mongoose = require("mongoose");

const RealtimeCategoryMinuteSchema = new mongoose.Schema(
  {
    bucket: { type: Date, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    subcategoryId: { type: mongoose.Schema.Types.ObjectId },
    categoryName: { type: String },
    subcategoryName: { type: String },
    units: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

RealtimeCategoryMinuteSchema.index(
  { bucket: 1, categoryId: 1, subcategoryId: 1 },
  { unique: true }
);
RealtimeCategoryMinuteSchema.index({ bucket: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model("realtime_category_minute", RealtimeCategoryMinuteSchema);
