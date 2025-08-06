
const {
  orderModel,
  transactionModel,
  invoiceModel,
  itemModel,
  discountModel,
  userModel,
  shippingMethodModel,
} = require("../models/index");

class PaymentSimulator {
  static testCards = {
    // Tarjetas válidas
    'VISA_SUCCESS': {
      number: '4242424242424242',
      message: 'Pago exitoso',
      success: true
    },
    'MASTERCARD_SUCCESS': {
      number: '5555555555554444',
      message: 'Pago exitoso',
      success: true
    },
    'AMEX_SUCCESS': {
      number: '378282246310005',
      message: 'Pago exitoso',
      success: true
    },
    
    // Tarjetas con errores
    'INSUFFICIENT_FUNDS': {
      number: '4000000000009995',
      message: 'Fondos insuficientes',
      success: false,
      errorCode: 'INSUFFICIENT_FUNDS'
    },
    'LOST_CARD': {
      number: '4000000000009987',
      message: 'Tarjeta reportada como perdida',
      success: false,
      errorCode: 'LOST_CARD'
    },
    'STOLEN_CARD': {
      number: '4000000000009979',
      message: 'Tarjeta reportada como robada',
      success: false,
      errorCode: 'STOLEN_CARD'
    },
    'EXPIRED_CARD': {
      number: '4000000000000069',
      message: 'Tarjeta expirada',
      success: false,
      errorCode: 'EXPIRED_CARD'
    },
    'GENERIC_DECLINE': {
      number: '4000000000000002',
      message: 'Transacción rechazada',
      success: false,
      errorCode: 'GENERIC_DECLINE'
    },
    'PROCESSING_ERROR': {
      number: '4000000000000119',
      message: 'Error de procesamiento',
      success: false,
      errorCode: 'PROCESSING_ERROR'
    },
    
    // Tarjetas para casos especiales
    'CHARGEBACK': {
      number: '4000000000000259',
      message: 'Transacción con disputa',
      success: false,
      errorCode: 'CHARGEBACK'
    },
    'FRAUDULENT': {
      number: '4000000000000101',
      message: 'Actividad fraudulenta detectada',
      success: false,
      errorCode: 'FRAUDULENT'
    }
  };

  static async processCreditCard(details, amount) {
    try {
      this.validateCardDetails(details);
      this.validateAmount(amount);
      
      const paymentData = {
        cardNumber: details.cardNumber.replace(/\s+/g, ''),
        expiry: details.expiry,
        cvc: details.cvc,
        amount: parseFloat(amount)
      };

      // Simular tiempo de procesamiento
      await this.simulateProcessingDelay();
      
      const result = this.processCardPayment(paymentData);
      
      return {
        success: result.success,
        status: result.success ? 'completed' : 'failed',
        transactionId: result.transactionId || `tx_${Date.now()}`,
        authorizationCode: result.success ? `AUTH${Math.floor(Math.random() * 10000)}` : undefined,
        message: result.message,
        ...(!result.success && { 
          error: result.message,
          errorCode: result.errorCode,
          declineCode: this.getDeclineCode(result.errorCode)
        })
      };
    } catch (error) {
      console.error('Error en processCreditCard:', error.message);
      return {
        success: false,
        status: 'failed',
        message: error.message,
        errorCode: 'PROCESSING_ERROR',
        declineCode: 'processing_error'
      };
    }
  }

   static async processCredits(userId, amount, session) { // Añadir session como parámetro
    try {
      this.validateUserId(userId);
      this.validateAmount(amount);
      
      // Verificar usuario y créditos REALES
      const user = await userModel.findById(userId).session(session);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }
      
      if (user.credits < amount) {
        throw new Error(`Créditos insuficientes. Disponibles: ${user.credits}, Requeridos: ${amount}`);
      }
      
      // Simular tiempo de procesamiento
      await this.simulateProcessingDelay(800);
      
      return {
        success: true,
        status: 'completed',
        transactionId: `cred_${Date.now()}`,
        message: 'Créditos aplicados exitosamente',
        userId: userId,
        amountDeducted: parseFloat(amount)
      };
    } catch (error) {
      console.error('Error en processCredits:', error.message);
      return {
        success: false,
        status: 'failed',
        message: error.message,
        errorCode: 'INSUFFICIENT_CREDITS'
      };
    }
  }

  static async processPayPal(amount) {
    try {
      this.validateAmount(amount);
      
      // Simular tiempo de procesamiento
      await this.simulateProcessingDelay(1500);
      
      return {
        success: true,
        status: 'completed',
        transactionId: `paypal_${Date.now()}`,
        message: 'Pago con PayPal completado',
        amount: parseFloat(amount)
      };
    } catch (error) {
      console.error('Error en processPayPal:', error.message);
      return {
        success: false,
        status: 'failed',
        message: error.message,
        errorCode: 'PAYPAL_ERROR'
      };
    }
  }

  static validateCardDetails(details) {
    if (!details) throw new Error('Detalles de pago no proporcionados');
    if (!details.cardNumber) throw new Error('Número de tarjeta requerido');
    if (!details.expiry) throw new Error('Fecha de expiración requerida');
    if (!details.cvc) throw new Error('Código CVC requerido');
    
    // Validación básica de formato
    const cardNumber = details.cardNumber.replace(/\s+/g, '');
    if (!/^\d{13,16}$/.test(cardNumber)) {
      throw new Error('Número de tarjeta inválido');
    }
    if (!/^\d{2}\/\d{2}$/.test(details.expiry)) {
      throw new Error('Fecha de expiración inválida (use MM/YY)');
    }
    if (!/^\d{3,4}$/.test(details.cvc)) {
      throw new Error('Código CVC inválido');
    }
  }

  static validateAmount(amount) {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Monto inválido');
    }
  }

  static validateUserId(userId) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('ID de usuario inválido');
    }
  }

  static processCardPayment(paymentData) {
    const testCard = Object.values(this.testCards).find(
      card => card.number === paymentData.cardNumber
    );
    
    if (testCard) {
      return testCard;
    }
    
    // Lógica para tarjetas no registradas
    const isSuccess = paymentData.cardNumber.startsWith('4') || 
                     paymentData.cardNumber.startsWith('5');
    
    return {
      success: isSuccess,
      message: isSuccess ? 'Pago exitoso' : 'Transacción rechazada',
      errorCode: isSuccess ? undefined : 'GENERIC_DECLINE'
    };
  }

  static async simulateProcessingDelay(baseDelay = 1000) {
    const delay = baseDelay + Math.random() * 500; // Variabilidad
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  static getDeclineCode(errorCode) {
    const codes = {
      'INSUFFICIENT_FUNDS': 'insufficient_funds',
      'LOST_CARD': 'lost_card',
      'STOLEN_CARD': 'stolen_card',
      'EXPIRED_CARD': 'expired_card',
      'GENERIC_DECLINE': 'generic_decline',
      'PROCESSING_ERROR': 'processing_error',
      'CHARGEBACK': 'chargeback',
      'FRAUDULENT': 'fraudulent',
      'CREDIT_PROCESSING_ERROR': 'credit_error',
      'PAYPAL_ERROR': 'paypal_error'
    };
    return codes[errorCode] || 'generic_decline';
  }
}

module.exports = PaymentSimulator;