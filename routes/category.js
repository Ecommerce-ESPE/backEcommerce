const {Router} = require('express');
const router = Router();

const { crearCategoria,
        getCategorias, 
        getCategoriaById,
        getCategorySpecTemplate,
        getPopularCategories,
        updateCategoria,
        deleteCategoria,
        deleteSubcategory
} = require("../controllers/categories");

//Todo: Route Category
router.post("/", crearCategoria);
router.get("/", getCategorias);
router.get("/popular", getPopularCategories);
router.get("/:id/spec-template", getCategorySpecTemplate);
router.get("/:id/subcategory/:subcategoryId/spec-template", getCategorySpecTemplate);
router.get("/:id", getCategoriaById);
router.put("/:id", updateCategoria);
router.delete("/:id", deleteCategoria);

router.delete('/:categoryId/subcategory/:subcategoryId', deleteSubcategory);

//router.get("/", config );

//router.post("/", createFactura);
module.exports = router;
