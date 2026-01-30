const requireScope = () => (req, res, next) => {
  const membership = req.membership;
  if (!membership || !membership.active) {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "Membresía inactiva"
    });
  }

  if (membership.roles.includes("TENANT_ADMIN")) {
    return next();
  }

  const branchId = req.branchId;
  const branchIds = membership.branchIds || [];
  if (branchIds.includes("*") || branchIds.includes(branchId)) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    data: null,
    message: "Acceso restringido a la sucursal"
  });
};

module.exports = { requireScope };
