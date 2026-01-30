// models/Invoice.js
const mongoose = require("mongoose");
const Counter = require("./counter");

const InvoiceItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
    },
    name: { type: String, required: true },
    variantName: { type: String },
    price: { type: Number, required: true, min: 0 },
    unitPriceCharged: { type: Number, min: 0 },
    originalPrice: { type: Number, min: 0 },
    pricingSource: {
      type: String,
      enum: ["globalPromo", "productPromo", "storedDiscount", "none"],
      default: "none",
    },
    promoPercentageApplied: { type: Number, min: 0, max: 100, default: 0 },
    promoId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quantity: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: "DEFAULT", index: true },
    branchId: { type: String, default: "DEFAULT", index: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    invoiceNumber: { type: String },
    orderNumber: { type: String, default: "" },
    issuedAt: { type: Date, default: Date.now },
    tenantSnapshot: {
      name: { type: String, default: "" },
      ruc: { type: String, default: "" },
      legalName: { type: String, default: "" },
      commercialName: { type: String, default: "" },
      branding: {
        logoUrl: { type: String, default: "" },
        theme: { type: mongoose.Schema.Types.Mixed, default: null }
      }
    },
    branchSnapshot: {
      branchId: { type: String, default: "" },
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      establishmentCode: { type: String, default: "" },
      emissionPoint: { type: String, default: "" }
    },
    customerSnapshot: {
      name: { type: String, default: "" },
      idNumber: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" }
    },
    termsAndConditions: { type: String, default: "" },
    showShippingAddress: { type: Boolean, default: true },
    showBranchInfo: { type: Boolean, default: true },
    sriSnapshot: {
      enabled: { type: Boolean, default: false },
      environment: { type: String, default: "" },
      emissionType: { type: String, default: "" },
      obligatedAccounting: { type: String, default: "" },
      specialContributor: { type: String, default: "" },
      mainOfficeAddress: { type: String, default: "" },
      authorizationNumber: { type: String, default: "" },
      accessKey: { type: String, default: "" }
    },
    qrData: { type: String, default: "" },
    items: {
      type: [InvoiceItemSchema],
      required: true,
      validate: (v) => v.length > 0,
    },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    discount: {
      type: Number,
      default: 0,
    },
    discountPercentage: {
      type: Number,
      default: 0,
    },
    originalSubtotal: {
      type: Number,
      required: true,
    },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "ISSUED",
        "VOID",
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "failed"
      ],
      default: "ISSUED",
    },
    dueDate: { type: Date },
    taxBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    companyDetails: {
      name: { type: String, default: "Createx Shop" },
      address: { type: String, default: "Av. Moran Valverde, S142-54" },
      phone: { type: String, default: "098521856226" },
      email: { type: String, default: "ventas@createx.com" },
      logoUrl: { type: String, default: "../../storage/logo.svg" },
    },
  },
  { timestamps: true, versionKey: false }
);

// Auto-increment invoiceNumber and calculate dueDate
InvoiceSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "invoice_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.invoiceNumber = String(counter.seq).padStart(10, "0");

    if (!this.dueDate) {
      const due = new Date();
      due.setDate(due.getDate() + 30);
      this.dueDate = due;
    }
  }
  next();
});

InvoiceSchema.index({ tenantId: 1, issuedAt: 1 });
InvoiceSchema.index({ tenantId: 1, branchId: 1 });
InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", InvoiceSchema);
