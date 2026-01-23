const mongoose = require("mongoose");
const Decimal = require("decimal.js");
const {
  itemModel,
  bannerPromotionModel,
} = require("../../models/index");
const {
  buildPromoIndex,
  resolveUnitPrice,
} = require("./priceResolver");
const { processDiscount } = require("../discounts/discountService");

const validateAndPriceItems = async (items, discountCode, session) => {
  if (!Array.isArray(items)) {
    throw new Error("Formato de items invÃ¡lido: debe ser un array");
  }

  if (items.length === 0) {
    throw new Error("No hay productos en el carrito");
  }

  items.forEach((item, index) => {
    if (!mongoose.Types.ObjectId.isValid(item.productId)) {
      throw new Error(`Item ${index + 1}: ID de producto invÃ¡lido`);
    }

    if (!mongoose.Types.ObjectId.isValid(item.variantId)) {
      throw new Error(`Item ${index + 1}: ID de variante invÃ¡lido`);
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(
        `Item ${index + 1}: Cantidad invÃ¡lida (${item.quantity})`,
      );
    }
  });

  const productIds = items.map(
    (item) => new mongoose.Types.ObjectId(item.productId),
  );

  const products = await itemModel
    .find(
      { _id: { $in: productIds } },
      { nameProduct: 1, value: 1, banner: 1, category: 1, subcategory: 1, promotion: 1 },
      { session, lock: true },
    )
    .session(session);

  const now = new Date();
  const activePromos = await bannerPromotionModel
    .find({
      tipo: "promo",
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
    .session(session)
    .lean();

  const promoIndex = buildPromoIndex(activePromos);

  const resolvedItems = items.map((item, index) => {
    const product = products.find((p) => p._id.equals(item.productId));

    if (!product) {
      throw new Error(`Producto ${item.productId} no encontrado`);
    }

    const variant = product.value.find((v) => v._id.equals(item.variantId));

    if (!variant) {
      throw new Error(
        `Variante ${item.variantId} no encontrada en el producto ${product.nameProduct}`,
      );
    }

    if (variant.stock < item.quantity) {
      throw new Error(
        `Stock insuficiente para ${product.nameProduct} (${variant.size}) ` +
          `(Solicitado: ${item.quantity}, Disponible: ${variant.stock})`,
      );
    }

    const {
      unitPrice,
      pricingSource,
      promoPercentageApplied,
      promoId,
    } = resolveUnitPrice(product, variant, { promoIndex, now });

    const clientPrice =
      typeof item.price === "number" ? Number(item.price) : null;
    if (
      clientPrice !== null &&
      Number(new Decimal(clientPrice).toDecimalPlaces(2)) !==
        Number(new Decimal(unitPrice).toDecimalPlaces(2))
    ) {
      console.warn("[pricing] Precio cliente difiere del servidor", {
        index,
        productId: item.productId,
        variantId: item.variantId,
        clientPrice,
        serverPrice: unitPrice,
        pricingSource,
      });
    }

    return {
      productId: product._id,
      variantId: variant._id,
      name: product.nameProduct,
      variantName: variant.size,
      unitPrice,
      pricingSource,
      promoPercentageApplied,
      promoId,
      originalPrice: variant.originalPrice,
      quantity: item.quantity,
      image: product.banner || null,
      stock: variant.stock,
      clientPrice,
    };
  });

  const tempSubtotal = resolvedItems.reduce((total, item) => {
    const itemTotal = new Decimal(item.unitPrice).times(item.quantity);
    return new Decimal(total).plus(itemTotal).toNumber();
  }, 0);

  const discountResult = await processDiscount(
    discountCode,
    tempSubtotal,
    session,
  );

  if (discountCode && !discountResult.valid) {
    throw new Error(discountResult.message);
  }

  const itemsWithPrices = resolvedItems.map((item) => {
    let finalPrice = new Decimal(item.unitPrice);

    if (discountResult.valid && discountResult.type === "percentage") {
      finalPrice = finalPrice.times(
        new Decimal(1).minus(new Decimal(discountResult.percentage).div(100)),
      );
    }

    const price = Number(finalPrice.toDecimalPlaces(2).toNumber());

    return {
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantName: item.variantName,
      price,
      unitPriceCharged: price,
      originalPrice: item.originalPrice,
      quantity: item.quantity,
      image: item.image,
      stock: item.stock,
      pricingSource: item.pricingSource,
      promoPercentageApplied: item.promoPercentageApplied,
      promoId: item.promoId,
      clientPrice: item.clientPrice,
      itemDiscount:
        discountResult.valid && discountResult.type === "percentage"
          ? discountResult.percentage
          : 0,
    };
  });

  let discountAmount = 0;

  if (discountResult.valid) {
    if (discountResult.type === "fixed") {
      discountAmount = Math.min(discountResult.amount, tempSubtotal);
    } else if (discountResult.type === "percentage") {
      discountAmount = tempSubtotal * (discountResult.percentage / 100);
    }
  }

  const discountedSubtotal = itemsWithPrices.reduce((sum, item) => {
    return new Decimal(sum)
      .plus(new Decimal(item.price).times(item.quantity))
      .toNumber();
  }, 0);

  return {
    itemsWithPrices,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    discountPercentage:
      discountResult.valid && discountResult.type === "percentage"
        ? discountResult.percentage
        : 0,
    discountMessage: discountResult.message,
    originalSubtotal: parseFloat(tempSubtotal.toFixed(2)),
    discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
    discountType: discountResult.type,
  };
};

module.exports = {
  validateAndPriceItems,
};
