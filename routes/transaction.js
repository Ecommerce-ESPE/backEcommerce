const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transaction.controller");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { validarJWT, validarAdmin } = require('../middlewares/validar-jwt');



const {getInvoicesAll,
  getInvoicesByCustomer,
  createInvoice,
  generateInvoicePDF,getMyTransaction,getOrdenByID} = require("../controllers/factura");

// Procesar transacción
router.post(
  '/process',
  [
    // Validación de datos del cliente
    check('customer.name', 'El nombre del cliente es obligatorio').not().isEmpty(),
    check('customer.email', 'Ingrese un email válido').isEmail(),
    check('customer.phone', 'El teléfono es obligatorio').not().isEmpty(),
    check('customer.userId', 'El ID de usuario es obligatorio').optional().isMongoId(),

    // Validación de items del pedido
    check('order.items', 'Debe incluir al menos un producto').isArray({ min: 1 }),
    check('order.items.*.productId', 'ID de producto inválido').isMongoId(),
    check('order.items.*.price', 'El precio debe ser un número positivo').optional().isFloat({ gt: 0 }),
    check('order.items.*.quantity', 'La cantidad debe ser un número entero mayor a 0').isInt({ gt: 0 }),
    check('order.items.*.variantId', 'ID de variante inválido').optional().isMongoId(),
    
    // Validación de envío (actualizada)
    check('order.shipping.methodId', 'Método de envío requerido').isMongoId(),
    check('order.shipping.address.callePrincipal', 'La calle principal es obligatoria').not().isEmpty(),
    check('order.shipping.address.canton', 'El cantón es obligatorio').not().isEmpty(),
    check('order.shipping.address.provincia', 'La provincia es obligatoria').not().isEmpty(),
    check('order.shipping.address.codigoPostal', 'El código postal es obligatorio').not().isEmpty(),
    check('order.shipping.address.parroquia', 'La parroquia debe ser texto').optional().isString(),
    check('order.shipping.address.numeroCasa', 'El número de casa debe ser texto').optional().isString(),
    check('order.shipping.address.referencia', 'La referencia debe ser texto').optional().isString(),
    
    // Validación de método de pago
    check('payment.method', 'Método de pago inválido').isIn(['credit-card', 'transfer', 'credits', 'paypal']),
    
    // Validaciones específicas para tarjeta de crédito
    check('payment.details.cardNumber', 'Número de tarjeta requerido para pago con tarjeta')
      .if((value, { req }) => req.body.payment.method === 'credit-card')
      .not().isEmpty(),
    // ... (resto de validaciones de pago)

    validarCampos
  ],
  transactionController.processTransaction
);

// Descargar factura
router.get(
  "/invoices/:id",
  //authMiddleware,s
  generateInvoicePDF
);

// Obtener Mis Transacciones getOrdenByID
router.get("/",[validarJWT],getMyTransaction);
router.get("/order/:id",getOrdenByID);

// Subir comprobante (para transferencias)
router.post(
  "/:transactionId/voucher",
  //authMiddleware,
  upload.single("voucher"),
  [
    check("transactionId", "ID de transacción inválido").isMongoId(),
    validarCampos,
  ]
  //transactionController.uploadVoucher
);

// Confirmar pago (admin)
router.post(
  "/:transactionId/confirm",
  //authMiddleware,
  //isAdmin,
  [
    check("transactionId", "ID de transacción inválido").isMongoId(),
    validarCampos,
  ]
  //transactionController.confirmPayment
);

module.exports = router;
