// Ruta para canjear un código

const {
  userModel,

  redemptionCodeModel,

  discountModel,

  itemModel,

  walletModel,

  walletTransactionModel,
} = require("../models/index");

const mongoose = require("mongoose");

const Decimal = require("decimal.js");

const {
  getOrCreateWallet,
  updateUserCreditsMirror,
  toCents,
} = require("../services/walletLedger");

const createRedemptionCode = async (req, res) => {
  const { body } = req;

  const data = await redemptionCodeModel.create(body);

  res.json({
    msg: "Succesfull",

    code: data,
  });
};

const redemptionCode = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.params.userId;

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
        response = {
          status: 409,
          body: {
            message: "El codigo ya ha sido canjeado",
            newBalance: Number(
              ((existingTx.balanceAfterCents || 0) / 100).toFixed(2),
            ),
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
};
