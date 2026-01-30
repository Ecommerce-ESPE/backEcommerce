const { v4: uuidv4 } = require("uuid");

const ALLOWED_TICKET_STATUSES = new Set(["WAITING", "CALLED", "SERVING"]);

const buildError = (message, code, status) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const resolveCheckoutData = ({
  tenantConfig,
  ticket,
  ticketId,
  tenantId,
  branchId,
  defaultQueueKey = "checkout"
}) => {
  const queuesTicketsEnabled = !!tenantConfig?.modules?.queuesTickets;

  if (!queuesTicketsEnabled) {
    if (ticketId) {
      throw buildError(
        "No se permiten tickets cuando el módulo está deshabilitado",
        "TICKET_NOT_ALLOWED",
        400
      );
    }
    return {
      checkoutMode: "DIRECT",
      checkoutSessionId: uuidv4(),
      queueKey: defaultQueueKey,
      ticketId: null
    };
  }

  if (!ticket) {
    throw buildError("ticketId es requerido", "TICKET_REQUIRED", 400);
  }

  const queue = (tenantConfig?.operations?.queues || []).find(
    (q) => q.key === ticket.serviceType
  );
  if (!queue || !queue.enabled) {
    throw buildError("Tipo de servicio no habilitado", "QUEUE_DISABLED", 403);
  }

  if (tenantId && String(ticket.tenantId) !== String(tenantId)) {
    throw buildError("Ticket no encontrado", "TICKET_NOT_FOUND", 404);
  }

  if (branchId && String(ticket.branchId) !== String(branchId)) {
    throw buildError("Ticket no encontrado", "TICKET_NOT_FOUND", 404);
  }

  if (!ALLOWED_TICKET_STATUSES.has(ticket.status)) {
    throw buildError(
      "Ticket no está disponible para consumo",
      "TICKET_NOT_OPEN",
      409
    );
  }

  if (ticket.serviceType !== defaultQueueKey) {
    throw buildError(
      "Ticket no pertenece a la cola requerida",
      "TICKET_WRONG_QUEUE",
      409
    );
  }

  return {
    checkoutMode: "TICKET",
    checkoutSessionId: null,
    queueKey: ticket.serviceType,
    ticketId: ticket._id
  };
};

module.exports = {
  resolveCheckoutData,
  ALLOWED_TICKET_STATUSES
};
