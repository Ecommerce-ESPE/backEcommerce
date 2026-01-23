const mongoose = require("mongoose");

const SalesSummaryDailySchema = new mongoose.Schema(
  {
    day: { type: Date, required: true },
    granularity: {
      type: String,
      enum: ["total", "product", "category", "subcategory"],
      required: true
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "items" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    subcategoryId: { type: mongoose.Schema.Types.ObjectId },
    productName: { type: String },
    categoryName: { type: String },
    subcategoryName: { type: String },
    units: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    shippingRevenue: { type: Number, default: 0 },
    taxRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

SalesSummaryDailySchema.index({
  day: 1,
  granularity: 1,
  productId: 1,
  categoryId: 1,
  subcategoryId: 1
}, { unique: true });

SalesSummaryDailySchema.index({ day: 1, granularity: 1 });

module.exports = mongoose.model("sales_summary_daily", SalesSummaryDailySchema);
