const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    branchId: { type: String, required: true },
    code: { type: String },
    name: { type: String, required: true },
    address: {
      line1: { type: String, default: "" },
      city: { type: String, default: "" },
      province: { type: String, default: "" },
      country: { type: String, default: "EC" }
    },
    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" }
    },
    invoicing: {
      legalName: { type: String, default: "" },
      commercialName: { type: String, default: "" },
      ruc: { type: String, default: "" },
      addressForInvoice: { type: String, default: "" },
      establishmentCode: { type: String, default: "" },
      emissionPoint: { type: String, default: "" }
    }
  },
  { timestamps: true, versionKey: false }
);

BranchSchema.index({ tenantId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model("Branch", BranchSchema);
