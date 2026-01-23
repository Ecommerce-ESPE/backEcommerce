const mongoose = require("mongoose");

const WalletTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    type: { type: String, enum: ["debit", "credit"], required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed", "refunded"],
      default: "pending"
    },
    idempotencyKey: { type: String, required: true, unique: true },
    balanceAfterCents: { type: Number },
    metadata: {
      reason: { type: String },
      createdBy: { type: String },
      note: { type: String }
    }
  },
  { timestamps: true, versionKey: false }
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ orderId: 1, createdAt: -1 });
WalletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model("wallet_transactions", WalletTransactionSchema);
