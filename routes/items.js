const { Router } = require("express");
const router = Router();

const {
  getItemsAll,
  createItem,
  getItemsById,
  getFilteredItems,
} = require("../controllers/item");
const {
  uploadMultipleImages,
  deleteImageFromItem,
} = require("../controllers/uploadMultipleImages");
const upload = require("../middlewares/upload");


// SEARCH
router.get('/filter', getFilteredItems);

//Todo: Route ITEMS
router.get("/", getItemsAll);
router.get("/:id", getItemsById);
router.post("/", createItem);


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
router.delete("/image", deleteImageFromItem);

module.exports = router;
