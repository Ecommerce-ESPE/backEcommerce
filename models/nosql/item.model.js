const mongoose = require("mongoose");
const { slugifyText, ensureUniqueSlug } = require("../../utils/slug");
const SPEC_TYPES = ["text", "number", "boolean", "list_text", "list_number"];

const stripLegacySalesFields = (payload) => {
  if (!payload || typeof payload !== "object") return payload;

  delete payload.nventas;

  if (Array.isArray(payload.value)) {
    payload.value = payload.value.map((variant) => {
      if (!variant || typeof variant !== "object") return variant;
      const sanitizedVariant = { ...variant };
      delete sanitizedVariant.nventas;
      return sanitizedVariant;
    });
  }

  return payload;
};

const VariantSchema = new mongoose.Schema({
  size: String,
  icon: String,
  originalPrice: { type: Number, required: true },
  discountPrice: Number,
  costPrice: { type: Number, default: null },
  stock: { type: Number, default: 0 },
  priceHistory: [
    {
      price: Number,
      date: { type: Date, default: Date.now },
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" }
    }
  ],
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
});

const PromotionSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    startDate: Date,
    endDate: Date
  },
  { _id: false }
);

const isValidSpecValueByType = (type, value) => {
  if (!SPEC_TYPES.includes(type)) return false;

  switch (type) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "list_text":
      return (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      );
    case "list_number":
      return (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
      );
    default:
      return false;
  }
};

const SpecSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    type: { type: String, enum: SPEC_TYPES, required: true },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function (value) {
          return isValidSpecValueByType(this.type, value);
        },
        message: "Valor de especificacion invalido para el tipo indicado"
      }
    },
    unit: { type: String, default: null },
    group: { type: String, default: null },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    nameProduct: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true, index: true },
    sku: { type: String, unique: true, sparse: true, index: true, uppercase: true },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: function () {
        return this.isNew;
      }
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag"
      }
    ],
    value: [VariantSchema],
    specs: { type: [SpecSchema], default: [] },
    description: { type: String, default: "No description" },
    content: { type: String, default: "" },
    images: [
      {
        description: String,
        imgUrl: String,
        public_id: String,
        _id: false
      }
    ],
    banner: String,
    visibility: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "categories",
      required: true
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    promotion: PromotionSchema
  },
  {
    timestamps: true,
    versionKey: false
  }
);

ItemSchema.pre("save", async function (next) {
  try {
    const shouldRecomputeSlug =
      this.isNew || this.isModified("nameProduct") || this.isModified("brand");

    let brandSlug = "gen";
    if (this.brand) {
      const brandDoc = await mongoose
        .model("Brand")
        .findById(this.brand)
        .select("slug")
        .lean();
      if (brandDoc?.slug) brandSlug = brandDoc.slug;
    }

    if (shouldRecomputeSlug) {
      const nameSlug = slugifyText(this.nameProduct || "producto") || "producto";
      const baseSlug = `${brandSlug || "gen"}-${nameSlug}`;
      this.slug = await ensureUniqueSlug(this.constructor, baseSlug, {
        _id: { $ne: this._id }
      });
    }

    if (this.isModified("brand") || this.isModified("nameProduct")) {
      const brandPart = (brandSlug || "GEN")
        .substring(0, 3)
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();

      const namePart = (this.nameProduct || "PRD")
        .substring(0, 3)
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();

      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatorios

      this.sku = `${brandPart}-${namePart}-${year}-${month}-${randomNum}`;
    }

    if (this.isModified("promotion")) {
      const now = new Date();

      this.value.forEach((variant) => {
        variant.discountPrice = null;

        if (this.promotion?.active) {
          const start = new Date(this.promotion.startDate);
          const end = new Date(this.promotion.endDate);

          if (now >= start && now <= end) {
            const discount =
              variant.originalPrice * (this.promotion.percentage / 100);
            variant.discountPrice = Number(
              (variant.originalPrice - discount).toFixed(2)
            );
          }
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

ItemSchema.index({ brand: 1 });
ItemSchema.index({ tags: 1 });

ItemSchema.pre(/^find/, function (next) {
  this.select("-nventas -value.nventas");
  next();
});

ItemSchema.set("toJSON", {
  transform: (_, ret) => stripLegacySalesFields(ret)
});

ItemSchema.set("toObject", {
  transform: (_, ret) => stripLegacySalesFields(ret)
});

module.exports = mongoose.model("items", ItemSchema);
