const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
} = require("../controllers/wishlist/actions");

const router = Router();

router.use(validarJWT);

router.get("/", getWishlist);
router.post("/:itemId", addWishlistItem);
router.delete("/:itemId", removeWishlistItem);

module.exports = router;
