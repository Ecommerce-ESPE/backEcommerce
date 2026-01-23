const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", unique: true, required: true },
    balanceCents: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD" }
  },
  { timestamps: true, versionKey: false }
);

WalletSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("wallets", WalletSchema);
