const { orderModel, walletTransactionModel, userModel } = require("../../models/index");
const { moment } = require("../../config/components/timeConfig");

const buildDateLabel = (date) => {
  if (!date) return null;
  const m = moment(date);
  if (m.isSame(moment(), "day")) return "Hoy";
  if (m.isSame(moment().subtract(1, "day"), "day")) return "Ayer";
  return m.format("DD MMM");
};

const resolvePrimaryAddress = (addresses) => {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return addresses.find((addr) => addr?.isPrimary === true) || addresses[0] || null;
};

const getActivity = async (req, res) => {
  try {
    const userId = req.uid;
    if (!userId) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(req.query.limit, 10) || 6, 50);
    const fetchLimit = Math.min(200, limitNum * pageNum * 3);

    const [orders, walletTx, user] = await Promise.all([
      orderModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .select("orderNumber total createdAt deliveryStatus deliveryStatusNormalized deliveryDeliveredAt updatedAt")
        .lean(),
      walletTransactionModel
        .find({ userId, status: "completed" })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .select("type amountCents currency createdAt")
        .lean(),
      userModel.findById(userId).select("address updatedAt").lean()
    ]);

    const events = [];

    orders.forEach((order) => {
      events.push({
        type: "purchase",
        title: "Compra realizada",
        amount: Number(order.total || 0),
        currency: "USD",
        when: order.createdAt,
        label: buildDateLabel(order.createdAt),
        orderNumber: order.orderNumber || null
      });

      const delivered =
        order.deliveryStatusNormalized === "delivered" ||
        order.deliveryStatus === "DELIVERED";
      if (delivered) {
        const when = order.deliveryDeliveredAt || order.updatedAt || order.createdAt;
        events.push({
          type: "delivery",
          title: "Pedido entregado",
          when,
          label: buildDateLabel(when),
          orderNumber: order.orderNumber || null
        });
      }
    });

    walletTx.forEach((tx) => {
      const isCredit = tx.type === "credit";
      events.push({
        type: isCredit ? "wallet_credit" : "wallet_debit",
        title: isCredit ? "Créditos canjeados" : "Compra con créditos",
        amount: Number(((tx.amountCents || 0) / 100).toFixed(2)),
        currency: tx.currency || "USD",
        when: tx.createdAt,
        label: buildDateLabel(tx.createdAt)
      });
    });

    const primaryAddress = resolvePrimaryAddress(user?.address);
    if (user?.updatedAt) {
      events.push({
        type: "profile_update",
        title: "Perfil actualizado",
        when: user.updatedAt,
        label: buildDateLabel(user.updatedAt)
      });
      if (primaryAddress?.canton || primaryAddress?.provincia) {
        const subtitle = [primaryAddress.canton, primaryAddress.provincia]
          .filter(Boolean)
          .join(", ");
        events.push({
          type: "address_update",
          title: "Dirección actualizada",
          subtitle,
          when: user.updatedAt,
          label: buildDateLabel(user.updatedAt)
        });
      }
    }

    events.sort((a, b) => new Date(b.when) - new Date(a.when));

    const total = events.length;
    const start = (pageNum - 1) * limitNum;
    const data = events.slice(start, start + limitNum);

    return res.json({
      data,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error obteniendo actividad",
      detail: error.message
    });
  }
};

module.exports = {
  getActivity
};
