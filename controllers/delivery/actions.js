const { orderModel } = require("../../models/index");

const listDeliveryOrders = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const statuses = ["READY", "OUT_FOR_DELIVERY"];

    const orders = await orderModel.find({
      tenantId,
      branchId,
      deliveryStatus: { $in: statuses }
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

const assignDeliveryOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findOneAndUpdate(
      { _id: id, deliveryStatus: { $in: ["READY", null] } },
      {
        $set: {
          deliveryStatus: "READY",
          deliveryStatusNormalized: "assigned",
          deliveryAssignedTo: req.uid,
          deliveryAssignedAt: new Date()
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no disponible"
      });
    }

    return res.json({ ok: true, data: order, message: "Asignado" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error asignando orden"
    });
  }
};

const markOutForDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findOneAndUpdate(
      { _id: id, deliveryAssignedTo: req.uid },
      {
        $set: {
          deliveryStatus: "OUT_FOR_DELIVERY",
          deliveryStatusNormalized: "in_transit",
          deliveryOutAt: new Date()
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no encontrada"
      });
    }

    return res.json({ ok: true, data: order, message: "En camino" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error actualizando orden"
    });
  }
};

const markDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findOneAndUpdate(
      { _id: id, deliveryAssignedTo: req.uid },
      {
        $set: {
          deliveryStatus: "DELIVERED",
          deliveryStatusNormalized: "delivered",
          deliveryDeliveredAt: new Date(),
          status: "completed",
          orderStatus: "completed"
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no encontrada"
      });
    }

    return res.json({ ok: true, data: order, message: "Entregado" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error entregando orden"
    });
  }
};

module.exports = {
  listDeliveryOrders,
  assignDeliveryOrder,
  markOutForDelivery,
  markDelivered
};
