const { Router } = require("express");
const router = Router();
const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');
const {
  getItemsAll,
  createItem,
  getItemsById,
  getItemsSuggest,
  getFilteredItems,
  updateItemPromotion,
  updateItem,
  deleteItem,
  getFilteredItemsAdmin
} = require("../controllers/items");

// SEARCH
router.get('/suggest', getItemsSuggest);
router.get('/filter', getFilteredItems);
router.get('/admin/filter', getFilteredItemsAdmin);

//Todo: Route ITEMS
router.get("/", getItemsAll);
router.get("/:id", getItemsById);
router.post("/",[validarJWT,validarAdmin],createItem);
router.post("/:id",updateItem)
router.delete("/:id",[validarJWT,validarAdmin], deleteItem);
// ACTUALIZAR PROMOCION
router.patch("/:id/promotion", updateItemPromotion);

module.exports = router;
