/*
    Path: '/api/login'
*/
const { Router } = require('express');
const { login, renewToken } = require('../controllers/auth.controller');
const { crearUsuario } = require('../controllers/user');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();

router.post( '/login',
    [
        check('email', 'El email es obligatorio').isEmail(),
        check('password', 'El password es obligatorio').not().isEmpty(),
        validarCampos
    ],
    login
);

router.post('/register',
    [
        check('name', 'El nombre es obligatorio').not().isEmpty(),
        check('email', 'El email es obligatorio').isEmail(),
        check('password', 'El password es obligatorio').not().isEmpty(),
        check('ci', 'El CI es obligatorio').not().isEmpty(),
        check('role').optional().isIn(['USER', 'ADMIN', 'DEV']).withMessage('Rol inválido'),
        check('address').optional().isObject().withMessage('La dirección debe ser un objeto'),
        check('phone').optional().isString(),
        check('profileUrl').optional().isURL().withMessage('La URL del perfil no es válida'),
        check('transactions').optional().isArray(),
        check('config').optional().isString(),
        check('credits').optional().isNumeric(),
        validarCampos
    ],
    crearUsuario
);

router.get( '/renew',
    validarJWT,
    renewToken
)


module.exports = router;