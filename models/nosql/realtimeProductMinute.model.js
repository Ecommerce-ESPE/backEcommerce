const mongoose = require("mongoose");

const RealtimeProductMinuteSchema = new mongoose.Schema(
  {
    bucket: { type: Date, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "items", required: true },
    productName: { type: String },
    units: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

RealtimeProductMinuteSchema.index({ bucket: 1, productId: 1 }, { unique: true });
RealtimeProductMinuteSchema.index({ bucket: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model("realtime_product_minute", RealtimeProductMinuteSchema);
