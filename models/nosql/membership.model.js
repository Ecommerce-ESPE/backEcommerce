const mongoose = require("mongoose");

const MembershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    tenantId: { type: String, required: true },
    roles: {
      type: [String],
      default: [],
      enum: [
        "TENANT_ADMIN",
        "BRANCH_ADMIN",
        "CASHIER",
        "KITCHEN",
        "DISPATCH",
        "COURIER",
        "CUSTOMER"
      ]
    },
    branchIds: { type: [String], default: [] },
    active: { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
);

MembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ tenantId: 1, branchIds: 1 });

module.exports = mongoose.model("Membership", MembershipSchema);
