const { counterModel } = require("../models/index");

const getDayKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

const nextSequence = async (counterId) => {
  const counter = await counterModel.findByIdAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

const formatNumber = (format, date, seq, seqPad = 4) => {
  const d = new Date(date);
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const SEQ = String(seq).padStart(seqPad, "0");
  return format
    .replace("{YYYY}", YYYY)
    .replace("{MM}", MM)
    .replace("{DD}", DD)
    .replace("{SEQ}", SEQ);
};

const buildOrderNumber = async (tenantId, branchId, format) => {
  const dayKey = getDayKey();
  const counterId = `order:${tenantId}:${branchId}:${dayKey}`;
  const seq = await nextSequence(counterId);
  const fmt = format || "ORD-{YYYY}{MM}{DD}-{SEQ}";
  return formatNumber(fmt, new Date(), seq);
};

const applyPrefixToFormat = (format, prefix) => {
  const safePrefix = prefix ? String(prefix).toUpperCase() : "T";
  if (format.includes("{PREFIX}")) {
    return format.replace("{PREFIX}", safePrefix);
  }
  return format.replace(/^T/, safePrefix);
};

const buildTicketNumber = async (tenantId, branchId, serviceType, format, prefix) => {
  const dayKey = getDayKey();
  const counterId = `ticket:${tenantId}:${branchId}:${serviceType}:${dayKey}`;
  const seq = await nextSequence(counterId);
  const fmt = applyPrefixToFormat(format || "T-{YYYY}{MM}{DD}-{SEQ}", prefix);
  return {
    code: formatNumber(fmt, new Date(), seq),
    seq,
    dayKey
  };
};

module.exports = {
  buildOrderNumber,
  buildTicketNumber,
  formatNumber
};
