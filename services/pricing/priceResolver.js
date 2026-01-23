const Decimal = require("decimal.js");

const isPromoActive = (promo, now = new Date()) => {
  if (!promo || promo.tipo !== "promo") return false;
  if (!promo.active) return false;
  if (!promo.startDate || !promo.endDate) return false;
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  return now >= start && now <= end;
};

const calcPercentagePrice = (originalPrice, percentage) => {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  return new Decimal(originalPrice)
    .times(new Decimal(1).minus(new Decimal(pct).div(100)))
    .toDecimalPlaces(2)
    .toNumber();
};

const pickBestPromo = (promos = []) => {
  if (!Array.isArray(promos) || promos.length === 0) return null;
  return promos.reduce((best, current) => {
    if (!best) return current;
    const bestPct = Number(best.promotionPercentage) || 0;
    const currentPct = Number(current.promotionPercentage) || 0;
    if (currentPct > bestPct) return current;
    return best;
  }, null);
};

const buildPromoIndex = (promos = []) => {
  const index = {
    byProduct: new Map(),
    bySubcategory: new Map(),
    byCategory: new Map(),
    applyAll: [],
  };

  promos.forEach((promo) => {
    const products = Array.isArray(promo.products) ? promo.products : [];
    const subcategories = Array.isArray(promo.subcategories)
      ? promo.subcategories
      : [];
    const categories = Array.isArray(promo.categories) ? promo.categories : [];

    products.forEach((id) => {
      const key = String(id);
      const list = index.byProduct.get(key) || [];
      list.push(promo);
      index.byProduct.set(key, list);
    });

    subcategories.forEach((id) => {
      const key = String(id);
      const list = index.bySubcategory.get(key) || [];
      list.push(promo);
      index.bySubcategory.set(key, list);
    });

    categories.forEach((id) => {
      const key = String(id);
      const list = index.byCategory.get(key) || [];
      list.push(promo);
      index.byCategory.set(key, list);
    });

    if (promo.applyAll === true) {
      index.applyAll.push(promo);
    }
  });

  return index;
};

const resolveGlobalPromo = (product, promoIndex) => {
  if (!promoIndex || !product) return null;

  const productId = String(product._id);
  const subcategoryId = product.subcategory ? String(product.subcategory) : null;
  const categoryId = product.category ? String(product.category) : null;

  if (promoIndex.byProduct.has(productId)) {
    return pickBestPromo(promoIndex.byProduct.get(productId));
  }

  if (subcategoryId && promoIndex.bySubcategory.has(subcategoryId)) {
    return pickBestPromo(promoIndex.bySubcategory.get(subcategoryId));
  }

  if (categoryId && promoIndex.byCategory.has(categoryId)) {
    return pickBestPromo(promoIndex.byCategory.get(categoryId));
  }

  if (promoIndex.applyAll.length > 0) {
    return pickBestPromo(promoIndex.applyAll);
  }

  return null;
};

const resolveUnitPrice = (product, variant, options = {}) => {
  if (!product || !variant) {
    throw new Error("Producto o variante no encontrados");
  }

  const originalPrice = variant.originalPrice;
  if (typeof originalPrice !== "number") {
    throw new Error("Precio original invÃ¡lido");
  }

  const now = options.now || new Date();
  const promoIndex = options.promoIndex;

  const globalPromo = resolveGlobalPromo(product, promoIndex);
  if (globalPromo && isPromoActive(globalPromo, now)) {
    const percentage = Number(globalPromo.promotionPercentage) || 0;
    return {
      unitPrice: calcPercentagePrice(originalPrice, percentage),
      pricingSource: "globalPromo",
      promoPercentageApplied: percentage,
      promoId: globalPromo._id || null,
    };
  }

  const productPromo = product.promotion || {};
  if (
    productPromo.active === true &&
    typeof productPromo.percentage === "number" &&
    productPromo.startDate &&
    productPromo.endDate
  ) {
    const start = new Date(productPromo.startDate);
    const end = new Date(productPromo.endDate);
    if (now >= start && now <= end) {
      return {
        unitPrice: calcPercentagePrice(originalPrice, productPromo.percentage),
        pricingSource: "productPromo",
        promoPercentageApplied: productPromo.percentage,
        promoId: null,
      };
    }
  }

  if (typeof variant.discountPrice === "number") {
    const percentage = Number(
      new Decimal(originalPrice)
        .minus(new Decimal(variant.discountPrice))
        .div(new Decimal(originalPrice))
        .times(100)
        .toDecimalPlaces(2)
        .toNumber(),
    );
    return {
      unitPrice: Number(new Decimal(variant.discountPrice).toDecimalPlaces(2)),
      pricingSource: "storedDiscount",
      promoPercentageApplied: percentage,
      promoId: null,
    };
  }

  return {
    unitPrice: Number(new Decimal(originalPrice).toDecimalPlaces(2)),
    pricingSource: "none",
    promoPercentageApplied: 0,
    promoId: null,
  };
};

module.exports = {
  isPromoActive,
  calcPercentagePrice,
  buildPromoIndex,
  resolveUnitPrice,
};
