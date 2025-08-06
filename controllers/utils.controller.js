const { bannerHeroModel, promoBarModel } = require("../models/index");

//*********************** */
// BANNER HERO
//********************** */
// Crear Banner Hero
const createBannerHero = async (req, res) => {
  try {
    const bannerHero = new bannerHeroModel(req.body);
    await bannerHero.save();
    res
      .status(201)
      .json({ message: "Banner Hero creado exitosamente", data: bannerHero });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al crear Banner Hero", error: error.message });
  }
};

// Get Banners Hero Date
const getBannersHeroDate = async (req, res) => {
try {
    const currentDate = new Date();
    const banners = await bannerHeroModel.find({
        startDate: { $lte: currentDate },
        endDate: { $gte: currentDate },
        visible: true,
    })
        .sort({ startDate: -1 }) // Ordenar por fecha de inicio descendente (más recientes primero)
        .limit(5); // Limitar a 5 banners

    res.status(200).json({
        ok: true,
        banners: banners,
    });
} catch (error) {
    res.status(500).json({
        ok: false,
        message: "Error al obtener los banners hero",
        error: error.message,
    });
}
};

// Get All Banners Hero
const getAllBannersHero = async (req, res) => {
  try {
    const banners = await bannerHeroModel.find();
    res.status(200).json({
      ok: true,
      banners: banners,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al obtener los banners hero",
      error: error.message,
    });
  }
}
// ACTULIZAR BANNER HERO
const updateBannerHero = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedBanner = await bannerHeroModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedBanner) {
            return res.status(404).json({ message: "Banner Hero no encontrado" });
        }
        res.status(200).json({
            message: "Banner Hero actualizado exitosamente",
            data: updatedBanner,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al actualizar Banner Hero",
            error: error.message,
        }); 
    }
};
//Delete 
const deleteBannerHero = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBanner = await bannerHeroModel.findByIdAndDelete(id);
        if (!deletedBanner) {
            return res.status(404).json({ message: "Banner Hero no encontrado" });
        }
        res.status(200).json({
            message: "Banner Hero eliminado exitosamente",
            data: deletedBanner,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al eliminar Banner Hero",
            error: error.message,
        });
    }
};

//*********************** */
// PROMOBAR
//********************** */

// Crear PromoBar
const createPromoBar = async (req, res) => {
  try {
    const promoBar = new promoBarModel(req.body);
    await promoBar.save();
    res
      .status(201)
      .json({ message: "PromoBar creado exitosamente", data: promoBar });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al crear PromoBar", error: error.message });
  }
};
// Get PromoBar Date
const getPromoBarDate = async (req, res) => {
  try {
    const currentDate = new Date();
    const promoBars = await promoBarModel.find({
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      visible: true,
    })
      .sort({ startDate: -1 }) // Ordenar por fecha de inicio descendente (más recientes primero)
      .limit(5); // Limitar a 5 promoBars

    res.status(200).json({
      ok: true,
      promoBars: promoBars,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error al obtener los promoBars",
      error: error.message,
    });
  }
};
// Get All PromoBars
const getAllPromoBars = async (req, res) => {
    try {
        const promoBars = await promoBarModel.find();
        res.status(200).json({
        ok: true,
        promoBars: promoBars,
        });
    } catch (error) {
        res.status(500).json({
        ok: false,
        message: "Error al obtener los promoBars",
        error: error.message,
        });
    }
    }
// Update PromoBar
const updatePromoBar = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedPromoBar = await promoBarModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedPromoBar) {
            return res.status(404).json({ message: "PromoBar no encontrado" });
        }
        res.status(200).json({
            message: "PromoBar actualizado exitosamente",
            data: updatedPromoBar,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al actualizar PromoBar",
            error: error.message,
        });
    }
};
// Delete PromoBar
const deletePromoBar = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedPromoBar = await promoBarModel.findByIdAndDelete(id);
        if (!deletedPromoBar) {
            return res.status(404).json({ message: "PromoBar no encontrado" });
        }
        res.status(200).json({
            message: "PromoBar eliminado exitosamente",
            data: deletedPromoBar,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al eliminar PromoBar",
            error: error.message,
        });
    }
};
module.exports = {
    //BANER HERO
    createBannerHero,
    getBannersHeroDate,
    getAllBannersHero,
    updateBannerHero,
    deleteBannerHero,
    // PROMOBAR
    createPromoBar,
    getPromoBarDate,
    getAllPromoBars,
    updatePromoBar,
    deletePromoBar,
}