const models = {
     userModel:require('./nosql/user.model'),
     itemModel:require('./nosql/item.model'),
     facturaModel:require('./nosql/factura.model'),
     redemptionCodeModel:require('./nosql/redemptionCode'),
     discountModel:require('./nosql/discount.model'),
     logAuditoriaModel:require('./nosql/logAuditoria.model'),
     categoryModel:require('./nosql/category.model'),
}

module.exports = models;