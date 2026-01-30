const { staffSessionModel } = require("../../models/index");

const heartbeat = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const userId = req.uid;
    const { role } = req.body || {};

    if (!role) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "role es requerido"
      });
    }

    if (!req.membership?.roles?.includes(role)) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Rol no permitido"
      });
    }

    const now = new Date();
    const session = await staffSessionModel.findOneAndUpdate(
      { tenantId, branchId, userId },
      {
        $set: {
          role,
          lastHeartbeatAt: now,
          status: "AVAILABLE"
        }
      },
      { new: true, upsert: true }
    );

    return res.json({
      ok: true,
      data: session,
      message: "Heartbeat actualizado"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error en heartbeat"
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const userId = req.uid;
    const { status } = req.body || {};

    const validStatuses = ["AVAILABLE", "BUSY", "PAUSED", "OFFLINE"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "Status inválido"
      });
    }

    const session = await staffSessionModel.findOneAndUpdate(
      { tenantId, branchId, userId },
      { $set: { status } },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Sesión no encontrada"
      });
    }

    return res.json({
      ok: true,
      data: session,
      message: "Status actualizado"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error actualizando status"
    });
  }
};

const getMe = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const userId = req.uid;

    const session = await staffSessionModel.findOne({
      tenantId,
      branchId,
      userId
    });

    return res.json({
      ok: true,
      data: {
        session,
        membership: req.membership || null,
        branch: req.branch || null
      },
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo sesión"
    });
  }
};

module.exports = {
  heartbeat,
  updateStatus,
  getMe
};
