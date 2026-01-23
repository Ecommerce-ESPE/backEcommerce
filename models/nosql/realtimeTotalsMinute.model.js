const mongoose = require("mongoose");

const RealtimeTotalsMinuteSchema = new mongoose.Schema(
  {
    bucket: { type: Date, required: true, unique: true },
    units: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    margin: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

RealtimeTotalsMinuteSchema.index({ bucket: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model("realtime_totals_minute", RealtimeTotalsMinuteSchema);
