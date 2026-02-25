const { Router } = require("express");
const router = Router();

const {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
} = require("../controllers/brands");

router.post("/", createBrand);
router.get("/", getBrands);
router.get("/:id", getBrandById);
router.put("/:id", updateBrand);
router.delete("/:id", deleteBrand);

module.exports = router;
