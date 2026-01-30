const { logAuditoriaModel } = require("../models/index");

/**
 * Registra un evento de auditoría
 * @param {Object} options
 * @param {String} options.usuarioId - ID del usuario que ejecuta la acción
 * @param {String} options.accion - Código de acción (ej. CREAR_USUARIO)
 * @param {String} options.descripcion - Detalle del cambio o acción
 * @param {String} options.entidad - Nombre de la entidad afectada (ej. Usuario)
 * @param {String} [options.entidadId] - ID de la entidad afectada (opcional)
 * @param {Object} [options.req] - Request de Express para capturar IP y user-agent
 */

const registrarAuditoria = async ({
  usuarioId = null,
  accion,
  descripcion = "",
  entidad,
  entidadId = null,
  req = null,
  contextoCreacion = false,
  allowAnonymous = false,
}) => {
  try {
    const logData = {
      accion,
      descripcion,
      entidad,
      entidadId,
      fecha: new Date(),
    };
    // Manejo especial para creación de usuarios
    if (contextoCreacion) {
      logData.descripcion = `Nuevo usuario en proceso de creación: ${descripcion}`;
      logData.entidad = "Usuario";
    } else {
      // Validación solo para acciones que no son de creación
      if (!usuarioId) {
        if (!allowAnonymous) {
          throw new Error("Se requiere usuarioId para auditor?as regulares");
        }
      } else {
        logData.usuario = usuarioId;
      }
    }
    // Añadir información de la solicitud si está disponible
    if (req) {
      logData.ip =
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress;

      logData.userAgent = req.headers["user-agent"];
    }
    await logAuditoriaModel.create(logData);
  } catch (error) {
    console.error("Error al registrar auditoría:", error.message);
    // Opcional: Registrar en un sistema de errores críticos
  }
};

module.exports = { registrarAuditoria };
