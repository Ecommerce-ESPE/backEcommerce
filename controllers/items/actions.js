const {
  itemModel,
  bannerPromotionModel,
  brandModel,
  tagModel
} = require("../../models/index");

const mongoose = require("mongoose");

const { moment } = require("../../config/components/timeConfig");
const { slugifyText, ensureUniqueSlug } = require("../../utils/slug");

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
    const discountPrice = Number((variant.originalPrice - discount).toFixed(2));
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

const resolveBrandId = async (brandId, brandName) => {
  if (brandId) {
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      const error = new Error("ID de marca inválido");
      error.status = 400;
      throw error;
    }

    const brand = await brandModel.findById(brandId).lean();
    if (!brand) {
      const error = new Error("Marca no encontrada");
      error.status = 404;
      throw error;
    }
    return brand._id;
  }

  if (brandName) {
    const cleanName = String(brandName).trim();
    if (!cleanName) {
      const error = new Error("Nombre de marca inválido");
      error.status = 400;
      throw error;
    }

    const baseSlug =
      cleanName.toLowerCase() === "generic"
        ? "gen"
        : slugifyText(cleanName) || "gen";

    let brand = await brandModel.findOne({ slug: baseSlug }).lean();
    if (!brand) {
      const uniqueSlug = await ensureUniqueSlug(brandModel, baseSlug);
      brand = await brandModel.create({
        name: cleanName,
        slug: uniqueSlug,
        active: true
      });
    }
    return brand._id;
  }

  return null;
};

const resolveTags = async (tagsInput) => {
  if (!Array.isArray(tagsInput)) return undefined;

  const resolved = [];

  for (const entry of tagsInput) {
    if (!entry) continue;

    if (typeof entry === "string" && mongoose.Types.ObjectId.isValid(entry)) {
      resolved.push(entry);
      continue;
    }

    if (mongoose.isValidObjectId(entry)) {
      resolved.push(entry);
      continue;
    }

    const tagName = String(entry).trim();
    if (!tagName) continue;

    const baseSlug = slugifyText(tagName);
    if (!baseSlug) continue;

    let tag = await tagModel.findOne({ slug: baseSlug }).lean();
    if (!tag) {
      const uniqueSlug = await ensureUniqueSlug(tagModel, baseSlug);
      tag = await tagModel.create({
        name: tagName,
        slug: uniqueSlug,
        active: true
      });
    }

    resolved.push(tag._id);
  }

  return resolved;
};

const SPEC_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "list_text",
  "list_number",
]);

const parseBooleanValue = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

const toTrimmedListFromString = (value) =>
  String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeSpecValue = (type, rawValue, key) => {
  switch (type) {
    case "text":
      return String(rawValue ?? "").trim();
    case "number": {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed)) return parsed;
      }
      break;
    }
    case "boolean": {
      const parsed = parseBooleanValue(rawValue);
      if (typeof parsed === "boolean") return parsed;
      break;
    }
    case "list_text": {
      if (Array.isArray(rawValue)) {
        return rawValue
          .map((entry) => String(entry ?? "").trim())
          .filter(Boolean);
      }
      if (typeof rawValue === "string") return toTrimmedListFromString(rawValue);
      break;
    }
    case "list_number": {
      const rawList = Array.isArray(rawValue)
        ? rawValue
        : typeof rawValue === "string"
          ? toTrimmedListFromString(rawValue)
          : null;

      if (Array.isArray(rawList)) {
        const parsed = rawList.map((entry) => Number(entry));
        if (parsed.every((value) => Number.isFinite(value))) return parsed;
      }
      break;
    }
    default:
      break;
  }

  const error = new Error(`Valor inválido para spec "${key}" de tipo "${type}"`);
  error.status = 400;
  throw error;
};

const normalizeSpecs = (specsInput) => {
  if (specsInput === undefined) return undefined;

  if (!Array.isArray(specsInput)) {
    const error = new Error("El campo specs debe ser un array");
    error.status = 400;
    throw error;
  }

  return specsInput.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      const error = new Error(`Spec en posición ${index} inválida`);
      error.status = 400;
      throw error;
    }

    const key = String(entry.key || "").trim();
    const type = String(entry.type || "").trim();

    if (!key) {
      const error = new Error(`Spec en posición ${index} requiere key`);
      error.status = 400;
      throw error;
    }

    if (!SPEC_TYPES.has(type)) {
      const error = new Error(`Spec "${key}" tiene type inválido`);
      error.status = 400;
      throw error;
    }

    const normalized = {
      key,
      type,
      value: normalizeSpecValue(type, entry.value, key),
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
    };

    if (entry.unit !== undefined && entry.unit !== null) {
      normalized.unit = String(entry.unit).trim();
    }

    if (entry.group !== undefined && entry.group !== null) {
      normalized.group = String(entry.group).trim();
    }

    return normalized;
  });
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveTagsFilter = async (tagsQuery) => {
  if (!tagsQuery) return undefined;

  const rawTokens = Array.isArray(tagsQuery)
    ? tagsQuery
    : String(tagsQuery).split(",");

  const tokens = rawTokens
    .map((token) => String(token || "").trim())
    .filter(Boolean);

  if (tokens.length === 0) return undefined;

  const idTokens = tokens.filter((token) => mongoose.Types.ObjectId.isValid(token));
  const slugTokens = tokens
    .map((token) => slugifyText(token))
    .filter(Boolean);

  const tags = await tagModel
    .find({
      $or: [
        ...(idTokens.length > 0 ? [{ _id: { $in: idTokens } }] : []),
        ...(slugTokens.length > 0 ? [{ slug: { $in: slugTokens } }] : []),
      ],
    })
    .select("_id")
    .lean();

  const resolvedTagIds = tags.map((tag) => tag._id);

  return { $in: resolvedTagIds };
};

const buildSpecElemMatch = ({ specKey, specType, specValue, specGroup }) => {
  if (!specKey) return undefined;

  const key = String(specKey).trim();
  if (!key) return undefined;

  const elemMatch = { key };

  if (specGroup !== undefined) {
    const normalizedGroup = String(specGroup || "").trim();
    if (normalizedGroup) elemMatch.group = normalizedGroup;
  }

  if (specType !== undefined) {
    const normalizedType = String(specType || "").trim();
    if (!SPEC_TYPES.has(normalizedType)) {
      const error = new Error(`specType inválido: ${normalizedType}`);
      error.status = 400;
      throw error;
    }
    elemMatch.type = normalizedType;
  }

  if (specValue === undefined) return elemMatch;

  const type = elemMatch.type || "text";

  if (type === "number") {
    const parsed = Number(specValue);
    if (!Number.isFinite(parsed)) {
      const error = new Error(`specValue inválido para number: ${specValue}`);
      error.status = 400;
      throw error;
    }
    elemMatch.value = parsed;
    return elemMatch;
  }

  if (type === "boolean") {
    const parsed = parseBooleanValue(specValue);
    if (typeof parsed !== "boolean") {
      const error = new Error(`specValue inválido para boolean: ${specValue}`);
      error.status = 400;
      throw error;
    }
    elemMatch.value = parsed;
    return elemMatch;
  }

  if (type === "list_number") {
    const list = toTrimmedListFromString(specValue).map((entry) => Number(entry));
    if (list.length === 0 || list.some((entry) => !Number.isFinite(entry))) {
      const error = new Error(`specValue inválido para list_number: ${specValue}`);
      error.status = 400;
      throw error;
    }
    elemMatch.value = { $all: list };
    return elemMatch;
  }

  if (type === "list_text") {
    const list = toTrimmedListFromString(specValue);
    if (list.length === 0) {
      const error = new Error(`specValue inválido para list_text: ${specValue}`);
      error.status = 400;
      throw error;
    }
    elemMatch.value = { $all: list };
    return elemMatch;
  }

  elemMatch.value = new RegExp(`^${escapeRegExp(String(specValue).trim())}$`, "i");
  return elemMatch;
};

// @GET ALL ITEMS

const getItemsAll = async (req, res) => {
  try {
    const data = await itemModel
      .find()
      .populate("createdBy", "name email")
      .populate("tags", "name slug active usageCount");

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

      .populate("category", "name subcategories")
      .populate("brand", "name slug logoUrl website active")
      .populate("tags", "name slug active usageCount");

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

      if (
        categoryPromo &&
        typeof categoryPromo.promotionPercentage === "number"
      ) {
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
      tags,
      specKey,
      specType,
      specValue,
      specGroup,

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

    const tagFilter = await resolveTagsFilter(tags);
    if (tagFilter) {
      query.tags = tagFilter;
    }

    const specFilter = buildSpecElemMatch({
      specKey,
      specType,
      specValue,
      specGroup,
    });
    if (specFilter) {
      query.specs = { $elemMatch: specFilter };
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
      tags,
      specKey,
      specType,
      specValue,
      specGroup,

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

    const tagFilter = await resolveTagsFilter(tags);
    if (tagFilter) {
      query.tags = tagFilter;
    }

    const specFilter = buildSpecElemMatch({
      specKey,
      specType,
      specValue,
      specGroup,
    });
    if (specFilter) {
      query.specs = { $elemMatch: specFilter };
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
      content,

      category,

      subcategory,

      value,

      images,

      promotion,

      stock,

      tags,
      specs,

      visibility = true,
      brand,
      brandName,
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

    const resolvedBrandId = await resolveBrandId(brand, brandName);
    if (!resolvedBrandId) {
      return res.status(400).json({
        code: "400",

        ok: false,

        message: "Marca requerida para crear el producto",
      });
    }

    const resolvedTags = await resolveTags(tags);
    const normalizedSpecs = normalizeSpecs(specs);

    // Crear item con valores controlados

    const item = new itemModel({
      nameProduct,

      description: description || "",

      content: content || "",

      category,

      subcategory: subcategory || null,

      value: applyInitialPriceHistory(value || [], uid),

      images: images || [],

      promotion: promotionObj || {},

      stock: stock || 0,

      tags: resolvedTags || [],
      specs: normalizedSpecs || [],

      brand: resolvedBrandId,

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
    res.status(error.status || 500).json({
      code: error.status ? String(error.status) : "500",

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

    if (updateData.brand || updateData.brandName) {
      updateData.brand = await resolveBrandId(
        updateData.brand,
        updateData.brandName,
      );
      delete updateData.brandName;
    }

    if (updateData.tags) {
      updateData.tags = await resolveTags(updateData.tags);
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "specs")) {
      updateData.specs = normalizeSpecs(updateData.specs);
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

    res.status(error.status || 500).json({
      code: error.status ? String(error.status) : "500",

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
