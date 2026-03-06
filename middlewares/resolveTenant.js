const jwt = require("jsonwebtoken");

const resolveTenant = (req, res, next) => {
  let tenantId = req.tenantId;

  // En requests autenticados, el tenant siempre viene del usuario.
  if (!tenantId && req.user && req.user.tenantId) {
    tenantId = req.user.tenantId;
  }

  // Solo usar token decodificado si no existe contexto autenticado.
  if (!tenantId && !req.user) {
    const token = req.header("x-token") || req.query.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.tenantId) {
        tenantId = decoded.tenantId;
      }
    }
  }

  // Headers/query se permiten como fallback en escenarios no autenticados.
  if (!tenantId) {
    const headerTenant = req.header("x-tenant-id");
    const queryTenant = req.query.tenantId;
    if (process.env.NODE_ENV !== "production" && headerTenant) {
      tenantId = headerTenant;
    } else if (queryTenant) {
      tenantId = queryTenant;
    }
  }

  req.tenantId = tenantId || "DEFAULT";
  next();
};

module.exports = { resolveTenant };
