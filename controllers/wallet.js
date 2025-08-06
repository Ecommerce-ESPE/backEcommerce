// Ruta para canjear un código

const {
  userModel,
  redemptionCodeModel,
  discountModel,
  itemModel,
} = require("../models/index");
const mongoose = require("mongoose");
const Decimal = require("decimal.js");

const createRedemptionCode = async (req, res) => {
  const { body } = req;
  const data = await redemptionCodeModel.create(body);

  res.json({
    msg: "Succesfull",
    code: data,
  });
};

const redemptionCode = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    console.log(user);
    const codeToRedeem = req.body.code;

    const redemptionCode = await redemptionCodeModel.findOne({
      code: codeToRedeem,
    });

    if (!redemptionCode) {
      return res.status(400).json({ message: "Código de canje no válido" });
    }

    if (redemptionCode.redeemed) {
      return res.status(400).json({ message: "El código ya ha sido canjeado" });
    }

    user.credits += redemptionCode.value;
    redemptionCode.redeemed = true;

    await user.save();
    await redemptionCode.save();

    res.json({ message: "Canje exitoso", newBalance: user.credits });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error });
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
      return res.status(404).json({ message: "No se encontraron códigos de descuento" });
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
        message: "Formato de carrito inválido"
      });
    }

    if (cartItems.length === 0) {
      return res.status(400).json({
        valid: false,
        message: "El carrito está vacío"
      });
    }

    // Validación de IDs de productos
    const validItemIds = cartItems
      .map((item) => item.productId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validItemIds.length === 0) {
      return res.status(400).json({
        valid: false,
        message: "IDs de producto inválidos"
      });
    }

    // Obtener productos de la base de datos
    const items = await itemModel.find({ _id: { $in: validItemIds } });

    if (items.length !== cartItems.length) {
      return res.status(400).json({
        valid: false,
        message: "Algunos productos no existen"
      });
    }

    // Calcular subtotal validando precios
    let subtotal = new Decimal(0);
    const validatedItems = [];

    for (const cartItem of cartItems) {
      const product = items.find(item => item._id.toString() === cartItem.productId);

      if (!product) continue;

      const variant = product.value.find(v =>
        v.originalPrice === Number(cartItem.price) ||
        v.discountPrice === Number(cartItem.price)
      );

      if (!variant) {
        return res.status(400).json({
          valid: false,
          message: `Precio no válido para el producto ${product.nameProduct}`
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
        variant: variant.size
      });
    }

    // Validar mínimo de compra
    if (subtotal.lessThan(10)) {
      return res.json({
        valid: false,
        discountAmount: 0,
        message: "Mínimo de compra no alcanzado ($10)"
      });
    }

    // Procesar código de descuento si existe
    let discountAmount = new Decimal(0);
    let message = "Descuento aplicado correctamente";

    if (discountCode) {
      const discount = await discountModel.findOne({ code: discountCode.trim() });

      if (!discount) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: "Código de descuento no encontrado"
        });
      }

      if (!discount.isValid) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: "Este descuento no está activo"
        });
      }

      if (discount.expiresAt <= new Date()) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: `El descuento expiró el ${discount.expiresAt.toLocaleDateString()}`
        });
      }

      const minPurchase = new Decimal(discount.minPurchase || 10);
      if (subtotal.lessThan(minPurchase)) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: `Requieres al menos $${minPurchase.toFixed(2)} para este descuento`
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
          message: "Tipo de descuento inválido"
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
      ...(discountCode && { discountCode })
    });

  } catch (error) {
    console.error("Error en validateDiscount:", error);
    res.status(500).json({
      valid: false,
      message: "Error interno del servidor",
      error: error.message
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
