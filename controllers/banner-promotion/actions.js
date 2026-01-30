const { bannerPromotionModel, itemModel } = require("../../models/index");

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

    res.status(200).json(bannersActualizados);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los banners" });
  }
};

// GET - Banner por ID
const getBannerById = async (req, res) => {
  try {
    const banner = await bannerPromotionModel.findById(req.params.id)
      .populate("products")
      .populate("categories");

    if (!banner) return res.status(404).json({ error: "Banner no encontrado" });

    actualizarEstadoBanner(banner);
    await banner.save();

    res.status(200).json(banner);
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
      startDate,
      endDate,
      promotionPercentage,
      products = [],
      subcategories = [],
      categories = [],
      applyAll = false,
    } = req.body;

    const banner = new bannerPromotionModel({
      image,
      subtitle,
      title,
      buttonText,
      href,
      colSize,
      startDate,
      endDate,
      promotionPercentage,
      products,
      subcategories,
      categories,
      applyAll,
    });

    await banner.save();

    res.status(201).json({
      ok: true,
      message: "Banner creado correctamente",
      banner: banner,
    });
  } catch (error) {
    res.status(400).json({ error: "Error al crear el banner", detail: error.message });
  }
};

// PUT - Actualizar banner
const updateBanner = async (req, res) => {
  try {
    const existingBanner = await bannerPromotionModel.findById(req.params.id);

    if (!existingBanner) {
      return res.status(404).json({ error: "Banner no encontrado" });
    }

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
    res.status(400).json({ error: "Error al actualizar el banner", detail: error.message });
  }
};

// DELETE - Eliminar banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await bannerPromotionModel.findById(req.params.id);

    if (!banner) return res.status(404).json({ error: "Banner no encontrado" });

    await bannerPromotionModel.findByIdAndDelete(req.params.id);

    await clearPromotionFromProducts(banner);

    res.status(200).json({ message: "Banner eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el banner" });
  }
};

module.exports = {
  getAllBanners,
  getBannerById,
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

const syncPromotionToProducts = async (oldBanner, newBanner) => {
  const oldFilter = buildProductFilterFromBanner(oldBanner);
  const newFilter = buildProductFilterFromBanner(newBanner);

  if (oldFilter) {
    await itemModel.updateMany(oldFilter, {
      $set: {
        promotion: {
          active: false,
          percentage: 0,
          startDate: null,
          endDate: null,
        },
      },
    });
  }

  if (!newFilter) return;

  const promotion = getPromotionPayloadFromBanner(newBanner);

  await itemModel.updateMany(newFilter, { $set: { promotion } });
};
