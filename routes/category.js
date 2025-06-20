const {Router} = require('express');
const router = Router();

const { crearCategoria,
        getCategorias, 
} = require("../controllers/category.controller");

//Todo: Route Category
router.post("/", crearCategoria);
router.get("/", getCategorias);

//router.get("/", config );

//router.post("/", createFactura);
module.exports = router;