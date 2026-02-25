const mongoose = require("mongoose");

const SalesItemSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "items", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    subcategoryId: { type: mongoose.Schema.Types.ObjectId },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
    productName: { type: String },
    categoryName: { type: String },
    subcategoryName: { type: String },
    brandName: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    revenue: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    paidAt: { type: Date, required: true },
    day: { type: Date, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true }
  },
  { timestamps: true, versionKey: false }
);

SalesItemSchema.index({ paidAt: 1 });
SalesItemSchema.index({ orderId: 1 });
SalesItemSchema.index({ productId: 1, paidAt: 1 });
SalesItemSchema.index({ categoryId: 1, paidAt: 1 });
SalesItemSchema.index({ subcategoryId: 1, paidAt: 1 });
SalesItemSchema.index({ brandId: 1, paidAt: 1 });
SalesItemSchema.index({ year: 1, month: 1, day: 1 });

module.exports = mongoose.model("sales_items", SalesItemSchema);
