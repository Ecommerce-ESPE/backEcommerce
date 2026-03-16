const mongoose = require("mongoose");
const { bannerPromotionModel, itemModel, categoryModel } = require("../../models/index");

const getIdAsString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;

  if (
    value instanceof mongoose.Types.ObjectId ||
    (typeof value === "object" && value?._bsontype === "ObjectId")
  ) {
    return String(value);
  }

  if (typeof value === "object" && value._id && value._id !== value) {
    return getIdAsString(value._id);
  }

  if (typeof value.toString === "function") {
    const converted = value.toString();
    if (converted && converted !== "[object Object]") return converted;
  }
  return null;
};

const enrichBannersWithProductNames = async (banners = []) => {
  const bannersAsObjects = banners.map((banner) =>
    typeof banner?.toObject === "function" ? banner.toObject() : banner,
  );

  try {
    const productIds = [
      ...new Set(
        bannersAsObjects
          .flatMap((banner) => (Array.isArray(banner?.products) ? banner.products : []))
          .map((productId) => getIdAsString(productId))
          .filter(Boolean),
      ),
    ];

    const productNameById = new Map();
    const validProductIds = productIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    if (validProductIds.length > 0) {
      const products = await itemModel
        .find({ _id: { $in: validProductIds } })
        .select("_id nameProduct")
        .lean();

      for (const product of products) {
        productNameById.set(String(product._id), product.nameProduct || null);
      }
    }

    const categoryIds = [
      ...new Set(
        bannersAsObjects
          .flatMap((banner) => (Array.isArray(banner?.categories) ? banner.categories : []))
          .map((categoryId) => getIdAsString(categoryId))
          .filter(Boolean),
      ),
    ];
    const validCategoryIds = categoryIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    const categoryNameById = new Map();
    if (validCategoryIds.length > 0) {
      const categories = await categoryModel
        .find({ _id: { $in: validCategoryIds } })
        .select("_id name")
        .lean();

      for (const category of categories) {
        categoryNameById.set(String(category._id), category.name || null);
      }
    }

    const subcategoryIds = [
      ...new Set(
        bannersAsObjects
          .flatMap((banner) =>
            Array.isArray(banner?.subcategories) ? banner.subcategories : [],
          )
          .map((subcategoryId) => getIdAsString(subcategoryId))
          .filter(Boolean),
      ),
    ];
    const validSubcategoryIds = subcategoryIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    const subcategoryNameById = new Map();
    if (validSubcategoryIds.length > 0) {
      const categoriesWithSubcategories = await categoryModel
        .find({ "subcategories._id": { $in: validSubcategoryIds } })
        .select("subcategories._id subcategories.name")
        .lean();

      for (const category of categoriesWithSubcategories) {
        const subcategories = Array.isArray(category?.subcategories)
          ? category.subcategories
          : [];
        for (const subcategory of subcategories) {
          const subcategoryId = getIdAsString(subcategory?._id);
          if (!subcategoryId || !validSubcategoryIds.includes(subcategoryId)) continue;
          subcategoryNameById.set(subcategoryId, subcategory?.name || null);
        }
      }
    }

    return bannersAsObjects.map((banner) => {
      const productDetails = (Array.isArray(banner.products) ? banner.products : [])
        .map((productId) => {
          const id = getIdAsString(productId);
          if (!id) return null;
          return {
            _id: id,
            nameProduct: productNameById.get(id) || null,
          };
        })
        .filter(Boolean);

      const categoryDetails = (Array.isArray(banner.categories) ? banner.categories : [])
        .map((categoryId) => {
          const id = getIdAsString(categoryId);
          if (!id) return null;
          return {
            _id: id,
            name: categoryNameById.get(id) || categoryId?.name || null,
          };
        })
        .filter(Boolean);

      const subcategoryDetails = (Array.isArray(banner.subcategories) ? banner.subcategories : [])
        .map((subcategoryId) => {
          const id = getIdAsString(subcategoryId);
          if (!id) return null;
          return {
            _id: id,
            name: subcategoryNameById.get(id) || null,
          };
        })
        .filter(Boolean);

      return {
        ...banner,
        products: productDetails,
        categories: categoryDetails,
        subcategories: subcategoryDetails,
      };
    });
  } catch (error) {
    console.error("No se pudo enriquecer banners con nombres de productos:", error.message);

    return bannersAsObjects.map((banner) => ({
      ...banner,
      products: [],
      categories: [],
      subcategories: [],
    }));
  }
};

const normalizePromoDates = (payload = {}) => {
  const start = payload.startDate ? new Date(payload.startDate) : null;
  const end = payload.endDate ? new Date(payload.endDate) : null;

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error("Las promociones requieren startDate y endDate validos.");
    error.status = 400;
    throw error;
  }

  if (start > end) {
    const error = new Error("startDate no puede ser mayor que endDate.");
    error.status = 400;
    throw error;
  }

  return { start, end };
};

const assertNoOverlappingPromo = async (payload = {}, excludedId = null) => {
  const tipo = payload.tipo || "banner";
  if (tipo !== "promo") return;

  const { start, end } = normalizePromoDates(payload);
  const filter = {
    tipo: "promo",
    startDate: { $lte: end },
    endDate: { $gte: start },
  };

  if (excludedId) {
    filter._id = { $ne: excludedId };
  }

  const conflictingPromo = await bannerPromotionModel.findOne(filter).select("_id title");
  if (conflictingPromo) {
    const error = new Error(
      `Ya existe una oferta en ese rango (${conflictingPromo.title || conflictingPromo._id}).`,
    );
    error.status = 409;
    throw error;
  }
};

const rangesOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB);
};

// Función para actualizar estados antes de mostrar
function actualizarEstadoBanner(banner) {
  const now = new Date();
  if (now < banner.startDate) {
    banner.estado = "proximo";
    banner.active = false;
  } else if (now >= banner.startDate && now <= banner.endDate) {
    banner.estado = "enCurso";
    banner.active = true;
  } else if (now > banner.endDate) {
    banner.estado = "finalizado";
    banner.active = false;
  }
}

// GET - Todos los banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await bannerPromotionModel.find();
    
    // Refrescar el estado de cada banner antes de enviar
    const bannersActualizados = await Promise.all(
      banners.map(async (banner) => {
        actualizarEstadoBanner(banner);
        await banner.save(); // Guardamos cambios si el estado cambió
        return banner;
      })
    );

    const bannersConNombres = await enrichBannersWithProductNames(bannersActualizados);

    res.status(200).json(bannersConNombres);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los banners" });
  }
};

// GET - Banner por ID
const getBannerPromoById = async (req, res) => {
  try {
    const banner = await bannerPromotionModel.findById(req.params.id)
      .populate("categories");

    if (!banner) return res.status(404).json({ error: "Banner no encontrado" });

    actualizarEstadoBanner(banner);
    await banner.save();

    const [bannerConNombres] = await enrichBannersWithProductNames([banner]);

    res.status(200).json(bannerConNombres);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el banner" });
  }
};

// POST - Crear nuevo banner
const createBanner = async (req, res) => {
  try {
    const {
      image,
      subtitle,
      title,
      buttonText,
      href,
      colSize,
      tipo = "banner",
      startDate,
      endDate,
      promotionPercentage,
      products = [],
      subcategories = [],
      categories = [],
      applyAll = false,
    } = req.body;

    await assertNoOverlappingPromo({ tipo, startDate, endDate });

    const banner = new bannerPromotionModel({
      image,
      subtitle,
      title,
      buttonText,
      href,
      colSize,
      tipo,
      startDate,
      endDate,
      promotionPercentage,
      products,
      subcategories,
      categories,
      applyAll,
    });

    await banner.save();
    await clearOverriddenItemPromotionsForBanner(banner);

    res.status(201).json({
      ok: true,
      message: "Banner creado correctamente",
      banner: banner,
    });
  } catch (error) {
    res
      .status(error.status || 400)
      .json({ error: "Error al crear el banner", detail: error.message });
  }
};

// PUT - Actualizar banner
const updateBanner = async (req, res) => {
  try {
    const existingBanner = await bannerPromotionModel.findById(req.params.id);

    if (!existingBanner) {
      return res.status(404).json({ error: "Banner no encontrado" });
    }

    await assertNoOverlappingPromo(
      {
        tipo: req.body.tipo ?? existingBanner.tipo,
        startDate: req.body.startDate ?? existingBanner.startDate,
        endDate: req.body.endDate ?? existingBanner.endDate,
      },
      existingBanner._id,
    );

    const updatedBanner = await bannerPromotionModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedBanner) {
      return res.status(404).json({ error: "Banner no encontrado" });
    }

    actualizarEstadoBanner(updatedBanner);
    await updatedBanner.save();

    await syncPromotionToProducts(existingBanner, updatedBanner);

    res.status(200).json(updatedBanner);
  } catch (error) {
    res
      .status(error.status || 400)
      .json({ error: "Error al actualizar el banner", detail: error.message });
  }
};

// DELETE - Eliminar banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await bannerPromotionModel.findById(req.params.id);

    if (!banner) return res.status(404).json({ error: "Banner no encontrado" });

    await bannerPromotionModel.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Banner eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el banner" });
  }
};

module.exports = {
  getAllBanners,
  getBannerPromoById,
  createBanner,
  updateBanner,
  deleteBanner,
};

const buildProductFilterFromBanner = (banner) => {
  if (!banner) return null;

  const products = Array.isArray(banner.products) ? banner.products : [];
  const subcategories = Array.isArray(banner.subcategories)
    ? banner.subcategories
    : [];
  const categories = Array.isArray(banner.categories) ? banner.categories : [];

  if (products.length > 0) {
    return { _id: { $in: products } };
  }
  if (subcategories.length > 0) {
    return { subcategory: { $in: subcategories } };
  }
  if (categories.length > 0) {
    return { category: { $in: categories } };
  }
  if (banner.applyAll === true) {
    return {};
  }

  return null;
};

const getPromotionPayloadFromBanner = (banner) => {
  if (!banner || banner.tipo !== "promo") {
    return { active: false, percentage: 0, startDate: null, endDate: null };
  }

  const now = new Date();
  const start = banner.startDate ? new Date(banner.startDate) : null;
  const end = banner.endDate ? new Date(banner.endDate) : null;

  const active =
    !!start && !!end && now >= start && now <= end && banner.active === true;

  return {
    active,
    percentage: typeof banner.promotionPercentage === "number"
      ? banner.promotionPercentage
      : 0,
    startDate: start,
    endDate: end,
  };
};

const clearPromotionFromProducts = async (banner) => {
  const filter = buildProductFilterFromBanner(banner);
  if (!filter) return;

  await itemModel.updateMany(filter, {
    $set: {
      promotion: {
        active: false,
        percentage: 0,
        startDate: null,
        endDate: null,
      },
    },
  });
};

const clearOverriddenItemPromotionsForBanner = async (banner) => {
  if (!banner || banner.tipo !== "promo") return;

  const filter = buildProductFilterFromBanner(banner);
  if (filter === null) return;

  const items = await itemModel.find(filter);
  for (const item of items) {
    const itemPromotion = item.promotion || {};
    if (!itemPromotion.active) continue;

    if (
      !rangesOverlap(
        itemPromotion.startDate,
        itemPromotion.endDate,
        banner.startDate,
        banner.endDate,
      )
    ) {
      continue;
    }

    item.promotion = {
      active: false,
      percentage: 0,
      startDate: null,
      endDate: null,
    };

    await item.save();
  }
};

const syncPromotionToProducts = async (oldBanner, newBanner) => {
  await clearOverriddenItemPromotionsForBanner(newBanner);
};
