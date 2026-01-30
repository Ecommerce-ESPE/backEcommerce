const mongoose = require("mongoose");
const {
  branchModel,
  serviceTicketModel,
  orderModel
} = require("../../models/index");

const getBranches = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const branches = await branchModel.find({ tenantId }).lean();
    return res.json({ ok: true, data: branches, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo sucursales"
    });
  }
};

const getQueueStatus = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const { branchId, serviceType } = req.params;

    const tickets = await serviceTicketModel
      .find({
        tenantId,
        branchId,
        serviceType,
        status: { $in: ["WAITING", "CALLED", "SERVING"] }
      })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ ok: true, data: tickets, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo cola"
    });
  }
};

const trackCode = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const { code } = req.params;

    const ticket = await serviceTicketModel.findOne({
      tenantId,
      code
    });
    if (ticket) {
      return res.json({
        ok: true,
        data: { type: "ticket", item: ticket },
        message: "OK"
      });
    }

    let order = null;
    if (mongoose.Types.ObjectId.isValid(code)) {
      order = await orderModel.findOne({
        tenantId,
        _id: code
      });
    }

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Código no encontrado"
      });
    }

    return res.json({
      ok: true,
      data: {
        type: "order",
        item: {
          _id: order._id,
          orderNumber: order.orderNumber || "",
          currentStageKey: order.currentStageKey,
          status: order.status,
          createdAt: order.createdAt
        }
      },
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error en tracking"
    });
  }
};

const getReadyOrders = async (req, res) => {
  try {
    const tenantId = req.query.tenantId || "DEFAULT";
    const branchId = req.query.branchId || "DEFAULT";

    const orders = await orderModel.find({
      tenantId,
      branchId,
      currentStageKey: "ready"
    })
      .select("_id orderNumber currentStageKey customerName createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      ok: true,
      data: orders,
      message: "OK"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo pedidos listos"
    });
  }
};

module.exports = {
  getBranches,
  getQueueStatus,
  trackCode,
  getReadyOrders
};
