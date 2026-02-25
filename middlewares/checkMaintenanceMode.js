const jwt = require("jsonwebtoken");
const { getOrCreateTenantConfig } = require("../helpers/getTenantConfig");
const { isMaintenanceModeEnabled } = require("../helpers/maintenance");

const ALWAYS_ALLOWED_PREFIXES = ["/api/auth", "/api/admin", "/api/tenant-config"];
const ALWAYS_ALLOWED_EXACT = ["/health", "/api/health"];

const getPath = (req) => (req.originalUrl || req.url || "").split("?")[0];

const getTenantIdFromRequest = (req) =>
  req.tenantId ||
  req?.user?.tenantId ||
  req?.usuario?.tenantId ||
  req.header("x-tenant-id") ||
  req.query?.tenantId ||
  "DEFAULT";

const getUserRole = (req) => {
  const fromReq =
    req?.user?.role ||
    req?.user?.rol ||
    req?.usuario?.role ||
    req?.usuario?.rol ||
    req?.rol;
  if (fromReq) return fromReq;

  const token = req.header("x-token") || req.query?.token;
  if (!token) return "";
  const decoded = jwt.decode(token);
  return decoded?.role || decoded?.rol || "";
};

const isAlwaysAllowed = (path) =>
  ALWAYS_ALLOWED_EXACT.includes(path) ||
  ALWAYS_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));

const sendMaintenance = (res, message) =>
  res.status(503).json({
    ok: false,
    code: "MAINTENANCE_MODE",
    message: message || "Sistema en mantenimiento. Intente mas tarde."
  });

const checkMaintenanceMode = async (req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();

    const path = getPath(req);
    if (isAlwaysAllowed(path)) return next();

    const tenantId = getTenantIdFromRequest(req);
    const config = await getOrCreateTenantConfig(tenantId);
    if (!isMaintenanceModeEnabled(config)) return next();

    const maintenance = config.maintenance || {};
    const role = String(getUserRole(req)).toUpperCase();
    if (maintenance.allowAdminAccess && role === "ADMIN") return next();

    const isStorefrontRoute = path.startsWith("/api/storefront") || path.startsWith("/api/public");
    const isPosRoute = path.startsWith("/api/pos");

    if (maintenance.disableStorefront && isStorefrontRoute) {
      return sendMaintenance(res, maintenance.maintenanceMessage);
    }
    if (maintenance.disablePOS && isPosRoute) {
      return sendMaintenance(res, maintenance.maintenanceMessage);
    }

    return sendMaintenance(res, maintenance.maintenanceMessage);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: "MAINTENANCE_CHECK_ERROR",
      message: "No se pudo validar modo mantenimiento"
    });
  }
};

module.exports = { checkMaintenanceMode };
