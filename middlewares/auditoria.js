const { registrarAuditoria } = require('../helpers/auditoria');

// Rutas que NO quieres auditar (login, refresh, etc.)
const IGNORE_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/transaction/process',
]);

// También puedes ignorar por prefijo (si tienes varias rutas de auth)
const IGNORE_PREFIXES = [
  // '/api/auth', // <- si quieres ignorar TODO auth, descomenta esto
];

const normalizePath = (originalUrl = '') => String(originalUrl).split('?')[0];

/**
 * Determina si una request debe ser ignorada por auditoría
 */
const shouldIgnoreAudit = (req) => {
  const method = (req.method || '').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const path = normalizePath(req.originalUrl || '');
  if (IGNORE_PATHS.has(path)) return true;

  if (IGNORE_PREFIXES.some((p) => path.startsWith(p))) return true;

  return false;
};

const resolveEntityFromUrl = (originalUrl = '') => {
  const parts = normalizePath(originalUrl).split('/').filter(Boolean);
  const apiIndex = parts.indexOf('api');
  if (apiIndex >= 0 && parts[apiIndex + 1]) return parts[apiIndex + 1];
  return parts[0] || 'unknown';
};

const buildAction = (method, entity) => {
  const verb =
    method === 'POST'
      ? 'CREATE'
      : method === 'PUT' || method === 'PATCH'
        ? 'UPDATE'
        : method === 'DELETE'
          ? 'DELETE'
          : method;

  return `${verb}_${String(entity).toUpperCase()}`;
};

const resolveEntityId = (req, res) =>
  res.locals.auditEntityId ||
  req.params?.id ||
  req.params?._id ||
  req.body?.id ||
  req.body?._id ||
  null;

const auditAuto = (options = {}) => (req, res, next) => {
  if (shouldIgnoreAudit(req)) return next();

  res.on('finish', () => {
    const status = res.statusCode || 0;

    // Opcional: si también quieres ignorar por status (ej. 401/403 en auth), puedes hacerlo aquí
    // if (status === 401 || status === 403) return;

    const entity =
      res.locals.auditEntity ||
      options.entidad ||
      resolveEntityFromUrl(req.originalUrl);

    const actionBase = buildAction((req.method || '').toUpperCase(), entity);
    const action = status >= 400 ? `ERROR_${actionBase}` : actionBase;

    const description =
      res.locals.auditDescription ||
      `${(req.method || '').toUpperCase()} ${req.originalUrl} -> ${status}`;

    registrarAuditoria({
      usuarioId: req.uid || null,
      accion: action,
      descripcion: description,
      entidad: entity,
      entidadId: resolveEntityId(req, res),
      req,
      allowAnonymous: true,
    });
  });

  next();
};

module.exports = { auditAuto };
