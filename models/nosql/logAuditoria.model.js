// models/logAuditoria.model.js
const mongoose = require("mongoose");

const LogAuditoriaSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: false,
    },
    accion: { 
      type: String, 
      required: true 
    },
    descripcion: { 
      type: String 
    },
    entidad: { 
      type: String, 
      required: true 
    },
    entidadId: { 
      type: mongoose.Schema.Types.ObjectId 
    },
    ip: {
      type: String
    },
    userAgent: {
      type: String
    },
    fecha: { 
      type: Date, 
      default: Date.now 
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("Log_Auditoria", LogAuditoriaSchema);