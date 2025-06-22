// Ruta para canjear un código

const {userModel, redemptionCodeModel, discountModel, itemModel } = require('../models/index');
const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const createRedemptionCode = async (req, res)=>{
    const {body} = req;
    const data = await redemptionCodeModel.create(body);

    res.json({
        msg:"Succesfull",
        code: data
    })
}

const redemptionCode = async (req, res) => {
    try {      
      const user = await userModel.findById(req.params.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      console.log(user)
      const codeToRedeem = req.body.code;
      
      const redemptionCode = await redemptionCodeModel.findOne({ code: codeToRedeem });
  
      if (!redemptionCode) {
        return res.status(400).json({ message: 'Código de canje no válido' });
      }
  
      if (redemptionCode.redeemed) {
        return res.status(400).json({ message: 'El código ya ha sido canjeado' });
      }
  
      user.credits += redemptionCode.value;
      redemptionCode.redeemed = true;
  
      await user.save();
      await redemptionCode.save();
  
      res.json({ message: 'Canje exitoso', newBalance: user.credits });
    } catch (error) {
      res.status(500).json({ message: 'Error interno del servidor', error});
    }
}


const creatediscountCode = async(req,res)=>{
  const {body} = req;
  const data = await discountModel.create(body);

  res.json({
      msg:"Succesfull",
      code: data
  })
}

const validateDiscount = async (req, res) => {
  const { items: itemIds, discountCode } = req.body;

  try {
    // Validar entrada
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        valid: false,
        message: "Se requiere al menos un producto para validar el descuento"
      });
    }

    // Filtrar y normalizar IDs válidos
    const validItemIds = itemIds
      .map(id => {
        // Intentar dividir IDs compuestos
        if (id.includes('-')) {
          return id.split('-').filter(part => 
            mongoose.Types.ObjectId.isValid(part)
          );
        }
        return id;
      })
      .flat()
      .filter(id => 
        mongoose.Types.ObjectId.isValid(id) && 
        new mongoose.Types.ObjectId(id).toString() === id
      );

    if (validItemIds.length === 0) {
      return res.status(400).json({
        valid: false,
        message: "No se encontraron productos con IDs válidos"
      });
    }

    // Buscar los productos usando solo IDs válidos
    const items = await itemModel.find({ _id: { $in: validItemIds } });

    if (!items.length) {
      return res.status(400).json({
        valid: false,
        message: "No se encontraron productos"
      });
    }

    // Calcular subtotal
    const subtotal = items.reduce((total, item) => {
      // Validar que el producto tenga precio
      if (item.value?.length > 0 && item.value[0].price !== undefined) {
        return total.plus(new Decimal(item.value[0].price));
      }
      return total;
    }, new Decimal(0));

    // Validar si el subtotal es suficiente para aplicar descuentos
    if (subtotal.lessThan(10)) {
      return res.json({
        valid: false,
        discountAmount: 0,
        message: "El subtotal debe ser al menos $10 para aplicar descuentos"
      });
    }

    let discountAmount = new Decimal(0);
    let message = "Descuento aplicado con éxito";

    // Buscar el descuento solo si se proporcionó un código
    if (discountCode) {
      const discount = await discountModel.findOne({
        code: discountCode
      });

      if (!discount) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: "Código de descuento no encontrado"
        });
      }

      // Validar estado del descuento
      if (!discount.isValid) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: "Este descuento no está activo"
        });
      }

      // Validar fecha de expiración
      if (discount.expiresAt <= new Date()) {
        return res.json({
          valid: false,
          discountAmount: 0,
          message: `El descuento expiró el ${discount.expiresAt.toLocaleDateString()}`
        });
      }

      // Calcular descuento
      const discountValue = new Decimal(discount.amount);
      
      if (discountValue.lessThanOrEqualTo(1)) {
        // Descuento porcentual
        discountAmount = subtotal.times(discountValue);
      } else {
        // Descuento fijo
        discountAmount = discountValue;
      }
    } else {
      message = "No se aplicó descuento";
    }

    res.json({
      valid: true,
      discountAmount: discountAmount.toNumber(),
      subtotal: subtotal.toNumber(),
      message
    });

  } catch (error) {
    console.error("Error validando descuento:", error);
    res.status(500).json({
      valid: false,
      discountAmount: 0,
      message: "Error interno del servidor"
    });
  }
};



module.exports = {
 redemptionCode,
 createRedemptionCode,
 creatediscountCode,
 validateDiscount
}