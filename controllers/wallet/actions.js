// Ruta para canjear un código

const {
  userModel,

  redemptionCodeModel,

  discountModel,

  itemModel,

  walletModel,

  walletTransactionModel,
} = require("../../models/index");

const mongoose = require("mongoose");

const Decimal = require("decimal.js");

const {
  getOrCreateWallet,
  updateUserCreditsMirror,
  toCents,
  toCredits,
} = require("../../services/walletLedger");
const { moment } = require("../../config/components/timeConfig");

const getMyWallet = async (req, res) => {
  try {
    const userId = req.uid;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const wallet = await getOrCreateWallet(userId);
    return res.json({
      wallet: {
        id: wallet._id,
        userId: wallet.userId,
        balanceCents: wallet.balanceCents,
        balance: toCredits(wallet.balanceCents),
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
};

const getMyWalletTransactions = async (req, res) => {
  try {
    const userId = req.uid;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const limitRaw = Number.parseInt(req.query.limit, 10);
    const skipRaw = Number.parseInt(req.query.skip, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
    const skip = Number.isFinite(skipRaw) && skipRaw >= 0 ? skipRaw : 0;

    const [wallet, transactions] = await Promise.all([
      getOrCreateWallet(userId),
      walletTransactionModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const safeTransactions = transactions.map((tx) => ({
      createdAt: tx.createdAt,
      amountCents: tx.amountCents,
      currency: tx.currency,
      balanceAfterCents: tx.balanceAfterCents,
      type: tx.type,
    }));

    return res.json({
      wallet: {
        id: wallet._id,
        userId: wallet.userId,
        balanceCents: wallet.balanceCents,
        balance: toCredits(wallet.balanceCents),
        currency: wallet.currency,
        type: wallet.type,
      },
      pagination: { limit, skip },
      transactions: safeTransactions,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
};

const getWalletSummary = async (req, res) => {
  try {
    const userId = req.uid;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    const wallet = await getOrCreateWallet(userId);
    const startOfMonth = moment().startOf("month").toDate();
    const endOfMonth = moment().endOf("month").toDate();

    const summary = await walletTransactionModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "completed",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: "$type",
          totalCents: { $sum: "$amountCents" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totals = summary.reduce(
      (acc, row) => {
        if (row._id === "credit") {
          acc.creditCents = row.totalCents || 0;
          acc.creditCount = row.count || 0;
        }
        if (row._id === "debit") {
          acc.debitCents = row.totalCents || 0;
          acc.debitCount = row.count || 0;
        }
        return acc;
      },
      { creditCents: 0, debitCents: 0, creditCount: 0, debitCount: 0 }
    );

    const startOfPrevMonth = moment().subtract(1, "month").startOf("month").toDate();
    const endOfPrevMonth = moment().subtract(1, "month").endOf("month").toDate();

    const prevSummary = await walletTransactionModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "completed",
          createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth }
        }
      },
      {
        $group: {
          _id: "$type",
          totalCents: { $sum: "$amountCents" },
          count: { $sum: 1 }
        }
      }
    ]);

    const prevTotals = prevSummary.reduce(
      (acc, row) => {
        if (row._id === "credit") {
          acc.creditCents = row.totalCents || 0;
          acc.creditCount = row.count || 0;
        }
        if (row._id === "debit") {
          acc.debitCents = row.totalCents || 0;
          acc.debitCount = row.count || 0;
        }
        return acc;
      },
      { creditCents: 0, debitCents: 0, creditCount: 0, debitCount: 0 }
    );

    const percentChange = (current, previous) => {
      if (!previous && !current) return 0;
      if (!previous) return 100;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    const netCents = totals.creditCents - totals.debitCents;
    const prevNetCents = prevTotals.creditCents - prevTotals.debitCents;

    return res.json({
      balance: toCredits(wallet.balanceCents),
      currency: wallet.currency || "USD",
      rechargedThisMonth: toCredits(totals.creditCents),
      spentThisMonth: toCredits(totals.debitCents),
      netThisMonth: toCredits(netCents),
      rechargedCountThisMonth: totals.creditCount,
      spentCountThisMonth: totals.debitCount,
      rechargedLastMonth: toCredits(prevTotals.creditCents),
      spentLastMonth: toCredits(prevTotals.debitCents),
      netLastMonth: toCredits(prevNetCents),
      rechargedChangePercent: percentChange(totals.creditCents, prevTotals.creditCents),
      spentChangePercent: percentChange(totals.debitCents, prevTotals.debitCents),
      netChangePercent: percentChange(netCents, prevNetCents),
      monthRange: {
        from: startOfMonth,
        to: endOfMonth
      },
      previousMonthRange: {
        from: startOfPrevMonth,
        to: endOfPrevMonth
      }
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
};

const createRedemptionCode = async (req, res) => {
  try {
    const { code, value, expiresAt } = req.body || {};
    const createdBy = req.uid;

    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Codigo invalido" });
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return res.status(400).json({ message: "Valor invalido" });
    }

    const payload = {
      code: code.trim(),
      value: numericValue,
      createdBy,
      ...(expiresAt ? { expiresAt } : {}),
    };

    const data = await redemptionCodeModel.create(payload);

    return res.json({
      msg: "Succesfull",
      code: data,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
};

const redemptionCode = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.uid || req.params.userId;

    const codeToRedeem = req.body.code;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Usuario invalido" });
    }

    if (!codeToRedeem || typeof codeToRedeem !== "string") {
      return res.status(400).json({ message: "Codigo invalido" });
    }

    const idempotencyKey = `redeem:${codeToRedeem}`;

    const now = new Date();

    let response = null;

    await session.withTransaction(async () => {
      const user = await userModel.findById(userId).session(session);

      if (!user) {
        response = { status: 404, body: { message: "Usuario no encontrado" } };

        return;
      }

      const existingTx = await walletTransactionModel

        .findOne({ idempotencyKey })

        .session(session)

        .lean();

      if (existingTx) {
        const wallet = await walletModel.findOne({ userId }).session(session);
        const balanceCents = wallet?.balanceCents || 0;
        response = {
          status: 409,
          body: {
            message: "El codigo ya ha sido canjeado",
            newBalance: Number((balanceCents / 100).toFixed(2)),
          },
        };
        return;
      }

      const existingCode = await redemptionCodeModel

        .findOne({ code: codeToRedeem })

        .session(session);

      if (!existingCode) {
        response = {
          status: 400,
          body: { message: "Codigo de canje no valido" },
        };

        return;
      }

      if (existingCode.redeemed) {
        const wallet = await walletModel.findOne({ userId }).session(session);
        const balanceCents = wallet?.balanceCents || 0;
        response = {
          status: 409,
          body: {
            message: "El codigo ya ha sido canjeado",
            newBalance: Number((balanceCents / 100).toFixed(2)),
          },
        };
        return;
      }

      if (existingCode.expiresAt && existingCode.expiresAt <= now) {
        response = { status: 400, body: { message: "El codigo ha expirado" } };

        return;
      }

      const redeemedCode = await redemptionCodeModel.findOneAndUpdate(
        {
          code: codeToRedeem,

          redeemed: false,

          $or: [
            { expiresAt: { $exists: false } },

            { expiresAt: null },

            { expiresAt: { $gt: now } },
          ],
        },

        { $set: { redeemed: true } },

        { new: true, session },
      );

      if (!redeemedCode) {
        response = {
          status: 409,
          body: { message: "El codigo ya ha sido canjeado" },
        };
        return;
      }

      const amountCents = toCents(redeemedCode.value);

      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        response = {
          status: 400,
          body: { message: "Monto de canje invalido" },
        };

        return;
      }

      await getOrCreateWallet(userId, session);

      const updatedWallet = await walletModel.findOneAndUpdate(
        { userId },

        { $inc: { balanceCents: amountCents } },

        { new: true, session },
      );

      const balanceAfterCents = updatedWallet.balanceCents;

      await walletTransactionModel.create(
        [
          {
            userId,

            type: "credit",

            amountCents,

            currency: "USD",

            status: "completed",

            idempotencyKey,

            balanceAfterCents,

            metadata: { reason: "redeem_code", note: codeToRedeem },
          },
        ],

        { session },
      );

      const mirrorCredits = await updateUserCreditsMirror(
        userId,

        balanceAfterCents,

        session,
      );

      response = {
        status: 200,

        body: { message: "Canje exitoso", newBalance: mirrorCredits },
      };
    });

    if (!response) {
      return res.status(500).json({ message: "Error interno del servidor" });
    }

    return res.status(response.status).json(response.body);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error interno del servidor", error });
  } finally {
    session.endSession();
  }
};

const creatediscountCode = async (req, res) => {
  const { body } = req;

  const data = await discountModel.create(body);

  res.json({
    msg: "Succesfull",

    code: data,
  });
};

const getDiscountCode = async (req, res) => {
  try {
    const discountCodes = await discountModel.find();

    if (!discountCodes || discountCodes.length === 0) {
      return res
        .status(404)
        .json({ message: "No se encontraron códigos de descuento" });
    }

    res.json({
      msg: "Códigos de descuento encontrados",

      codes: discountCodes,
    });
  } catch (error) {
    console.error("Error al obtener códigos de descuento:", error);

    res.status(500).json({
      msg: "Error interno del servidor al obtener códigos de descuento",

      error: error.message,
    });
  }
};

const validateDiscount = async (req, res) => {
  const { items: cartItems, discountCode } = req.body;

  try {
    // Validación básica del carrito

    if (!Array.isArray(cartItems)) {
      return res.status(400).json({
        valid: false,

        message: "Formato de carrito inválido",
      });
    }

    if (cartItems.length === 0) {
      return res.status(400).json({
        valid: false,

        message: "El carrito está vacío",
      });
    }

    // Validación de IDs de productos

    const validItemIds = cartItems

      .map((item) => item.productId)

      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validItemIds.length === 0) {
      return res.status(400).json({
        valid: false,

        message: "IDs de producto inválidos",
      });
    }

    // Obtener productos de la base de datos

    const items = await itemModel.find({ _id: { $in: validItemIds } });

    if (items.length !== cartItems.length) {
      return res.status(400).json({
        valid: false,

        message: "Algunos productos no existen",
      });
    }

    // Calcular subtotal validando precios

    let subtotal = new Decimal(0);

    const validatedItems = [];

    for (const cartItem of cartItems) {
      const product = items.find(
        (item) => item._id.toString() === cartItem.productId,
      );

      if (!product) continue;

      const variant = product.value.find(
        (v) =>
          v.originalPrice === Number(cartItem.price) ||
          v.discountPrice === Number(cartItem.price),
      );

      if (!variant) {
        return res.status(400).json({
          valid: false,

          message: `Precio no válido para el producto ${product.nameProduct}`,
        });
      }

      const price = new Decimal(cartItem.price);

      const quantity = new Decimal(cartItem.quantity || 1);

      subtotal = subtotal.plus(price.times(quantity));

      validatedItems.push({
        productId: product._id,

        name: product.nameProduct,

        price: price.toNumber(),

        quantity: quantity.toNumber(),

        variant: variant.size,
      });
    }

    // Validar mínimo de compra

    if (subtotal.lessThan(10)) {
      return res.json({
        valid: false,

        discountAmount: 0,

        message: "Mínimo de compra no alcanzado ($10)",
      });
    }

    // Procesar código de descuento si existe

    let discountAmount = new Decimal(0);

    let message = "Descuento aplicado correctamente";

    if (discountCode) {
      const discount = await discountModel.findOne({
        code: discountCode.trim(),
      });

      if (!discount) {
        return res.json({
          valid: false,

          discountAmount: 0,

          message: "Código de descuento no encontrado",
        });
      }

      if (!discount.isValid) {
        return res.json({
          valid: false,

          discountAmount: 0,

          message: "Este descuento no está activo",
        });
      }

      if (discount.expiresAt <= new Date()) {
        return res.json({
          valid: false,

          discountAmount: 0,

          message: `El descuento expiró el ${discount.expiresAt.toLocaleDateString()}`,
        });
      }

      const minPurchase = new Decimal(discount.minPurchase || 10);

      if (subtotal.lessThan(minPurchase)) {
        return res.json({
          valid: false,

          discountAmount: 0,

          message: `Requieres al menos $${minPurchase.toFixed(2)} para este descuento`,
        });
      }

      const amount = new Decimal(discount.amount);

      if (discount.type === "percentage") {
        discountAmount = subtotal.times(amount).toDecimalPlaces(2);

        message = `Descuento del ${amount.times(100)}% aplicado`;
      } else if (discount.type === "fixed") {
        discountAmount = Decimal.min(amount, subtotal).toDecimalPlaces(2);

        message = `Descuento de $${amount.toFixed(2)} aplicado`;
      } else {
        return res.json({
          valid: false,

          discountAmount: 0,

          message: "Tipo de descuento inválido",
        });
      }
    }

    // Respuesta exitosa

    res.json({
      valid: true,

      discountAmount: discountAmount.toNumber(),

      subtotal: subtotal.toNumber(),

      total: subtotal.minus(discountAmount).toNumber(),

      message,

      items: validatedItems,

      ...(discountCode && { discountCode }),
    });
  } catch (error) {
    console.error("Error en validateDiscount:", error);

    res.status(500).json({
      valid: false,

      message: "Error interno del servidor",

      error: error.message,
    });
  }
};

module.exports = {
  redemptionCode,

  createRedemptionCode,

  creatediscountCode,

  validateDiscount,

  getDiscountCode,

  getMyWallet,

  getMyWalletTransactions,
  getWalletSummary,
};
