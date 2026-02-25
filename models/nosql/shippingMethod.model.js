const mongoose = require("mongoose");

const ShippingMethodSchema = new mongoose.Schema({
  costo: { type: Number, required: true, min: 0 },
  descripcion: { type: String, required: true },
  tiempoEstimado: { type: String, default: "" },
  fecha: { type: Date, default: Date.now },
  visible: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },
  empresa: { type: String, required: true },
  tipoEnvio: { type: String, required: true },
  provinciasPermitidas: { type: [String], default: [] },
  provinciasRestringidas: { type: [String], default: [] },
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model("ShippingMethod", ShippingMethodSchema);
