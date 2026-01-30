const requireModule = (moduleKey, options = {}) => (req, res, next) => {
  const enabled = req.tenantConfig?.modules?.[moduleKey];
  if (!enabled) {
    return res.status(403).json({
      ok: false,
      data: null,
      message: options.message || `Module disabled: ${moduleKey}`,
      ...(options.code ? { code: options.code } : {})
    });
  }
  return next();
};

module.exports = { requireModule };
