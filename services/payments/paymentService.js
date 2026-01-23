const PaymentSimulator = require("../../middlewares/paymentSimulator");
const { chargeCredits } = require("../creditsPaymentService");

const processPayment = async (paymentData, amount, session, options = {}) => {
  const handlers = {
    "credit-card": async () => {
      if (!paymentData.details) {
        throw new Error("Detalles de tarjeta requeridos");
      }
      return PaymentSimulator.processCreditCard(paymentData.details, amount);
    },
    credits: async () => {
      const { orderId, userId, amountCents, idempotencyKey } = options;
      if (!orderId || !userId || !idempotencyKey) {
        throw new Error("Faltan datos para pago con cr?ditos");
      }

      const result = await chargeCredits({
        orderId,
        userId,
        amountCents,
        idempotencyKey,
        session,
      });

      if (result.status !== "completed") {
        return {
          success: false,
          status: "failed",
          message: "Creditos insuficientes",
          error: "Creditos insuficientes",
          errorCode: "INSUFFICIENT_CREDITS",
          transactionId: result.transactionId,
        };
      }

      return {
        success: true,
        status: "completed",
        transactionId: result.transactionId,
        message: "Cr?ditos aplicados exitosamente",
        remainingCredits: result.remainingCredits,
      };
    },
    transfer: async () => ({
      success: true,
      status: "pending",
      message: "Esperando confirmaciÃ³n de transferencia",
    }),
    paypal: async () => {
      return PaymentSimulator.processPayPal(amount);
    },
  };

  const handler = handlers[paymentData.method];
  if (!handler) throw new Error("MÃ©todo de pago no soportado");

  const result = await handler();
  if (!result) {
    throw new Error("No se recibiÃ³ respuesta del procesador de pagos");
  }

  return result;
};

module.exports = {
  processPayment,
};
