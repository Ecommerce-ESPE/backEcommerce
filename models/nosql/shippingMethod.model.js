const mongoose = require("mongoose");

const ShippingMethodSchema = new mongoose.Schema({
  costo: { type: Number, required: true, min: 0 },
  descripcion: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  visible: { type: Boolean, default: true },
  empresa: { type: String, required: true },
  tipoEnvio: { type: String, required: true },
  provinciasPermitidas: { type: [String], default: [] },
  provinciasRestringidas: { type: [String], default: [] },
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model("ShippingMethod", ShippingMethodSchema);
