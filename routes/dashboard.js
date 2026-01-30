const { Router } = require("express");
const router = Router();
const { validarJWT } = require("../middlewares/validar-jwt");
const { getActivity } = require("../controllers/dashboard");

router.get("/activity", validarJWT, getActivity);

module.exports = router;
