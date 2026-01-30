const { membershipModel } = require("../models/index");

const resolveMembership = async (req, res, next) => {
  try {
    if (!req.uid) {
      req.membership = null;
      return next();
    }

    const membership = await membershipModel.findOne({
      userId: req.uid,
      tenantId: req.tenantId
    });

    req.membership = membership || null;
    return next();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error resolviendo membresía"
    });
  }
};

module.exports = { resolveMembership };
