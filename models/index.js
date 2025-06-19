const models = {
     userModel:require('./nosql/user.model'),
     itemModel:require('./nosql/item.model'),
     facturaModel:require('./nosql/factura.model'),
     redemptionCodeModel:require('./nosql/redemptionCode'),
     discountModel:require('./nosql/discount.model')
}

module.exports = models;