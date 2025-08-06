const { bannerPromotionModel } = require("../models/index");

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
      categories = [],
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
      categories,
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
    const updatedBanner = await bannerPromotionModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedBanner) return res.status(404).json({ error: "Banner no encontrado" });

    actualizarEstadoBanner(updatedBanner);
    await updatedBanner.save();

    res.status(200).json(updatedBanner);
  } catch (error) {
    res.status(400).json({ error: "Error al actualizar el banner", detail: error.message });
  }
};

// DELETE - Eliminar banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await bannerPromotionModel.findByIdAndDelete(req.params.id);

    if (!banner) return res.status(404).json({ error: "Banner no encontrado" });

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
