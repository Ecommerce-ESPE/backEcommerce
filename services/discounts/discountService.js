const { discountModel } = require("../../models/index");

const processDiscount = async (code, subtotal, session) => {
  const defaultResponse = {
    valid: false,
    amount: 0,
    percentage: 0,
    type: null,
    message: "No se aplicÃ³ descuento",
  };

  if (!code || typeof code !== "string" || code.trim() === "") {
    return { ...defaultResponse, valid: true };
  }

  try {
    const discount = await discountModel
      .findOne({
        code: code.trim().toUpperCase(),
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .session(session);

    if (!discount) {
      return {
        ...defaultResponse,
        message: "CÃ³digo de descuento no vÃ¡lido o expirado",
      };
    }

    const minPurchase = discount.minPurchase || 0;
    if (subtotal < minPurchase) {
      return {
        ...defaultResponse,
        message: `MÃ­nimo de compra no alcanzado ($${minPurchase.toFixed(2)})`,
      };
    }

    if (typeof discount.amount !== "number" || isNaN(discount.amount)) {
      return {
        ...defaultResponse,
        message: "ConfiguraciÃ³n de descuento invÃ¡lida",
      };
    }

    let amount = 0;
    let percentage = 0;

    if (discount.type === "percentage") {
      percentage = discount.amount; // 15 = 15%
      amount = subtotal * (percentage / 100);
    } else if (discount.type === "fixed") {
      amount = Math.min(discount.amount, subtotal);
    } else {
      return {
        ...defaultResponse,
        message: "Tipo de descuento no soportado",
      };
    }

    amount = parseFloat(amount.toFixed(2));

    return {
      valid: true,
      amount,
      percentage,
      type: discount.type,
      message: `Descuento ${
        discount.type === "percentage"
          ? `${percentage}%`
          : `$${discount.amount.toFixed(2)}`
      } aplicado`,
      code: discount.code,
    };
  } catch (error) {
    console.error("[discountService] Error:", {
      message: error.message,
      stack: error.stack,
      code,
      subtotal,
      time: new Date().toISOString(),
    });

    return {
      ...defaultResponse,
      message: "Error al procesar descuento",
    };
  }
};

module.exports = {
  processDiscount,
};
