const { serviceTicketModel } = require("../../models/index");
const { buildTicketNumber } = require("../../utils/numbering");

const createTicket = async ({
  tenantId,
  branchId,
  serviceType,
  config,
  meta
}) => {
  const queue = (config?.operations?.queues || []).find(
    (q) => q.key === serviceType
  );
  const prefix = queue?.ticketPrefix || "T";
  const format = config?.numbers?.ticketNumber?.format || "T-{YYYY}{MM}{DD}-{SEQ}";
  const { code, seq, dayKey } = await buildTicketNumber(
    tenantId,
    branchId,
    serviceType,
    format,
    prefix
  );

  const ticket = new serviceTicketModel({
    tenantId,
    branchId,
    serviceType,
    code,
    seq,
    dayKey,
    meta: meta || {}
  });

  return ticket.save();
};

const claimNextTicket = async ({
  tenantId,
  branchId,
  serviceType,
  userId
}) => {
  const now = new Date();
  return serviceTicketModel.findOneAndUpdate(
    {
      tenantId,
      branchId,
      serviceType,
      status: "WAITING"
    },
    {
      $set: {
        status: "CALLED",
        assignedToUserId: userId,
        assignedAt: now,
        calledAt: now
      }
    },
    { new: true, sort: { createdAt: 1 } }
  );
};

const startTicket = async (ticketId, userId) =>
  serviceTicketModel.findOneAndUpdate(
    { _id: ticketId, assignedToUserId: userId, status: { $in: ["CALLED"] } },
    { $set: { status: "SERVING", servingAt: new Date() } },
    { new: true }
  );

const closeTicket = async (ticketId, userId) =>
  serviceTicketModel.findOneAndUpdate(
    { _id: ticketId, assignedToUserId: userId, status: { $in: ["SERVING", "CALLED"] } },
    { $set: { status: "CLOSED", closedAt: new Date() } },
    { new: true }
  );

const skipTicket = async (ticketId) =>
  serviceTicketModel.findOneAndUpdate(
    { _id: ticketId, status: { $in: ["WAITING", "CALLED"] } },
    { $set: { status: "SKIPPED", closedAt: new Date() } },
    { new: true }
  );

module.exports = {
  createTicket,
  claimNextTicket,
  startTicket,
  closeTicket,
  skipTicket
};
