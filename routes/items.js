const { Router } = require("express");
const router = Router();
const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');
const {
  getItemsAll,
  createItem,
  getItemsById,
  getFilteredItems,
  updateItemPromotion,
  updateItem,
  deleteItem,
  getFilteredItemsAdmin
} = require("../controllers/item");
const {
  uploadMultipleImages,
  deleteImageFromItem,
} = require("../controllers/uploadMultipleImages");
const upload = require("../middlewares/upload");


// SEARCH
router.get('/filter', getFilteredItems);
router.get('/admin/filter', getFilteredItemsAdmin);

//Todo: Route ITEMS
router.get("/", getItemsAll);
router.get("/:id", getItemsById);
router.post("/",[validarJWT,validarAdmin],createItem);
router.post("/:id",updateItem)
router.delete("/:id",[validarJWT,validarAdmin], deleteItem);
// ACTUALIZAR PROMOCIÓN
router.patch("/:id/promotion", updateItemPromotion);


/// UPLOAD
//router.put('/:id/upload-images', upload.array('images', 10), uploadMultipleImages);
router.put(
  "/:id/upload-images",
  upload.fields([
    { name: "images", maxCount: 10 },
    { name: "banner", maxCount: 1 },
  ]),
  uploadMultipleImages
);

router.post("/image/delete", deleteImageFromItem);

// eliminar producto {

module.exports = router;
