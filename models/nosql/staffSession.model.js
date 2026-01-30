const mongoose = require("mongoose");

const StaffSessionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    role: {
      type: String,
      enum: ["CASHIER", "KITCHEN", "DISPATCH", "COURIER"],
      required: true
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "BUSY", "PAUSED", "OFFLINE"],
      default: "OFFLINE"
    },
    lastHeartbeatAt: { type: Date },
    activeTask: {
      type: {
        type: String,
        enum: ["TICKET", "ORDER_STAGE", "NONE"],
        default: "NONE"
      },
      id: { type: mongoose.Schema.Types.ObjectId },
      stageKey: { type: String }
    },
    startedAt: { type: Date, default: Date.now }
  },
  { timestamps: true, versionKey: false }
);

StaffSessionSchema.index(
  { tenantId: 1, branchId: 1, role: 1, status: 1 }
);
StaffSessionSchema.index(
  { tenantId: 1, branchId: 1, userId: 1 },
  { unique: true }
);

module.exports = mongoose.model("StaffSession", StaffSessionSchema);
