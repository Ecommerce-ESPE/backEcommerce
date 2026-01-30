const mongoose = require("mongoose");

const ServiceTicketSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    serviceType: {
      type: String,
      enum: ["checkout", "pickup", "dispatch"],
      required: true
    },
    code: { type: String, required: true },
    seq: { type: Number, required: true },
    dayKey: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "WAITING",
        "CALLED",
        "SERVING",
        "CLOSED",
        "SKIPPED",
        "CANCELLED"
      ],
      default: "WAITING"
    },
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null
    },
    assignedAt: { type: Date },
    calledAt: { type: Date },
    servingAt: { type: Date },
    closedAt: { type: Date },
    meta: {
      customerName: { type: String },
      phone: { type: String },
      notes: { type: String }
    }
  },
  { timestamps: true, versionKey: false }
);

ServiceTicketSchema.index(
  { tenantId: 1, branchId: 1, serviceType: 1, status: 1, createdAt: 1 }
);
ServiceTicketSchema.index(
  { tenantId: 1, branchId: 1, serviceType: 1, code: 1 },
  { unique: true }
);

module.exports = mongoose.model("ServiceTicket", ServiceTicketSchema);
