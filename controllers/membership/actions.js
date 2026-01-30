const bcrypt = require("bcryptjs");
const { membershipModel, userModel } = require("../../models/index");

const createAdminUser = async (payload) => {
  const { name, email, password, phone, ci } = payload;
  const existing = await userModel.findOne({ email });
  if (existing) return { user: existing, created: false };

  const tempPassword =
    password || Math.random().toString(36).slice(2, 12);

  const user = new userModel({
    name,
    email,
    password: tempPassword,
    ci: ci || "",
    phone: phone || "",
    role: "USER",
    credits: 0
  });

  const salt = bcrypt.genSaltSync();
  user.password = bcrypt.hashSync(tempPassword, salt);
  await user.save();

  return { user, created: true, tempPassword: password ? null : tempPassword };
};

const createUserAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, ci } = req.body || {};
    if (!email || !name) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "name y email son requeridos"
      });
    }

    const result = await createAdminUser({
      name,
      email,
      password,
      phone,
      ci
    });

    return res.json({
      ok: true,
      data: {
        user: result.user,
        created: result.created,
        ...(result.tempPassword ? { tempPassword: result.tempPassword } : {})
      },
      message: result.created ? "Usuario creado" : "Usuario existente"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error creando usuario"
    });
  }
};

const createMembership = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const { userId, roles, branchIds, active } = req.body || {};

    if (!userId || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "userId y roles son requeridos"
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Usuario no encontrado"
      });
    }

    const membership = await membershipModel.findOneAndUpdate(
      { tenantId, userId },
      {
        $set: {
          roles,
          branchIds: branchIds || [],
          active: typeof active === "boolean" ? active : true
        }
      },
      { new: true, upsert: true }
    );

    return res.json({
      ok: true,
      data: membership,
      message: "Membresía asignada"
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: error.message || "Error asignando membresía"
    });
  }
};

const getMemberships = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.query.branchId;

    const filter = { tenantId };
    if (branchId) {
      filter.$or = [
        { branchIds: "*" },
        { branchIds: branchId }
      ];
    }

    const memberships = await membershipModel
      .find(filter)
      .populate("userId", "name email role")
      .lean();

    return res.json({
      ok: true,
      data: memberships,
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo membresías"
    });
  }
};

const updateMembership = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles, branchIds, active } = req.body || {};

    const update = {};
    if (roles) update.roles = roles;
    if (branchIds) update.branchIds = branchIds;
    if (typeof active === "boolean") update.active = active;

    const membership = await membershipModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );

    if (!membership) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Membresía no encontrada"
      });
    }

    return res.json({
      ok: true,
      data: membership,
      message: "Membresía actualizada"
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: error.message || "Error actualizando membresía"
    });
  }
};

module.exports = {
  createUserAdmin,
  createMembership,
  getMemberships,
  updateMembership
};
