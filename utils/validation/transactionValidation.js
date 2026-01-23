const validateTransactionData = (data) => {
  const errors = [];

  if (!data.customer || typeof data.customer !== "object") {
    errors.push("Falta informaciÃ³n del cliente.");
  } else {
    if (!data.customer.name || typeof data.customer.name !== "string") {
      errors.push("Nombre del cliente es requerido.");
    }

    if (!data.customer.email || typeof data.customer.email !== "string") {
      errors.push("Email del cliente es requerido.");
    }

    if (!data.customer.phone || typeof data.customer.phone !== "string") {
      errors.push("TelÃ©fono del cliente es requerido.");
    }

    if (!data.customer.userId || typeof data.customer.userId !== "string") {
      errors.push("ID del usuario es requerido.");
    }
  }

  if (!data.order || typeof data.order !== "object") {
    errors.push("Falta la informaciÃ³n del pedido.");
  } else {
    if (!Array.isArray(data.order.items) || data.order.items.length === 0) {
      errors.push("Debe incluir al menos un producto en el pedido.");
    } else {
      data.order.items.forEach((item, index) => {
        if (!item.productId || typeof item.productId !== "string") {
          errors.push(`El item ${index + 1} no tiene productId vÃ¡lido.`);
        }

        if (!item.variantId || typeof item.variantId !== "string") {
          errors.push(`El item ${index + 1} no tiene variantId vÃ¡lido.`);
        }

        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          errors.push(`El item ${index + 1} tiene una cantidad invÃ¡lida.`);
        }
      });
    }

    if (!data.order.shipping || typeof data.order.shipping !== "object") {
      errors.push("Falta la informaciÃ³n de envÃ­o.");
    } else {
      if (
        !data.order.shipping.methodId ||
        typeof data.order.shipping.methodId !== "string"
      ) {
        errors.push("ID del mÃ©todo de envÃ­o es requerido.");
      }

      const addr = data.order.shipping.address;

      if (!addr || typeof addr !== "object") {
        errors.push("DirecciÃ³n de envÃ­o invÃ¡lida.");
      } else {
        const requiredAddressFields = [
          "provincia",
          "canton",
          "parroquia",
          "callePrincipal",
          "numeroCasa",
          "codigoPostal",
        ];

        requiredAddressFields.forEach((field) => {
          if (!addr[field] || typeof addr[field] !== "string") {
            errors.push(`Campo de direcciÃ³n '${field}' es requerido.`);
          }
        });
      }

      if (
        typeof data.order.shipping.cost !== "number" ||
        data.order.shipping.cost < 0
      ) {
        errors.push("El costo de envÃ­o debe ser un nÃºmero mayor o igual a 0.");
      }
    }
  }

  if (!data.payment || typeof data.payment !== "object") {
    errors.push("Falta la informaciÃ³n de pago.");
  } else {
    const validMethods = ["credit-card", "credits", "transfer", "paypal"];
    const method = data.payment.method;

    if (!method || typeof method !== "string") {
      errors.push("El mÃ©todo de pago es requerido.");
    } else if (!validMethods.includes(method)) {
      errors.push(
        `MÃ©todo de pago '${method}' no es vÃ¡lido. MÃ©todos aceptados: ${validMethods.join(", ")}`,
      );
    }

    if (method && validMethods.includes(method)) {
      const details = data.payment.details || {};

      if (!details || typeof details !== "object") {
        errors.push("Detalles del pago son requeridos.");
      } else {
        switch (method) {
          case "credit-card":
            ["cardNumber", "expiry", "cvc", "cardholderName"].forEach(
              (field) => {
                if (!details[field] || typeof details[field] !== "string") {
                  errors.push(
                    `Para tarjeta de crÃ©dito, el campo '${field}' es requerido.`,
                  );
                }
              },
            );
            break;
          case "credits":
            if (!details.userId || typeof details.userId !== "string") {
              errors.push(
                "Para pago con crÃ©ditos, el ID de usuario es requerido.",
              );
            }
            break;
          case "transfer":
            if (!details.reference || typeof details.reference !== "string") {
              errors.push(
                "Para transferencia, el nÃºmero de referencia es requerido.",
              );
            }
            break;
          case "paypal":
            if (
              !details.email ||
              typeof details.email !== "string" ||
              !details.email.includes("@")
            ) {
              errors.push("Para PayPal, se requiere un email vÃ¡lido.");
            }
            break;
        }
      }
    }
  }

  return errors;
};

module.exports = {
  validateTransactionData,
};
