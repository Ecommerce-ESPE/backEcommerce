const mongoose = require("mongoose");

const TagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

TagSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model("Tag", TagSchema);
