const mongoose = require("mongoose");

const TenantSecretSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, versionKey: false }
);

TenantSecretSchema.index({ tenantId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("TenantSecret", TenantSecretSchema);
