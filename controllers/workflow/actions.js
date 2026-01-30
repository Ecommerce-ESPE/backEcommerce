const { orderModel, staffSessionModel } = require("../../models/index");
const {
  getEnabledStages,
  claimNextOrderStage,
  claimOrderStage,
  startOrderStage,
  completeOrderStage
} = require("../../services/operations/workflowService");
const { emitEvent } = require("../../services/socket");

const getStageConfig = (config, stageKey) =>
  getEnabledStages(config).find((stage) => stage.key === stageKey);

const requireStageRole = (req, stage) => {
  if (!stage?.role) return true;
  return req.membership?.roles?.includes(stage.role);
};

const listOrdersByStage = async (req, res) => {
  try {
    const { stageKey } = req.params;
    const stage = getStageConfig(req.tenantConfig, stageKey);
    if (!stage || !stage.enabled) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Etapa no encontrada"
      });
    }

    if (!requireStageRole(req, stage)) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Rol no autorizado"
      });
    }

    const orders = await orderModel.find({
      tenantId: req.tenantId,
      branchId: req.branchId,
      currentStageKey: stageKey
    });

    return res.json({ ok: true, data: orders, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo órdenes"
    });
  }
};

const claimNextStage = async (req, res) => {
  try {
    const { stageKey } = req.params;
    const stage = getStageConfig(req.tenantConfig, stageKey);
    if (!stage || !stage.enabled) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Etapa no encontrada"
      });
    }

    if (!requireStageRole(req, stage)) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Rol no autorizado"
      });
    }

    const maxActive =
      req.tenantConfig?.operations?.staff?.maxActiveTasks?.[stage.role] || 1;
    const activeCount = await orderModel.countDocuments({
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageHistory: {
        $elemMatch: {
          assignedTo: req.uid,
          status: { $in: ["ASSIGNED", "IN_PROGRESS"] }
        }
      }
    });
    if (activeCount >= maxActive) {
      return res.status(409).json({
        ok: false,
        data: null,
        message: "Límite de tareas activas alcanzado"
      });
    }

    const order = await claimNextOrderStage({
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      userId: req.uid,
      role: stage.role
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "No hay órdenes en la etapa"
      });
    }

    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      {
        $set: {
          status: "BUSY",
          activeTask: { type: "ORDER_STAGE", id: order._id, stageKey }
        }
      }
    );

    emitEvent("workflow:update", {
      action: "CLAIMED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      orderId: order._id
    });

    return res.json({ ok: true, data: order, message: "Orden asignada" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error asignando orden"
    });
  }
};

const claimStageByOrder = async (req, res) => {
  try {
    const { stageKey, id } = req.params;
    const stage = getStageConfig(req.tenantConfig, stageKey);
    if (!stage || !stage.enabled) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Etapa no encontrada"
      });
    }

    if (!requireStageRole(req, stage)) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Rol no autorizado"
      });
    }

    const maxActive =
      req.tenantConfig?.operations?.staff?.maxActiveTasks?.[stage.role] || 1;
    const activeCount = await orderModel.countDocuments({
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageHistory: {
        $elemMatch: {
          assignedTo: req.uid,
          status: { $in: ["ASSIGNED", "IN_PROGRESS"] }
        }
      }
    });
    if (activeCount >= maxActive) {
      return res.status(409).json({
        ok: false,
        data: null,
        message: "Límite de tareas activas alcanzado"
      });
    }

    const order = await claimOrderStage({
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      orderId: id,
      userId: req.uid,
      role: stage.role
    });

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no disponible"
      });
    }

    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      {
        $set: {
          status: "BUSY",
          activeTask: { type: "ORDER_STAGE", id: order._id, stageKey }
        }
      }
    );

    emitEvent("workflow:update", {
      action: "CLAIMED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      orderId: order._id
    });

    return res.json({ ok: true, data: order, message: "Orden asignada" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error asignando orden"
    });
  }
};

const startStage = async (req, res) => {
  try {
    const { id, stageKey } = req.params;
    const order = await startOrderStage(id, stageKey, req.uid);
    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no encontrada o no asignada"
      });
    }
    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      {
        $set: {
          status: "BUSY",
          activeTask: { type: "ORDER_STAGE", id: order._id, stageKey }
        }
      }
    );

    emitEvent("workflow:update", {
      action: "STARTED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      orderId: order._id
    });
    return res.json({ ok: true, data: order, message: "Etapa iniciada" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error iniciando etapa"
    });
  }
};

const completeStage = async (req, res) => {
  try {
    const { id, stageKey } = req.params;
    const order = await completeOrderStage(
      id,
      stageKey,
      req.uid,
      req.tenantConfig
    );
    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no encontrada o no asignada"
      });
    }
    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      { $set: { status: "AVAILABLE", activeTask: { type: "NONE" } } }
    );

    emitEvent("workflow:update", {
      action: "COMPLETED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      stageKey,
      orderId: order._id,
      currentStageKey: order.currentStageKey
    });

    if (order.currentStageKey === "ready") {
      emitEvent("orders:ready", {
        tenantId: req.tenantId,
        branchId: req.branchId,
        orderId: order._id,
        orderNumber: order.orderNumber || ""
      });
    }
    return res.json({ ok: true, data: order, message: "Etapa completada" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error completando etapa"
    });
  }
};

module.exports = {
  listOrdersByStage,
  claimNextStage,
  claimStageByOrder,
  startStage,
  completeStage
};
