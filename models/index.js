const models = {
     userModel:require('./nosql/user.model'),
     itemModel:require('./nosql/item.model'),
     facturaModel:require('./nosql/factura.model'),
     redemptionCodeModel:require('./nosql/redemptionCode'),
     discountModel:require('./nosql/discount.model'),
     logAuditoriaModel:require('./nosql/logAuditoria.model'),
     categoryModel:require('./nosql/category.model'),
     promoBarModel:require('./nosql/promoBar.model'),
     bannerHeroModel:require('./nosql/banner.model'),
     orderModel:require('./nosql/order.model'),
     transactionModel:require('./nosql/transaction.model'),
     invoiceModel:require('./nosql/invoice.model'),
     shippingMethodModel:require('./nosql/shippingMethod.model'),
     bannerPromotionModel:require('./nosql/bannerPromotion.model'),
}

module.exports = models;