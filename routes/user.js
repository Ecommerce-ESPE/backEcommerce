const {Router} = require('express');
const router = Router();
const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');

const {
    getUserAll,
    getUserById,
    crearUsuario,
    actualizarUsuario,
    borrarUsuario,
    getUserByIdAdmin,
    addAdress,
    setPrimaryAddress,
} = require("../controllers/users");

//Todo: Route users 
router.get("/",[validarJWT,validarAdmin], getUserAll);

router.get("/my-profile",[validarJWT],getUserById);
router.get("/:id",getUserByIdAdmin);

router.post("/add-address",[validarJWT], addAdress);
router.put("/address/primary",[validarJWT], setPrimaryAddress);

router.put("/update",[validarJWT], actualizarUsuario)
//router.post
//router

//router.post("/",createUser);
module.exports = router;
