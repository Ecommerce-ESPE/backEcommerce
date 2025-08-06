const {Router} = require('express');
const router = Router();
const upload = require("../middlewares/upload");
const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');
const { validarCampos } = require('../middlewares/validar-campos');

const {
  uploadProfileImage
} = require("../controllers/uploadMultipleImages");
const {
    getUserAll,
    getUserById,
    crearUsuario,
    actualizarUsuario,
    borrarUsuario,
    getUserByIdAdmin,
    addAdress,
} = require("../controllers/user");

//Todo: Route users 
router.get("/",[validarJWT,validarAdmin], getUserAll);

router.get("/my-profile",[validarJWT],getUserById);
router.get("/:id",getUserByIdAdmin);

router.post("/add-address",[validarJWT], addAdress);

router.put("/update",[validarJWT], actualizarUsuario)
//router.post
//router

// UPLOAD IMG PERFIL
router.put("/profile/:id/upload-image", upload.single("image"), uploadProfileImage);

//router.post("/",createUser);
module.exports = router;