const validateTransactionData = (data) => {
  const errors = [];

  if (!data.customer || typeof data.customer !== "object") {
    errors.push("Falta informacion del cliente.");
  } else {
    if (!data.customer.name || typeof data.customer.name !== "string") {
      errors.push("Nombre del cliente es requerido.");
    }

    if (!data.customer.email || typeof data.customer.email !== "string") {
      errors.push("Email del cliente es requerido.");
    }

    if (!data.customer.phone || typeof data.customer.phone !== "string") {
      errors.push("Telefono del cliente es requerido.");
    }

    if (!data.customer.userId || typeof data.customer.userId !== "string") {
      errors.push("ID del usuario es requerido.");
    }
  }

  if (!data.order || typeof data.order !== "object") {
    errors.push("Falta la informacion del pedido.");
  } else {
    if (!Array.isArray(data.order.items) || data.order.items.length === 0) {
      errors.push("Debe incluir al menos un producto en el pedido.");
    } else {
      data.order.items.forEach((item, index) => {
        if (!item.productId || typeof item.productId !== "string") {
          errors.push(`El item ${index + 1} no tiene productId valido.`);
        }

        if (!item.variantId || typeof item.variantId !== "string") {
          errors.push(`El item ${index + 1} no tiene variantId valido.`);
        }

        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          errors.push(`El item ${index + 1} tiene una cantidad invalida.`);
        }
      });
    }

    if (!data.order.shipping || typeof data.order.shipping !== "object") {
      errors.push("Falta la informacion de envio.");
    } else {
      if (
        !data.order.shipping.methodId ||
        typeof data.order.shipping.methodId !== "string"
      ) {
        errors.push("ID del metodo de envio es requerido.");
      }

      const addr = data.order.shipping.address;

      if (!addr || typeof addr !== "object") {
        errors.push("Direccion de envio invalida.");
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
            errors.push(`Campo de direccion '${field}' es requerido.`);
          }
        });
      }

      if (
        typeof data.order.shipping.cost !== "number" ||
        data.order.shipping.cost < 0
      ) {
        errors.push("El costo de envio debe ser un numero mayor o igual a 0.");
      }
    }
  }

  if (!data.payment || typeof data.payment !== "object") {
    errors.push("Falta la informacion de pago.");
  } else {
    const validMethods = ["credit-card", "credits", "transfer", "paypal"];
    const method = data.payment.method;

    if (!method || typeof method !== "string") {
      errors.push("El metodo de pago es requerido.");
    } else if (!validMethods.includes(method)) {
      errors.push(
        `Metodo de pago '${method}' no es valido. Metodos aceptados: ${validMethods.join(", ")}`,
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
                    `Para tarjeta de credito, el campo '${field}' es requerido.`,
                  );
                }
              },
            );
            break;
          case "credits":
            if (
              details.source !== undefined &&
              typeof details.source !== "string"
            ) {
              errors.push(
                "Para pago con creditos, el campo 'source' debe ser texto si se envia.",
              );
            }
            break;
          case "transfer":
            if (!details.reference || typeof details.reference !== "string") {
              errors.push(
                "Para transferencia, el numero de referencia es requerido.",
              );
            }
            break;
          case "paypal":
            if (
              !details.email ||
              typeof details.email !== "string" ||
              !details.email.includes("@")
            ) {
              errors.push("Para PayPal, se requiere un email valido.");
            }
            break;
          default:
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
