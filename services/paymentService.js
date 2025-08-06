const {userModel} = require("../models/index");

module.exports = {
  async processCreditCard(details, amount) {
    // Simulador de pago con tarjeta
    return {
      success: true,
      transactionId: `tx_${Date.now()}`
    };
  },
  
  async processCredits(userId, amount) {
    const user = await userModel.findById(userId);
    
    if (user.credits < amount) {
      return {
        success: false,
        error: "Créditos insuficientes"
      };
    }
    
    return {
      success: true,
      transactionId: `credits_${Date.now()}`
    };
  }
};