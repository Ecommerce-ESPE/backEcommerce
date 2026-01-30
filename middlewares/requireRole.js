const hasAnyRole = (membership, roles = []) => {
  if (!membership || !membership.active) return false;
  if (membership.roles.includes("TENANT_ADMIN")) return true;
  return roles.some((role) => membership.roles.includes(role));
};

const requireRole = (roles = []) => (req, res, next) => {
  const membership = req.membership;
  if (!hasAnyRole(membership, roles)) {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Permisos insuficientes"
    });
  }
  return next();
};

module.exports = { requireRole };
