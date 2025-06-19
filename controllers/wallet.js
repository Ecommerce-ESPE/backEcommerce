// Ruta para canjear un código

const {userModel, redemptionCodeModel, discountModel } = require('../models/index');

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


module.exports = {
 redemptionCode,
 createRedemptionCode,
 creatediscountCode,
}