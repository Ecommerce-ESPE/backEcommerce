const {Router} = require('express');
const router = Router();

const { crearCategoria,
        getCategorias, 
        updateCategoria,
        deleteCategoria,
        deleteSubcategory
} = require("../controllers/categories");

//Todo: Route Category
router.post("/", crearCategoria);
router.get("/", getCategorias);

//router.get("/:id", getCategorias);
router.put("/:id", updateCategoria);
router.delete("/:id", deleteCategoria);

router.delete('/:categoryId/subcategory/:subcategoryId', deleteSubcategory);

//router.get("/", config );

//router.post("/", createFactura);
module.exports = router;