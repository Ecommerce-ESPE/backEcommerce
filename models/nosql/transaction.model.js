const mongoose = require("mongoose");

const TransactionHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  message: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
  tenantId: { type: String, default: "DEFAULT", index: true },
  branchId: { type: String, default: "DEFAULT", index: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true
  },
  method: {
    type: String,
    enum: ["credit-card", "paypal", "transfer", "credits", "cash"],
    required: true
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2)) // Asegurar 2 decimales
  },
  currency: { 
    type: String, 
    default: "USD",
    enum: ["USD", "EUR"] // Soporte para múltiples monedas
  },
  status: {
    type: String,
    enum: ["pending", "success", "failed", "refunded","completed"],
    default: "pending"
  },
  gatewayTransactionId: { type: String },
  taxBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
  errorDetails: {
    code: { type: String },
    message: { type: String },
    declineCode: { type: String }
  },
  history: [TransactionHistorySchema],
  metadata: { type: mongoose.Schema.Types.Mixed } // Datos adicionales
}, { 
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejor performance
TransactionSchema.index({ orderId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
