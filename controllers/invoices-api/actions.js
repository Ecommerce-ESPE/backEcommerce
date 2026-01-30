const {
  orderModel,
  transactionModel,
  invoiceModel
} = require("../../models/index");
const { createInvoice } = require("../../services/invoices/invoiceService");

const createInvoiceForOrder = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const { id } = req.params;

    const order = await orderModel.findById(id);
    if (!order) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Orden no encontrada"
      });
    }

    if (order.tenantId && order.tenantId !== tenantId) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Orden fuera de alcance del tenant"
      });
    }

    let invoice = await invoiceModel.findOne({ orderId: order._id, tenantId });
    if (invoice) {
      return res.json({ ok: true, data: invoice, message: "Factura existente" });
    }

    const transaction = await transactionModel.findOne({ orderId: order._id });
    if (!transaction) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "La orden no tiene transacción asociada"
      });
    }

    invoice = await createInvoice(
      order,
      transaction,
      "ISSUED",
      0,
      undefined,
      req.tenantConfig,
      req.branch
    );

    return res.json({
      ok: true,
      data: invoice,
      message: "Factura generada"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error generando factura"
    });
  }
};

const getInvoiceAdmin = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const { id } = req.params;

    const invoice = await invoiceModel.findOne({ _id: id, tenantId });
    if (!invoice) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Factura no encontrada"
      });
    }

    return res.json({ ok: true, data: invoice, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo factura"
    });
  }
};

const getInvoiceCustomer = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const { id } = req.params;

    const invoice = await invoiceModel.findOne({ _id: id, tenantId });
    if (!invoice) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Factura no encontrada"
      });
    }

    const order = await orderModel.findById(invoice.orderId);
    if (!order || String(order.userId) !== String(req.uid)) {
      return res.status(403).json({
        ok: false,
        data: null,
        message: "Acceso denegado"
      });
    }

    return res.json({ ok: true, data: invoice, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo factura"
    });
  }
};

module.exports = {
  createInvoiceForOrder,
  getInvoiceAdmin,
  getInvoiceCustomer
};
