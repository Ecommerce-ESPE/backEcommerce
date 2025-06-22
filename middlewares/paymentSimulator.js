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

  static async processPayment(paymentData) {
    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Buscar si es una tarjeta de prueba conocida
    const cardNumber = paymentData.cardNumber.replace(/\s+/g, '');
    const testCard = Object.values(this.testCards).find(
      card => card.number === cardNumber
    );
    
    if (testCard) {
      return testCard.success 
        ? this.successResponse()
        : this.errorResponse(testCard.errorCode, testCard.message);
    }
    
    // Lógica para otras tarjetas
    return cardNumber.startsWith('42') || cardNumber.startsWith('55')
      ? this.successResponse()
      : this.errorResponse('GENERIC_DECLINE', 'Transacción rechazada');
  }

  static successResponse() {
    return {
      success: true,
      transactionId: `trx_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date(),
      authorizationCode: `AUTH${Math.floor(Math.random() * 10000)}`,
      processorResponse: '00 - Approved'
    };
  }

  static errorResponse(code, message) {
    return {
      success: false,
      errorCode: code,
      message,
      declineCode: this.getDeclineCode(code),
      timestamp: new Date()
    };
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
      'FRAUDULENT': 'fraudulent'
    };
    return codes[errorCode] || 'generic_decline';
  }
}

module.exports = PaymentSimulator;