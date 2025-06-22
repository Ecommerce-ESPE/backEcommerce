// models/ConfiguracionGlobal.js
const mongoose = require("mongoose");

const EnvioSchema = new mongoose.Schema({
  id: { type: String, required: true },
  costo: { type: Number, required: true },
  descripcion: { type: String },
  fecha: { type: String }
}, { _id: false });

const ConfiguracionGlobalSchema = new mongoose.Schema({
  empresa: {
    nombre: String,
    direccion: String,
    telefono: String,
    email: String,
    logoUrl: String
  },
  impuestos: {
    aplicarIVA: Boolean,
    porcentajeIVA: Number,
    descripcionIVA: String
  },
  factura: {
    vencimientoDias: Number,
    aplicarDescuento: Boolean,
    descuentoPorDefecto: Number,
    formatoNumero: String
  },
  metodosPago: {
    habilitados: [String]
  },
  tienda: {
    nombrePublico: String,
    moneda: String,
    simbolo: String,
    mostrarStock: Boolean,
    permitirResenas: Boolean
  },
  mantenimiento: {
    modo: Boolean,
    mensaje: String
  },
  envios: [EnvioSchema] // ← NUEVO CAMPO
}, { versionKey: false });

module.exports = mongoose.model("configGlobal", ConfiguracionGlobalSchema);
