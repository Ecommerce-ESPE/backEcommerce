const {
  serviceTicketModel,
  staffSessionModel
} = require("../../models/index");
const {
  createTicket,
  claimNextTicket,
  startTicket,
  closeTicket,
  skipTicket
} = require("../../services/operations/ticketService");
const { emitEvent } = require("../../services/socket");

const sendError = (res, status, message, code) =>
  res.status(status).json({
    ok: false,
    data: null,
    message,
    ...(code ? { code } : {})
  });

const isQueueEnabled = (config, serviceType) =>
  (config?.operations?.queues || []).some(
    (q) => q.key === serviceType && q.enabled
  );

const getMaxActiveTasks = (config, role) =>
  config?.operations?.staff?.maxActiveTasks?.[role] || 1;

const countActiveTicketsForUser = async (tenantId, branchId, userId) =>
  serviceTicketModel.countDocuments({
    tenantId,
    branchId,
    assignedToUserId: userId,
    status: { $in: ["CALLED", "SERVING"] }
  });

const createTicketHandler = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const { serviceType, meta } = req.body || {};

    if (!serviceType) {
      return sendError(res, 400, "serviceType es requerido", "SERVICE_TYPE_REQUIRED");
    }

    if (!isQueueEnabled(req.tenantConfig, serviceType)) {
      return sendError(res, 403, "Tipo de servicio no habilitado", "QUEUE_DISABLED");
    }

    const ticket = await createTicket({
      tenantId,
      branchId,
      serviceType,
      config: req.tenantConfig,
      meta
    });

    emitEvent("tickets:update", {
      action: "CREATED",
      tenantId,
      branchId,
      serviceType,
      ticketId: ticket._id,
      status: ticket.status,
      code: ticket.code
    });

    return res.json({
      ok: true,
      data: ticket,
      message: "Ticket creado"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error creando ticket"
    });
  }
};

const claimNextTicketHandler = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = req.branchId || "DEFAULT";
    const userId = req.uid;
    const { serviceType } = req.body || {};

    if (!serviceType) {
      return sendError(res, 400, "serviceType es requerido", "SERVICE_TYPE_REQUIRED");
    }

    if (!isQueueEnabled(req.tenantConfig, serviceType)) {
      return sendError(res, 403, "Tipo de servicio no habilitado", "QUEUE_DISABLED");
    }

    const maxActive = getMaxActiveTasks(req.tenantConfig, "CASHIER");
    const activeCount = await countActiveTicketsForUser(
      tenantId,
      branchId,
      userId
    );
    if (activeCount >= maxActive) {
      return res.status(409).json({
        ok: false,
        data: null,
        message: "Límite de tareas activas alcanzado"
      });
    }

    const ticket = await claimNextTicket({
      tenantId,
      branchId,
      serviceType,
      userId
    });

    if (!ticket) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "No hay tickets en espera"
      });
    }

    await staffSessionModel.updateOne(
      { tenantId, branchId, userId },
      {
        $set: {
          status: "BUSY",
          activeTask: { type: "TICKET", id: ticket._id }
        }
      }
    );

    emitEvent("tickets:update", {
      action: "CLAIMED",
      tenantId,
      branchId,
      serviceType,
      ticketId: ticket._id,
      status: ticket.status,
      code: ticket.code,
      assignedToUserId: ticket.assignedToUserId
    });

    return res.json({
      ok: true,
      data: ticket,
      message: "Ticket asignado"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error asignando ticket"
    });
  }
};

const startTicketHandler = async (req, res) => {
  try {
    const ticket = await startTicket(req.params.id, req.uid);
    if (!ticket) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Ticket no encontrado o no asignado"
      });
    }

    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      { $set: { status: "BUSY", activeTask: { type: "TICKET", id: ticket._id } } }
    );

    emitEvent("tickets:update", {
      action: "STARTED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      ticketId: ticket._id,
      status: ticket.status,
      code: ticket.code,
      assignedToUserId: ticket.assignedToUserId
    });

    return res.json({ ok: true, data: ticket, message: "Ticket en servicio" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error iniciando ticket"
    });
  }
};

const closeTicketHandler = async (req, res) => {
  try {
    const ticket = await closeTicket(req.params.id, req.uid);
    if (!ticket) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Ticket no encontrado o no asignado"
      });
    }

    await staffSessionModel.updateOne(
      { tenantId: req.tenantId, branchId: req.branchId, userId: req.uid },
      { $set: { status: "AVAILABLE", activeTask: { type: "NONE" } } }
    );

    emitEvent("tickets:update", {
      action: "CLOSED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      ticketId: ticket._id,
      status: ticket.status,
      code: ticket.code
    });

    return res.json({ ok: true, data: ticket, message: "Ticket cerrado" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error cerrando ticket"
    });
  }
};

const skipTicketHandler = async (req, res) => {
  try {
    const ticket = await skipTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Ticket no encontrado"
      });
    }

    if (ticket.assignedToUserId) {
      await staffSessionModel.updateOne(
        {
          tenantId: req.tenantId,
          branchId: req.branchId,
          userId: ticket.assignedToUserId
        },
        { $set: { status: "AVAILABLE", activeTask: { type: "NONE" } } }
      );
    }

    emitEvent("tickets:update", {
      action: "SKIPPED",
      tenantId: req.tenantId,
      branchId: req.branchId,
      ticketId: ticket._id,
      status: ticket.status,
      code: ticket.code
    });

    return res.json({ ok: true, data: ticket, message: "Ticket omitido" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error omitiendo ticket"
    });
  }
};

module.exports = {
  createTicketHandler,
  claimNextTicketHandler,
  startTicketHandler,
  closeTicketHandler,
  skipTicketHandler
};
