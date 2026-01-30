// PROMOCION: Utilidades para la gestion de rutas
// BANNER HERO: Utilidades para la gestion de banners hero
const { Router } = require("express");
const router = Router();

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
} = require("../controllers/utils");
const {
  getItemRecentlyAdded,
  getFeaturedItems,
} = require("../controllers/items");

const {
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner
} = require("../controllers/banner-promotion");

router.post("/banner-hero", createBannerHero);
router.get("/banner-hero/date", getBannersHeroDate);
router.get("/banner-hero", getAllBannersHero);
router.put("/banner-hero/:id", updateBannerHero);
router.delete("/banner-hero/:id", deleteBannerHero);

// PROMOBAR
router.post("/promo-bar", createPromoBar);
router.get("/promo-bar/date", getPromoBarDate);
router.get("/promo-bar", getAllPromoBars);
router.put("/promo-bar/:id", updatePromoBar);
router.delete("/promo-bar/:id", deletePromoBar);

// ITEMS RECIENTEMENTE ANADIDOS
router.get("/recently-added", getItemRecentlyAdded);
// ITEMS DESTACADOS
router.get("/featured-items", getFeaturedItems);

// BANNER PROMOTION
router.post("/banner-promotion", createBanner);
router.get("/banner-promotion", getAllBanners);
router.put("/banner-promotion/:id", updateBanner);
router.delete("/banner-promotion/:id", deleteBanner);

module.exports = router;