const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: "",
    },
    logoPublicId: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

BrandSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model("Brand", BrandSchema);
