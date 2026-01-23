const mongoose = require('mongoose');

const BannerPromotionSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    subtitle: { type: String, required: true },
    title: { type: String, required: true },
    buttonText: { type: String, required: true },
    href: { type: String, default: "#" },
    colSize: { type: String, default: "col-lg-6" },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    tipo: { type: String, enum: ["banner", "promo"], default: "banner" },
    estado: {
      type: String,
      enum: ["proximo", "enCurso", "finalizado"],
      required: false,
      default: "proximo",
    },
    active: { type: Boolean, default: false },
    promotionPercentage: { type: Number, min: 0, max: 100 },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "items",
      },
    ],
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    applyAll: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Función que determina el estado y si está activo
function actualizarEstado(banner) {
  const now = new Date();
  if (now < banner.startDate) {
    banner.estado = "proximo";
    banner.active = false;
  } else if (now >= banner.startDate && now <= banner.endDate) {
    banner.estado = "enCurso";
    banner.active = true;
  } else if (now > banner.endDate) {
    banner.estado = "finalizado";
    banner.active = false;
  }
}

// Middleware antes de guardar
BannerPromotionSchema.pre("save", function (next) {
  actualizarEstado(this);
  next();
});

// Middleware antes de actualizar
BannerPromotionSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.startDate && update.endDate) {
    const temp = {
      startDate: update.startDate,
      endDate: update.endDate,
    };
    actualizarEstado(temp);
    update.estado = temp.estado;
    update.active = temp.active;
    this.setUpdate(update);
  }
  next();
});

module.exports = mongoose.model("BannerPromo", BannerPromotionSchema);
