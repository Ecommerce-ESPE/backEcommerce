const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ["percentage", "fixed"],
    required: true
  },
  minPurchase: {
    type: Number,
    default: 10
  },
  isValid: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
});

module.exports = mongoose.model("descuentos", discountSchema);