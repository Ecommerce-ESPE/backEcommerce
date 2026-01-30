const jwt = require("jsonwebtoken");

const resolveTenant = (req, res, next) => {
  let tenantId = req.tenantId;

  if (!tenantId && req.user && req.user.tenantId) {
    tenantId = req.user.tenantId;
  }

  if (!tenantId) {
    const token = req.header("x-token") || req.query.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.tenantId) {
        tenantId = decoded.tenantId;
      }
    }
  }

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
