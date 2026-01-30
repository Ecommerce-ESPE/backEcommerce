const { itemModel, bannerPromotionModel } = require("../../models/index");

const mongoose = require("mongoose");

const { moment } = require("../../config/components/timeConfig");

const buildPriceHistoryEntry = (price, changedBy) => ({
  price,

  date: new Date(),

  ...(changedBy ? { changedBy } : {}),
});

const getEffectivePrice = (variant) => {
  if (!variant) return undefined;

  if (typeof variant.discountPrice === "number") return variant.discountPrice;

  if (typeof variant.originalPrice === "number") return variant.originalPrice;

  return undefined;
};

const mergeVariantWithHistory = (
  existingVariant,
  incomingVariant,
  changedBy,
) => {
  const sanitizedIncoming = { ...(incomingVariant || {}) };

  delete sanitizedIncoming.priceHistory; // never trust client-provided history

  const base = existingVariant?.toObject
    ? existingVariant.toObject()
    : existingVariant;

  const merged = { ...(base || {}), ...sanitizedIncoming };

  merged.priceHistory = Array.isArray(existingVariant?.priceHistory)
    ? existingVariant.priceHistory
    : Array.isArray(merged.priceHistory)
      ? merged.priceHistory
      : [];

  const oldEffective = getEffectivePrice(existingVariant);

  const newEffective = getEffectivePrice(merged);

  if (
    typeof newEffective === "number" &&
    (typeof oldEffective !== "number" || newEffective !== oldEffective)
  ) {
    merged.priceHistory = [
      ...merged.priceHistory,

      buildPriceHistoryEntry(newEffective, changedBy),
    ];
  }

  return merged;
};

const applyInitialPriceHistory = (value = [], changedBy) =>
  value.map((variant) => {
    const merged = mergeVariantWithHistory(null, variant, changedBy);

    if (!Array.isArray(merged.priceHistory)) merged.priceHistory = [];

    return merged;
  });

const applyPromotionPriceHistory = (item, promotion, changedBy) => {
  if (!item || !Array.isArray(item.value)) return;

  const now = new Date();

  item.value.forEach((variant) => {
    const oldEffective = getEffectivePrice(variant);

    let newDiscount = null;

    if (promotion?.active) {
      const start = new Date(promotion.startDate);

      const end = new Date(promotion.endDate);

      if (
        now >= start &&
        now <= end &&
        typeof variant.originalPrice === "number"
      ) {
        const discount = variant.originalPrice * (promotion.percentage / 100);

        newDiscount = Number((variant.originalPrice - discount).toFixed(2));
      }
    }

    const newEffective =
      typeof newDiscount === "number" ? newDiscount : variant.originalPrice;

    if (
      typeof newEffective === "number" &&
      (typeof oldEffective !== "number" || newEffective !== oldEffective)
    ) {
      variant.priceHistory = Array.isArray(variant.priceHistory)
        ? variant.priceHistory
        : [];

      variant.priceHistory.push(
        buildPriceHistoryEntry(newEffective, changedBy),
      );
    }
  });
};

const applyPromotionToItem = (item, percentage) => {
  if (!item || !Array.isArray(item.value) || typeof percentage !== "number") {
    return item;
  }

  const safePercentage = Math.max(0, Math.min(100, percentage));

  const pricedVariants = item.value.map((variant) => {
    if (typeof variant.originalPrice !== "number") return variant;
    const discount = variant.originalPrice * (safePercentage / 100);
    const discountPrice = Number(
      (variant.originalPrice - discount).toFixed(2),
    );
    return { ...variant, discountPrice };
  });

  const originals = pricedVariants
    .map((variant) => variant.originalPrice)
    .filter((value) => typeof value === "number");
  const promos = pricedVariants
    .map((variant) => variant.discountPrice)
    .filter((value) => typeof value === "number");

  const originalMin = originals.length > 0 ? Math.min(...originals) : null;
  const promoMin = promos.length > 0 ? Math.min(...promos) : null;

  return {
    ...item,
    value: pricedVariants,
    pricing: {
      original: originalMin,
      promo: promoMin,
      percentage: safePercentage,
    },
  };
};

// @GET ALL ITEMS

const getItemsAll = async (req, res) => {
  try {
    const data = await itemModel.find().populate("createdBy", "name email");

    const now = new Date();
    const activeCategoryPromos = await bannerPromotionModel
      .find({
        tipo: "promo",
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        categories: { $exists: true, $ne: [] },
      })
      .lean();

    const categoryPromoMap = new Map();
    activeCategoryPromos.forEach((promo) => {
      if (!Array.isArray(promo.categories)) return;
      promo.categories.forEach((categoryId) => {
        if (!categoryPromoMap.has(String(categoryId))) {
          categoryPromoMap.set(String(categoryId), promo.promotionPercentage);
        }
      });
    });

    const itemsWithPromo = data.map((item) => {
      const itemObj = item.toObject();
      const categoryId = itemObj.category;
      let appliedPercentage = null;

      if (categoryId && categoryPromoMap.has(String(categoryId))) {
        const percentage = categoryPromoMap.get(String(categoryId));
        if (typeof percentage === "number") {
          appliedPercentage = percentage;
        }
      }

      if (appliedPercentage === null) {
        const productPromo = itemObj.promotion;
        if (
          productPromo?.active &&
          typeof productPromo.percentage === "number" &&
          productPromo.startDate &&
          productPromo.endDate
        ) {
          const start = new Date(productPromo.startDate);
          const end = new Date(productPromo.endDate);
          if (now >= start && now <= end) {
            appliedPercentage = productPromo.percentage;
          }
        }
      }

      return typeof appliedPercentage === "number"
        ? applyPromotionToItem(itemObj, appliedPercentage)
        : itemObj;
    });

    res.json({
      code: "200",

      ok: true,

      items: itemsWithPromo,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",

      ok: false,

      error: error.message,
    });
  }
};

// GET ITEM BY ID SKU SLUG

// Este método permite buscar un item por su ID, SKU o slug

const getItemsById = async (req, res) => {
  try {
    const { id } = req.params;

    // Función para escapar caracteres especiales en RegExp

    const escapeRegExp = (string) =>
      string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Verificar si el id tiene formato de ObjectId

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    let query;

    if (isObjectId) {
      query = { _id: id };
    } else {
      query = {
        $or: [
          { sku: id.toUpperCase() },

          { slug: new RegExp(`^${escapeRegExp(id)}$`, "i") },
        ],
      };
    }

    const item = await itemModel

      .findOne(query)

      .populate("category", "name subcategories");

    if (!item) {
      return res.status(404).json({
        code: "404",

        ok: false,

        message: "Item no encontrado",
      });
    }

    // Convertir a objeto plano

    const itemObj = item.toObject();

    // Buscar la subcategoría en category.subcategories

    const subcatId = item.subcategory?.toString();

    const subcategory = item.category.subcategories?.find(
      (sub) => sub._id.toString() === subcatId,
    );

    itemObj.subcategory = subcategory || null;

    // Promo por categoria (banner) tiene prioridad sobre promo propia del item
    const now = new Date();
    const categoryId = itemObj.category?._id || itemObj.category;
    let appliedPercentage = null;

    if (categoryId) {
      const categoryPromo = await bannerPromotionModel
        .findOne({
          tipo: "promo",
          active: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
          categories: categoryId,
        })
        .sort({ startDate: -1 })
        .lean();

      if (categoryPromo && typeof categoryPromo.promotionPercentage === "number") {
        appliedPercentage = categoryPromo.promotionPercentage;
      }
    }

    if (appliedPercentage === null) {
      const productPromo = itemObj.promotion;
      if (
        productPromo?.active &&
        typeof productPromo.percentage === "number" &&
        productPromo.startDate &&
        productPromo.endDate
      ) {
        const start = new Date(productPromo.startDate);
        const end = new Date(productPromo.endDate);
        if (now >= start && now <= end) {
          appliedPercentage = productPromo.percentage;
        }
      }
    }

    const finalItem =
      typeof appliedPercentage === "number"
        ? applyPromotionToItem(itemObj, appliedPercentage)
        : itemObj;

    res.json({
      code: "200",

      ok: true,

      item: finalItem,
    });
  } catch (error) {
    console.error("Error en getItemsById:", error);

    res.status(500).json({
      code: "500",

      ok: false,

      error: error.message,
    });
  }
};

/// FILTRO

const getFilteredItems = async (req, res) => {
  try {
    const {
      category,

      subcategory,

      sort = "createdAt_desc",

      page = 1,

      limit = 12,
    } = req.query;

    const query = { visibility: true };

    // 1. Validar si los valores son ObjectIds antes de agregarlos al query

    if (
      category &&
      category !== "ninguna" &&
      mongoose.Types.ObjectId.isValid(category)
    ) {
      query.category = category;
    }

    if (
      subcategory &&
      subcategory !== "ninguna" &&
      mongoose.Types.ObjectId.isValid(subcategory)
    ) {
      query.subcategory = subcategory;
    }

    // Ordenamiento

    const sortOptions = {
      price_asc: { "value.originalPrice": 1 },

      price_desc: { "value.originalPrice": -1 },

      //price_asc: { "value.price": 1 },

      //price_desc: { "value.price": -1 },

      discount_asc: { "value.discountPrice": 1 },

      discount_desc: { "value.discountPrice": -1 },

      rating: { rating: -1 },

      name_asc: { nameProduct: 1 },

      name_desc: { nameProduct: -1 },

      createdAt_desc: { createdAt: -1 },
    };

    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // Paginación

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 2. Filtrar documentos con categorías/subcategorías inválidas

    const [items, total] = await Promise.all([
      itemModel

        .find(query)

        .sort(sortQuery)

        .skip(skip)

        .limit(parseInt(limit))

        .populate("category", "name")

        .lean(),

      itemModel.countDocuments(query),
    ]);

    // 3. Limpieza manual de referencias rotas (opcional)

    const safeItems = items.map((item) => ({
      ...item,

      category: item.category?._id ? item.category : null,

      subcategory: item.subcategory?._id ? item.subcategory : null,
    }));

    res.json({
      code: "200",

      ok: true,

      total,

      page: parseInt(page),

      totalPages: Math.ceil(total / limit),

      items: safeItems,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      code: "500",

      ok: false,

      error: "Error al obtener productos",
    });
  }
};

// Filtro Admin

const getFilteredItemsAdmin = async (req, res) => {
  try {
    const {
      category,

      subcategory,

      sort = "createdAt_desc",

      page = 1,

      limit = 12,

      showHidden = "true", // por defecto mostrar ocultos
    } = req.query;

    // Mostrar todos los productos (visibles y ocultos) por defecto

    const query = {};

    if (showHidden !== "true") {
      query.visibility = true;
    }

    // 1. Validar si los valores son ObjectIds antes de agregarlos al query

    if (
      category &&
      category !== "ninguna" &&
      mongoose.Types.ObjectId.isValid(category)
    ) {
      query.category = category;
    }

    if (
      subcategory &&
      subcategory !== "ninguna" &&
      mongoose.Types.ObjectId.isValid(subcategory)
    ) {
      query.subcategory = subcategory;
    }

    // Ordenamiento

    const sortOptions = {
      price_asc: { "value.originalPrice": 1 },

      price_desc: { "value.originalPrice": -1 },

      discount_asc: { "value.discountPrice": 1 },

      discount_desc: { "value.discountPrice": -1 },

      rating: { rating: -1 },

      name_asc: { nameProduct: 1 },

      name_desc: { nameProduct: -1 },

      createdAt_desc: { createdAt: -1 },
    };

    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // Paginación

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 2. Filtrar documentos con categorías/subcategorías inválidas

    const [items, total] = await Promise.all([
      itemModel

        .find(query)

        .sort(sortQuery)

        .skip(skip)

        .limit(parseInt(limit))

        .populate("category", "name")

        .lean(),

      itemModel.countDocuments(query),
    ]);

    // 3. Limpieza manual de referencias rotas (opcional)

    const safeItems = items.map((item) => ({
      ...item,

      category: item.category?._id ? item.category : null,

      subcategory: item.subcategory?._id ? item.subcategory : null,
    }));

    res.json({
      code: "200",

      ok: true,

      total,

      page: parseInt(page),

      totalPages: Math.ceil(total / limit),

      items: safeItems,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      code: "500",

      ok: false,

      error: "Error al obtener productos",
    });
  }
};

// CREAR ITEM

const createItem = async (req, res) => {
  try {
    const uid = req.uid; // uid obtenido del token

    const {
      nameProduct,

      description,

      category,

      subcategory,

      value,

      images,

      promotion,

      stock,

      //tags,

      visibility = true,
    } = req.body;

    // Ajustar fechas de promoción si existen

    let promotionObj = promotion;

    if (promotionObj) {
      if (promotionObj.startDate) {
        promotionObj.startDate = moment(promotionObj.startDate)
          .startOf("day")

          .toDate();
      }

      if (promotionObj.endDate) {
        promotionObj.endDate = moment(promotionObj.endDate)
          .endOf("day")

          .toDate();
      }
    }

    // Crear item con valores controlados

    const item = new itemModel({
      nameProduct,

      description: description || "",

      category,

      subcategory: subcategory || null,

      value: applyInitialPriceHistory(value || [], uid),

      images: images || [],

      promotion: promotionObj || {},

      stock: stock || 0,

      //tags: tags || [],

      visibility,

      createdBy: uid,
    });

    const data = await item.save();

    res.locals.auditEntity = "items";

    res.locals.auditEntityId = data._id;

    res.locals.auditDescription = `Producto creado: ${data.nameProduct}`;

    res.json({
      code: "200",

      ok: true,

      item: data,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",

      ok: false,

      error: error.message,
    });
  }
};

// ACTUALIZAR PRODUCTO COMPLETO

const updateItem = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = req.body;

    const uid = req.uid;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",

        ok: false,

        message: "ID de producto inválido",
      });
    }

    // Ajustar fechas si existen

    if (updateData.promotion) {
      if (updateData.promotion.startDate) {
        updateData.promotion.startDate = moment(updateData.promotion.startDate)
          .startOf("day")

          .toDate();
      }

      if (updateData.promotion.endDate) {
        updateData.promotion.endDate = moment(updateData.promotion.endDate)
          .endOf("day")

          .toDate();
      }
    }

    const item = await itemModel.findById(id);

    if (!item) {
      return res.status(404).json({
        code: "404",

        ok: false,

        message: "Producto no encontrado",
      });
    }

    if (Array.isArray(updateData.value)) {
      const mergedVariants = updateData.value.map((incomingVariant) => {
        const variantId = incomingVariant?._id;

        const existingVariant = variantId ? item.value.id(variantId) : null;

        return mergeVariantWithHistory(existingVariant, incomingVariant, uid);
      });

      item.value = mergedVariants;

      delete updateData.value;
    }

    // Mezclar los cambios restantes

    Object.assign(item, updateData);

    if (updateData.promotion) {
      applyPromotionPriceHistory(item, updateData.promotion, uid);
    }

    const updatedItem = await item.save();

    res.locals.auditEntity = "items";

    res.locals.auditEntityId = updatedItem._id;

    res.locals.auditDescription = `Producto actualizado: ${updatedItem.nameProduct}`;

    res.json({
      code: "200",

      ok: true,

      message: "Producto actualizado exitosamente",

      item: updatedItem,
    });
  } catch (error) {
    console.error("Error actualizando producto:", error);

    res.status(500).json({
      code: "500",

      ok: false,

      message: "Error interno del servidor",

      error: error.message,
    });
  }
};

// ELIMINAR PRODUCTO

const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",

        ok: false,

        message: "ID de producto inválido",
      });
    }

    // Eliminar el producto definitivamente

    const deletedItem = await itemModel.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({
        code: "404",

        ok: false,

        message: "Producto no encontrado",
      });
    }

    res.locals.auditEntity = "items";

    res.locals.auditEntityId = deletedItem._id;

    res.locals.auditDescription = `Producto eliminado: ${deletedItem.nameProduct}`;

    res.json({
      code: "200",

      ok: true,

      message: "Producto eliminado",

      item: deletedItem,
    });
  } catch (error) {
    console.error("Error eliminando producto:", error);

    res.status(500).json({
      code: "500",

      ok: false,

      message: "Error interno del servidor",

      error: error.message,
    });
  }
};

// ACTUALIZAR PROMOCIÓN DE UN ITEM

const updateItemPromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const { promotion } = req.body;

    const uid = req.uid;

    // Validaciones básicas

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",

        ok: false,

        message: "ID de producto inválido",
      });
    }

    if (!promotion || typeof promotion.active !== "boolean") {
      return res.status(400).json({
        code: "400",

        ok: false,

        message: "Datos de promoción inválidos",
      });
    }

    // Si la promoción está activa, validar campos requeridos

    if (promotion.active) {
      if (
        typeof promotion.percentage !== "number" ||
        promotion.percentage <= 0 ||
        promotion.percentage > 100
      ) {
        return res.status(400).json({
          code: "400",

          ok: false,

          message: "Porcentaje de descuento inválido (debe ser entre 1 y 100)",
        });
      }

      if (!promotion.startDate || !promotion.endDate) {
        return res.status(400).json({
          code: "400",

          ok: false,

          message: "Fechas de inicio y fin son requeridas",
        });
      }

      // Convertir fechas a objetos Date

      promotion.startDate = new Date(promotion.startDate);

      promotion.endDate = new Date(promotion.endDate);

      if (
        isNaN(promotion.startDate.getTime()) ||
        isNaN(promotion.endDate.getTime())
      ) {
        return res.status(400).json({
          code: "400",

          ok: false,

          message: "Formato de fecha inválido",
        });
      }

      // Ajustar fechas: startDate al inicio del día y endDate al final del día

      promotion.startDate.setUTCHours(0, 0, 0, 0);

      promotion.endDate.setUTCHours(23, 59, 59, 999);

      if (promotion.endDate <= promotion.startDate) {
        return res.status(400).json({
          code: "400",

          ok: false,

          message: "La fecha de fin debe ser posterior a la fecha de inicio",
        });
      }
    }

    // Buscar el producto y actualizar usando save() para activar middleware

    const item = await itemModel.findById(id);

    if (!item) {
      return res.status(404).json({
        code: "404",

        ok: false,

        message: "Producto no encontrado",
      });
    }

    // Actualizar la promoción

    applyPromotionPriceHistory(item, promotion, uid);

    item.promotion = promotion;

    const updatedItem = await item.save(); // Esto activará el middleware pre('save')

    res.locals.auditEntity = "items";

    res.locals.auditEntityId = updatedItem._id;

    res.locals.auditDescription = `Promoción actualizada: ${updatedItem.nameProduct}`;

    // Preparar respuesta

    res.json({
      code: "200",

      ok: true,

      message: "Promoción actualizada exitosamente",

      item: {
        _id: updatedItem._id,

        nameProduct: updatedItem.nameProduct,

        promotion: updatedItem.promotion,

        value: updatedItem.value.map((variant) => ({
          size: variant.size,

          originalPrice: variant.originalPrice,

          discountPrice: variant.discountPrice,
        })),
      },
    });
  } catch (error) {
    console.error("Error actualizando promoción:", error);

    res.status(500).json({
      code: "500",

      ok: false,

      message: "Error interno del servidor",

      error: error.message,
    });
  }
};

// Productos Recientemente agreagados

const getItemRecentlyAdded = async (req, res) => {
  try {
    const items = await itemModel

      .find({ visibility: true })

      .sort({ createdAt: -1 })

      .limit(10);

    res.json({
      code: "200",

      ok: true,

      items,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",

      ok: false,

      error: error.message,
    });
  }
};

//Productos Destacados

const getFeaturedItems = async (req, res) => {
  try {
    const now = new Date();

    const items = await itemModel

      .find({ visibility: true, "promotion.active": true })

      .sort({ "promotion.startDate": -1 })

      .limit(10);

    const activeCategoryPromos = await bannerPromotionModel
      .find({
        tipo: "promo",
        active: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        categories: { $exists: true, $ne: [] },
      })
      .lean();

    const categoryPromoMap = new Map();
    activeCategoryPromos.forEach((promo) => {
      if (!Array.isArray(promo.categories)) return;
      promo.categories.forEach((categoryId) => {
        if (!categoryPromoMap.has(String(categoryId))) {
          categoryPromoMap.set(String(categoryId), promo.promotionPercentage);
        }
      });
    });

    const itemsWithPromo = items.map((item) => {
      const itemObj = item.toObject();
      const categoryId = itemObj.category;
      let appliedPercentage = null;

      if (categoryId && categoryPromoMap.has(String(categoryId))) {
        const percentage = categoryPromoMap.get(String(categoryId));
        if (typeof percentage === "number") {
          appliedPercentage = percentage;
        }
      }

      if (appliedPercentage === null) {
        const productPromo = itemObj.promotion;
        if (
          productPromo?.active &&
          typeof productPromo.percentage === "number" &&
          productPromo.startDate &&
          productPromo.endDate
        ) {
          const start = new Date(productPromo.startDate);
          const end = new Date(productPromo.endDate);
          if (now >= start && now <= end) {
            appliedPercentage = productPromo.percentage;
          }
        }
      }

      return typeof appliedPercentage === "number"
        ? applyPromotionToItem(itemObj, appliedPercentage)
        : itemObj;
    });

    res.json({
      code: "200",

      ok: true,

      items: itemsWithPromo,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",

      ok: false,

      error: error.message,
    });
  }
};

module.exports = {
  createItem,

  getItemsAll,

  getItemsById,

  getFilteredItems,

  updateItem,

  deleteItem,

  updateItemPromotion,

  getItemRecentlyAdded,

  getFilteredItemsAdmin,

  getFeaturedItems,
};
