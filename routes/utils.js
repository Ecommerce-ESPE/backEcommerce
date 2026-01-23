// PROMOCIÓN: Utilidades para la gestión de rutas
// BANNER HERO: Utilidades para la gestión de banners hero
const { Router } = require("express");
const router = Router();
const upload = require("../middlewares/upload");

const {
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
} = require("../controllers/utils.controller");
const {
  uploadBannerHeroImage,
} = require("../controllers/uploadMultipleImages");
const {
  getItemRecentlyAdded,
  getFeaturedItems,
} = require("../controllers/item");

const {
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner
} = require("../controllers/bannerPromotion");

router.post("/banner-hero", createBannerHero);
router.get("/banner-hero/date", getBannersHeroDate);
router.get("/banner-hero", getAllBannersHero);
router.put("/banner-hero/:id", updateBannerHero);
router.delete("/banner-hero/:id", deleteBannerHero);
// Upload Banner Hero
router.put(
  "/banner-hero/:id/upload-image",
  upload.single("image"),
  uploadBannerHeroImage
);

// PROMOBAR
router.post("/promo-bar", createPromoBar);
router.get("/promo-bar/date", getPromoBarDate);
router.get("/promo-bar", getAllPromoBars);
router.put("/promo-bar/:id", updatePromoBar);
router.delete("/promo-bar/:id", deletePromoBar);

// ITEMS RECIENTEMENTE AÑADIDOS
router.get("/recently-added", getItemRecentlyAdded);
// ITEMS DESTACADOS
router.get("/featured-items", getFeaturedItems);

// BANNER PROMOTION
router.post("/banner-promotion", createBanner);
router.get("/banner-promotion", getAllBanners);
router.put("/banner-promotion/:id", updateBanner);
router.delete("/banner-promotion/:id", deleteBanner);

module.exports = router;
