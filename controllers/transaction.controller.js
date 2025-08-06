const mongoose = require("mongoose");
const Decimal = require("decimal.js");
const {
  orderModel,
  transactionModel,
  invoiceModel,
  itemModel,
  discountModel,
  userModel,
  shippingMethodModel,
} = require("../models/index");
const PaymentSimulator = require("../middlewares/paymentSimulator");
const { encryptData } = require("../utils/security");

/**
 * Valida los datos de entrada de la transacción
 * @param {Object} data - Datos de la transacción
 * @throws {Error} Si los datos son inválidos
 */
const validateTransactionData = (data) => {
  const errors = [];

  // Validar cliente
  if (!data.customer || typeof data.customer !== "object") {
    errors.push("Falta información del cliente.");
  } else {
    if (!data.customer.name || typeof data.customer.name !== "string") {
      errors.push("Nombre del cliente es requerido.");
    }
    if (!data.customer.email || typeof data.customer.email !== "string") {
      errors.push("Email del cliente es requerido.");
    }
    if (!data.customer.phone || typeof data.customer.phone !== "string") {
      errors.push("Teléfono del cliente es requerido.");
    }
    if (!data.customer.userId || typeof data.customer.userId !== "string") {
      errors.push("ID del usuario es requerido.");
    }
  }

  // Validar orden
  if (!data.order || typeof data.order !== "object") {
    errors.push("Falta la información del pedido.");
  } else {
    // Validar items
    if (!Array.isArray(data.order.items) || data.order.items.length === 0) {
      errors.push("Debe incluir al menos un producto en el pedido.");
    } else {
      data.order.items.forEach((item, index) => {
        if (!item.productId || typeof item.productId !== "string") {
          errors.push(`El item ${index + 1} no tiene productId válido.`);
        }
        if (!item.variantId || typeof item.variantId !== "string") {
          errors.push(`El item ${index + 1} no tiene variantId válido.`);
        }
        if (typeof item.price !== "number" || item.price <= 0) {
          errors.push(`El item ${index + 1} tiene un precio inválido.`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          errors.push(`El item ${index + 1} tiene una cantidad inválida.`);
        }
      });
    }

    // Validar shipping
    if (!data.order.shipping || typeof data.order.shipping !== "object") {
      errors.push("Falta la información de envío.");
    } else {
      if (
        !data.order.shipping.methodId ||
        typeof data.order.shipping.methodId !== "string"
      ) {
        errors.push("ID del método de envío es requerido.");
      }

      const addr = data.order.shipping.address;
      if (!addr || typeof addr !== "object") {
        errors.push("Dirección de envío inválida.");
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
            errors.push(`Campo de dirección '${field}' es requerido.`);
          }
        });
      }

      if (
        typeof data.order.shipping.cost !== "number" ||
        data.order.shipping.cost < 0
      ) {
        errors.push("El costo de envío debe ser un número mayor o igual a 0.");
      }
    }
  }

  // Validar método de pago (versión mejorada)
  if (!data.payment || typeof data.payment !== "object") {
    errors.push("Falta la información de pago.");
  } else {
    const validMethods = ["credit-card", "credits", "transfer", "paypal"];
    const method = data.payment.method;

    if (!method || typeof method !== "string") {
      errors.push("El método de pago es requerido.");
    } else if (!validMethods.includes(method)) {
      errors.push(`Método de pago '${method}' no es válido. Métodos aceptados: ${validMethods.join(", ")}`);
    }

    // Validación específica por método de pago
    if (method && validMethods.includes(method)) {
      const details = data.payment.details || {};
      
      if (!details || typeof details !== "object") {
        errors.push("Detalles del pago son requeridos.");
      } else {
        switch (method) {
          case "credit-card":
            ["cardNumber", "expiry", "cvc", "cardholderName"].forEach(field => {
              if (!details[field] || typeof details[field] !== "string") {
                errors.push(`Para tarjeta de crédito, el campo '${field}' es requerido.`);
              }
            });
            break;
            
          case "credits":
            if (!details.userId || typeof details.userId !== "string") {
              errors.push("Para pago con créditos, el ID de usuario es requerido.");
            }
            break;
            
          case "transfer":
            if (!details.reference || typeof details.reference !== "string") {
              errors.push("Para transferencia, el número de referencia es requerido.");
            }
            break;
            
          case "paypal":
            if (!details.email || typeof details.email !== "string" || !details.email.includes("@")) {
              errors.push("Para PayPal, se requiere un email válido.");
            }
            break;
        }
      }
    }
  }

  return errors;
};

/**
 * Procesa una transacción completa
 * @param {Object} req - Objeto de solicitud HTTP
 * @param {Object} res - Objeto de respuesta HTTP
 */
const processTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transactionData = req.body;

    // 1. Validación de datos
    const validationErrors = validateTransactionData(transactionData);
    if (validationErrors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: validationErrors.join(" "),
        errorType: "validation_error"
      });
    }

    // 2. Calcular costo de envío
    const shippingCost = await calculateShippingCost(
      transactionData.order.shipping.methodId,
      session
    );

    // 3. Validar productos y aplicar descuentos
    const {
      itemsWithPrices,
      discountAmount,
      discountPercentage,
      discountMessage,
      discountedSubtotal
    } = await validateAndPriceItems(
      transactionData.order.items,
      transactionData.discountCode,
      session
    );

    // 4. Calcular impuestos y total
    const taxRate = 0.12;
    const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
    const total = Math.round((discountedSubtotal + tax + shippingCost) * 100) / 100;

    // 5. Validar créditos si aplica
    if (transactionData.payment.method === "credits") {
      await validateUserCredits(
        transactionData.customer.userId,
        total,
        session
      );
    }

    // 6. Procesar pago
    const paymentResult = await processPayment(
      transactionData.payment,
      total,
      session
    );

    if (!paymentResult.success) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: paymentResult.error || "Pago fallido",
        paymentStatus: paymentResult.errorCode,
        errorType: "payment_failed"
      });
    }

    // 7. Descontar créditos si aplica
    if (paymentResult.success && transactionData.payment.method === "credits") {
      await userModel.findByIdAndUpdate(
        transactionData.customer.userId,
        { $inc: { credits: -total } },
        { session }
      );
    }

    // 8. Crear orden
    const order = await createOrder({
      items: itemsWithPrices,
      customer: transactionData.customer,
      discountAmount,
      subtotal: discountedSubtotal,
      tax,
      total,
      shipping: {
        methodId: transactionData.order.shipping.methodId,
        address: transactionData.order.shipping.address,
        cost: shippingCost
      },
      payment: transactionData.payment,
      status: paymentResult.success ? "processing" : "failed",
      session
    });

    // 9. Crear transacción
    const transaction = await createTransaction(
      order._id,
      transactionData.payment,
      paymentResult,
      total,
      { session }
    );

    // 10. Actualizar stock
    if (paymentResult.success) {
      await updateStock(itemsWithPrices, session);

      if (transactionData.payment.method === "credits") {
        await updateUserCredits(
          transactionData.customer.userId,
          total,
          session
        );
      }
    }

    // 11. Crear factura
    const invoice = await createInvoice(
      order,
      transaction,
      paymentResult.success ? "paid" : "failed",
      discountPercentage,
      session
    );

    await session.commitTransaction();

    // 12. Respuesta exitosa
    return res.json({
      success: true,
      orderId: order._id,
      transactionId: transaction._id,
      invoiceId: invoice._id,
      total: total.toFixed(2),
      discountApplied: discountAmount,
      discountMessage: discountMessage || null,
      paymentStatus: paymentResult.success ? "completed" : "failed",
      ...(transactionData.payment.method === "credits" && {
        remainingCredits: await getUserCredits(
          transactionData.customer.userId,
          session
        )
      })
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Transaction Error:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    return res.status(400).json({
      success: false,
      error: error.message,
      errorType: "transaction_failed",
      ...(error.code && { errorCode: error.code })
    });
  } finally {
    session.endSession();
  }
};


// ==================== FUNCIONES AUXILIARES ====================

/**
 * Valida y calcula precios de los items con descuentos
 * @param {Array} items - Items de la transacción
 * @param {String} discountCode - Código de descuento
 * @param {Object} session - Sesión de MongoDB
 * @returns {Object} Objeto con items validados y monto de descuento
 */
const validateAndPriceItems = async (items, discountCode, session) => {
  try {
    console.log("[validateAndPriceItems] Inicio del proceso");
    console.log("[Input] items:", JSON.stringify(items, null, 2));
    console.log("[Input] discountCode:", discountCode);

    // 1. Validación básica de items
    if (!Array.isArray(items)) {
      throw new Error("Formato de items inválido: debe ser un array");
    }
    if (items.length === 0) {
      throw new Error("No hay productos en el carrito");
    }

    // 2. Validar estructura de cada item
    items.forEach((item, index) => {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        throw new Error(`Item ${index + 1}: ID de producto inválido`);
      }
      if (!mongoose.Types.ObjectId.isValid(item.variantId)) {
        throw new Error(`Item ${index + 1}: ID de variante inválido`);
      }
      if (typeof item.price !== "number" || item.price <= 0) {
        throw new Error(`Item ${index + 1}: Precio inválido (${item.price})`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(
          `Item ${index + 1}: Cantidad inválida (${item.quantity})`
        );
      }
    });

    // 3. Obtener información completa de los productos
    const productIds = items.map(
      (item) => new mongoose.Types.ObjectId(item.productId)
    );
    const products = await itemModel
      .find(
        { _id: { $in: productIds } },
        { nameProduct: 1, value: 1, banner: 1 },
        { session, lock: true }
      )
      .session(session);

    // 4. Validar stock de variantes
    items.forEach((item, index) => {
      const product = products.find((p) => p._id.equals(item.productId));
      if (!product) {
        throw new Error(`Producto ${item.productId} no encontrado`);
      }

      const variant = product.value.find((v) => v._id.equals(item.variantId));
      if (!variant) {
        throw new Error(
          `Variante ${item.variantId} no encontrada en el producto ${product.nameProduct}`
        );
      }

      if (variant.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para ${product.nameProduct} (${variant.size}) ` +
            `(Solicitado: ${item.quantity}, Disponible: ${variant.stock})`
        );
      }

      // Validar que el precio enviado coincida con el precio de la variante
      if (item.price !== variant.originalPrice && item.price !== variant.discountPrice) {
        throw new Error(
          `El precio del item ${index + 1} no coincide con el precio del producto`
        );
      }
    });

    // 5. Calcular subtotal temporal para validaciones (sin descuento)
    const tempSubtotal = items.reduce((total, item) => {
      const itemTotal = new Decimal(item.price).times(item.quantity);
      return new Decimal(total).plus(itemTotal).toNumber();
    }, 0);

    // 6. Procesar descuento
    const discountResult = await processDiscount(
      discountCode,
      tempSubtotal,
      session
    );

    if (discountCode && !discountResult.valid) {
      throw new Error(discountResult.message);
    }

    // 7. Procesar cada item con el descuento aplicado
    const itemsWithPrices = await Promise.all(
      items.map(async (item) => {
        const product = products.find((p) => p._id.equals(item.productId));
        const variant = product.value.find((v) => v._id.equals(item.variantId));

        let finalPrice = new Decimal(item.price);

        if (discountResult.valid && discountResult.type === "percentage") {
          finalPrice = finalPrice.times(1 - discountResult.percentage);
        }

        const precioFinal = parseFloat(
          finalPrice.toDecimalPlaces(2).toNumber()
        );

        return {
          productId: product._id,
          variantId: variant._id,
          name: product.nameProduct,
          variantName: variant.size,
          price: precioFinal,
          originalPrice: item.price,
          quantity: item.quantity,
          image: product.banner || null,
          stock: variant.stock,
          itemDiscount:
            discountResult.valid && discountResult.type === "percentage"
              ? discountResult.percentage * 100
              : 0,
        };
      })
    );

    // 8. Calcular descuento fijo si aplica
    let discountAmount = 0;
    if (discountResult.valid) {
      if (discountResult.type === "fixed") {
        discountAmount = Math.min(discountResult.amount, tempSubtotal);
      } else if (discountResult.type === "percentage") {
        discountAmount = tempSubtotal * discountResult.percentage;
      }
    }

    // 9. Calcular subtotal con descuentos aplicados
    const discountedSubtotal = itemsWithPrices.reduce((sum, item) => {
      return new Decimal(sum)
        .plus(new Decimal(item.price).times(item.quantity))
        .toNumber();
    }, 0);

    // 10. Preparar respuesta final
    const result = {
      itemsWithPrices,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      discountPercentage:
        discountResult.valid && discountResult.type === "percentage"
          ? discountResult.percentage * 100
          : 0,
      discountMessage: discountResult.message,
      originalSubtotal: parseFloat(tempSubtotal.toFixed(2)),
      discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
      discountType: discountResult.type,
    };

    console.log("[Resultado final]", JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("[Error en validateAndPriceItems]", error);
    throw new Error(`Error al validar productos: ${error.message}`);
  }
};

/**
 * Obtiene el monto de descuento para un código
 * @param {String} code - Código de descuento
 * @param {Number} subtotal - Subtotal de la compra
 * @param {Object} session - Sesión de MongoDB
 * @returns {Object} Objeto con información del descuento
 */
const getDiscountAmount = async (code, subtotal, session) => {
  const noDiscount = {
    amount: 0,
    valid: true,
    message: "No se aplicó descuento",
    type: "none",
  };

  if (!code || typeof code !== "string") return noDiscount;

  try {
    subtotal = Number(subtotal) || 0;
    if (isNaN(subtotal)) {
      return {
        ...noDiscount,
        valid: false,
        message: "Subtotal inválido para aplicar descuento",
        type: "invalid",
      };
    }

    const discount = await discountModel
      .findOne({
        code: code.trim(),
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .session(session);

    if (!discount) {
      return {
        ...noDiscount,
        valid: false,
        message: "Código de descuento no encontrado o expirado",
        type: "invalid",
      };
    }

    if (!["percentage", "fixed"].includes(discount.type)) {
      return {
        ...noDiscount,
        valid: false,
        message: "Tipo de descuento no soportado",
        type: "invalid",
      };
    }

    const discountValue = Number(discount.amount);
    if (isNaN(discountValue) || discountValue <= 0) {
      return {
        ...noDiscount,
        valid: false,
        message: "Valor de descuento inválido",
        type: "invalid",
      };
    }

    const minPurchase = Number(discount.minPurchase) || 0;
    if (subtotal < minPurchase) {
      return {
        ...noDiscount,
        valid: false,
        message: `Requieres al menos $${minPurchase.toFixed(
          2
        )} para este descuento`,
        type: discount.type,
      };
    }

    if (
      discount.type === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return {
        ...noDiscount,
        valid: false,
        message: "El porcentaje de descuento debe estar entre 0% y 100%",
        type: "invalid",
      };
    }

    let amount;
    if (discount.type === "percentage") {
      amount = subtotal * (discountValue / 100);
    } else {
      amount = Math.min(discountValue, subtotal);
    }

    return {
      amount,
      type: discount.type,
      valid: true,
      message: `Descuento ${
        discount.type === "percentage"
          ? `${discountValue}%`
          : `$${discountValue.toFixed(2)}`
      } aplicado`,
      code: discount.code,
    };
  } catch (error) {
    console.error("Error en getDiscountAmount:", {
      error: error.message,
      code,
      subtotal,
      timestamp: new Date().toISOString(),
    });
    return {
      ...noDiscount,
      valid: false,
      message: "Error al procesar descuento",
      type: "error",
    };
  }
};

/**
 * Procesa y valida un código de descuento
 * @param {String} code - Código de descuento
 * @param {Number} subtotal - Subtotal de la compra
 * @param {Object} session - Sesión de MongoDB
 * @returns {Object} Información del descuento
 */
const processDiscount = async (code, subtotal, session) => {
  const defaultResponse = {
    valid: false,
    amount: 0,
    percentage: 0,
    type: null,
    message: "No se aplicó descuento",
  };

  console.log("[processDiscount] Inicio", { code, subtotal });

  // Si no hay código, retornar sin descuento
  if (!code || typeof code !== "string" || code.trim() === "") {
    console.log("[processDiscount] No hay código de descuento");
    return { ...defaultResponse, valid: true };
  }

  try {
    console.log(
      "[processDiscount] Buscando descuento en DB:",
      code.trim().toUpperCase()
    );
    const discount = await discountModel
      .findOne({
        code: code.trim().toUpperCase(),
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .session(session);

    if (!discount) {
      console.log("[processDiscount] Descuento no encontrado o expirado");
      return {
        ...defaultResponse,
        message: "Código de descuento no válido o expirado",
      };
    }

    console.log("[processDiscount] Descuento encontrado:", {
      type: discount.type,
      amount: discount.amount,
      minPurchase: discount.minPurchase,
      expiresAt: discount.expiresAt,
    });

    // Validar mínimo de compra
    const minPurchase = discount.minPurchase || 0;
    console.log("[processDiscount] Validando mínimo de compra:", {
      subtotal,
      minPurchase,
      cumple: subtotal >= minPurchase,
    });

    if (subtotal < minPurchase) {
      return {
        ...defaultResponse,
        message: `Mínimo de compra no alcanzado ($${minPurchase.toFixed(2)})`,
      };
    }

    // Validar valor del descuento
    if (typeof discount.amount !== "number" || isNaN(discount.amount)) {
      console.error(
        "[processDiscount] Valor de descuento inválido:",
        discount.amount
      );
      return {
        ...defaultResponse,
        message: "Configuración de descuento inválida",
      };
    }

    let amount = 0;
    let percentage = 0;

    if (discount.type === "percentage") {
      percentage = discount.amount;
      amount = subtotal * percentage;
      console.log("[processDiscount] Descuento porcentual calculado:", {
        percentage,
        amount,
        dbAmount: discount.amount,
      });
    } else if (discount.type === "fixed") {
      if (discount.amount < 0) {
        console.error(
          "[processDiscount] Monto fijo negativo:",
          discount.amount
        );
        return {
          ...defaultResponse,
          message: "El monto de descuento no puede ser negativo",
        };
      }
      amount = Math.min(discount.amount, subtotal);
      console.log("[processDiscount] Descuento fijo aplicado:", amount);
    } else {
      console.error(
        "[processDiscount] Tipo de descuento no soportado:",
        discount.type
      );
      return {
        ...defaultResponse,
        message: "Tipo de descuento no soportado",
      };
    }

    // Redondear a 2 decimales
    amount = parseFloat(amount.toFixed(2));

    const result = {
      valid: true,
      amount,
      percentage,
      type: discount.type,
      message: `Descuento ${
        discount.type === "percentage"
          ? `${discount.amount * 100}%`
          : `$${discount.amount.toFixed(2)}`
      } aplicado`,
      code: discount.code,
    };

    console.log("[processDiscount] Resultado final:", result);
    return result;
  } catch (error) {
    console.error("[processDiscount] Error:", {
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

/**
 * Calcula el costo de envío
 * @param {String} methodId - ID del método de envío
 * @param {Object} session - Sesión de MongoDB
 * @returns {Number} Costo de envío
 */
const calculateShippingCost = async (methodId, session) => {
  if (!methodId) return 0;

  try {
    const method = await shippingMethodModel
      .findById(methodId)
      .session(session);
    if (!method) throw new Error("Método de envío no encontrado");
    return method.costo || 0;
  } catch (error) {
    console.error("Error en calculateShippingCost:", error);
    throw new Error("Error al calcular envío");
  }
};

/**
 * Crea una nueva orden
 * @param {Object} params - Parámetros para crear la orden
 * @param {Array} params.items - Items de la orden
 * @param {Object} params.customer - Información del cliente
 * @param {Number} params.discountAmount - Monto de descuento aplicado
 * @param {Number} params.subtotal - Subtotal de la orden
 * @param {Number} params.tax - Impuestos calculados
 * @param {Number} params.total - Total de la orden
 * @param {Object} params.shipping - Información de envío
 * @param {Object} params.payment - Información de pago
 * @param {Object} params.session - Sesión de MongoDB
 * @returns {Object} Orden creada
 */
const createOrder = async ({
  items,
  customer,
  discountAmount,
  subtotal,
  tax,
  total,
  shipping,
  payment,
  session,
}) => {
  try {
    if (!shipping) {
      throw new Error("Se requiere la información de envío");
    }

    if (!shipping.address) {
      throw new Error("La dirección de envío es requerida");
    }

    const requiredAddressFields = ["provincia", "canton", "callePrincipal"];
    const missingFields = requiredAddressFields.filter(
      (field) => !shipping.address[field]
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Faltan campos requeridos en la dirección: ${missingFields.join(", ")}`
      );
    }

    const orderItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name || `Producto ${item.productId}`,
      variantName: item.variantName || "",
      price: item.price,
      quantity: item.quantity,
      image: item.image || null,
    }));

    const order = new orderModel({
      userId: customer.userId,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      products: orderItems,
      subtotal,
      tax,
      shippingCost: shipping.cost,
      discountAmount: discountAmount || 0,
      total,
      paymentMethod: payment.method,
      shippingMethod: shipping.methodId,
      shippingAddress: {
        provincia: shipping.address.provincia,
        canton: shipping.address.canton,
        callePrincipal: shipping.address.callePrincipal,
        ...(shipping.address.parroquia && {
          parroquia: shipping.address.parroquia,
        }),
        ...(shipping.address.numeroCasa && {
          numeroCasa: shipping.address.numeroCasa,
        }),
        ...(shipping.address.referencia && {
          referencia: shipping.address.referencia,
        }),
        codigoPostal: shipping.address.codigoPostal || "",
      },
      status: "pending",
      ...(payment.details && { paymentDetails: payment.details }),
    });

    const savedOrder = await order.save({ session });
    return savedOrder;
  } catch (error) {
    console.error("Error al crear la orden:", error);
    throw new Error(`Error al crear la orden: ${error.message}`);
  }
};

/**
 * Procesa el pago según el método seleccionado
 * @param {Object} paymentData - Datos de pago
 * @param {Number} amount - Monto a pagar
 * @param {Object} session - Sesión de MongoDB
 * @returns {Object} Resultado del procesamiento de pago
 */
const processPayment = async (paymentData, amount, session) => {
  try {
    const handlers = {
      "credit-card": async () => {
        if (!paymentData.details)
          throw new Error("Detalles de tarjeta requeridos");
        return PaymentSimulator.processCreditCard(paymentData.details, amount);
      },
      credits: async () => {
        // Validación adicional para créditos
        if (!paymentData.details?.userId) {
          throw new Error("ID de usuario requerido para pago con créditos");
        }
        
        // Verificar saldo del usuario con la sesión actual
        const user = await userModel.findById(paymentData.details.userId).session(session);
        if (!user) {
          throw new Error("Usuario no encontrado");
        }
        
        if (user.credits < amount) {
          throw new Error(`Créditos insuficientes. Disponibles: ${user.credits}, Requeridos: ${amount}`);
        }
        
        // Procesar el pago con créditos
        return PaymentSimulator.processCredits(
          paymentData.details.userId, 
          amount,
          session // Pasar la sesión al simulador
        );
      },
      transfer: async () => ({
        success: true,
        status: "pending",
        message: "Esperando confirmación de transferencia",
      }),
      paypal: async () => {
        return PaymentSimulator.processPayPal(amount);
      },
    };

    const handler = handlers[paymentData.method];
    if (!handler) throw new Error("Método de pago no soportado");

    const result = await handler();
    if (!result) {
      throw new Error("No se recibió respuesta del procesador de pagos");
    }

    return result;
  } catch (error) {
    console.error("Error en processPayment:", {
      error: error.message,
      stack: error.stack,
      paymentMethod: paymentData?.method,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      status: "failed",
      message: error.message,
      errorCode: error.errorCode || "PAYMENT_ERROR"
    };
  }
};

/**
 * Crea una transacción en la base de datos
 * @param {String} orderId - ID de la orden asociada
 * @param {Object} paymentData - Datos de pago
 * @param {Object} paymentResult - Resultado del procesamiento de pago
 * @param {Number} amount - Monto de la transacción
 * @param {Object} options - Opciones adicionales (session)
 * @returns {Object} Transacción creada
 */
const createTransaction = async (
  orderId,
  paymentData,
  paymentResult,
  amount,
  options = {}
) => {
  try {
    const status =
      paymentResult.status || (paymentResult.success ? "completed" : "failed");

    const transaction = new transactionModel({
      orderId,
      method: paymentData.method,
      amount,
      status,
      gatewayTransactionId: paymentResult.transactionId,
      history: [
        {
          status,
          timestamp: new Date(),
          message: paymentResult.message || `Pago ${status}`,
        },
      ],
      ...(paymentResult.error && {
        errorMessage: paymentResult.error,
        errorCode: paymentResult.errorCode,
      }),
    });

    return await transaction.save(options);
  } catch (error) {
    console.error("Error en createTransaction:", error);
    throw new Error("Error al crear la transacción");
  }
};

/**
 * Actualiza el estado de una orden
 * @param {String} orderId - ID de la orden
 * @param {String} status - Nuevo estado
 * @param {Object} session - Sesión de MongoDB
 */
const updateOrderStatus = async (orderId, status, session) => {
  try {
    await orderModel.findByIdAndUpdate(orderId, { status }, { session });
  } catch (error) {
    console.error("Error en updateOrderStatus:", error);
    throw new Error("Error al actualizar estado de la orden");
  }
};

/**
 * Crea una factura
 * @param {Object} order - Orden asociada
 * @param {Object} transaction - Transacción asociada
 * @param {String} status - Estado de la factura
 * @param {Object} session - Sesión de MongoDB
 * @returns {Object} Factura creada
 */
const createInvoice = async (
  order,
  transaction,
  status,
  discountPercentage,
  session
) => {
  try {
    console.log("[createInvoice] Inicio del proceso");
    console.log("[Input] order:", {
      products: order.products.map((p) => ({
        productId: p.productId,
        variantId: p.variantId,
        price: p.price,
        quantity: p.quantity,
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
    });

    // Calcular subtotal original usando el discountPercentage
    const originalSubtotal = order.products.reduce((sum, item) => {
      const priceWithDiscount = Number(item.price);
      const originalPrice = discountPercentage
        ? priceWithDiscount / (1 - discountPercentage / 100)
        : priceWithDiscount;
      const itemTotal = originalPrice * item.quantity;
      console.log(
        `[Item ${item.productId}] Original: ${originalPrice} x ${item.quantity} = ${itemTotal}`
      );
      return sum + itemTotal;
    }, 0);

    console.log("[originalSubtotal calculado]", originalSubtotal);

    // Validación adicional
    if (isNaN(originalSubtotal)) {
      throw new Error("El subtotal original no es un número válido");
    }

    // Crear la factura
    const invoiceData = {
      orderId: order._id,
      transactionId: transaction._id,
      items: order.products.map((item) => ({
        product: item.productId,
        variant: item.variantId,
        name: item.name,
        variantName: item.variantName,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      shippingCost: order.shippingCost,
      discount: order.discountAmount,
      discountPercentage: discountPercentage || 0,
      originalSubtotal: originalSubtotal,
      total: order.total,
      status,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      companyDetails: {
        name: "Mi Tienda",
        address: "Av. Principal 123",
        phone: "0999999999",
        email: "ventas@mitienda.com",
        logoUrl: "../../storage/logo.svg",
      },
    };

    const invoice = new invoiceModel(invoiceData);
    const savedInvoice = await invoice.save({ session });
    return savedInvoice;
  } catch (error) {
    console.error("[Error en createInvoice]", error);
    throw error;
  }
};

/**
 * Actualiza el stock de productos
 * @param {Array} items - Items con cantidades vendidas
 * @param {Object} session - Sesión de MongoDB
 */
const updateStock = async (items, session) => {
  try {
    const updates = items.map((item) => ({
      updateOne: {
        filter: { 
          "_id": item.productId,
          "value._id": item.variantId
        },
        update: {
          $inc: {
            "value.$.stock": -item.quantity,
            "value.$.nventas": item.quantity,
            "nventas": item.quantity // Si también quieres llevar un total en el producto padre
          }
        }
      }
    }));

    await itemModel.bulkWrite(updates, { session });
  } catch (error) {
    console.error("Error en updateStock:", error);
    throw new Error("Error al actualizar el stock");
  }
};

/**
 * Valida que el usuario tenga créditos suficientes
 * @param {String} userId - ID del usuario
 * @param {Number} amount - Monto requerido
 * @param {Object} session - Sesión de MongoDB
 */
const validateUserCredits = async (userId, amount, session) => {
  try {
    const user = await userModel.findById(userId).session(session);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.credits < amount) {
      throw new Error("Créditos insuficientes");
    }
  } catch (error) {
    console.error("Error en validateUserCredits:", error);
    throw new Error("Error al validar créditos del usuario");
  }
};

/**
 * Actualiza los créditos de un usuario
 * @param {String} userId - ID del usuario
 * @param {Number} amount - Monto a descontar
 * @param {Object} session - Sesión de MongoDB
 */
const updateUserCredits = async (userId, amount, session) => {
  try {
    await userModel.findByIdAndUpdate(
      userId,
      { $inc: { credits: -amount } },
      { session }
    );
  } catch (error) {
    console.error("Error en updateUserCredits:", error);
    throw new Error("Error al actualizar créditos del usuario");
  }
};


/**
 * Obtiene los créditos actuales de un usuario
 * @param {String} userId - ID del usuario
 * @param {Object} session - Sesión de MongoDB
 * @returns {Number} Créditos disponibles
 */
const getUserCredits = async (userId, session) => {
  try {
    const user = await userModel
      .findById(userId)
      .session(session)
      .select("credits");
    return user?.credits || 0;
  } catch (error) {
    console.error("Error en getUserCredits:", error);
    return 0;
  }
};

// Funciones de cálculo
const calculateSubtotal = (items) => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

const calculateTax = (subtotal, shipping) => {
  return new Decimal(subtotal)
    .plus(new Decimal(shipping))
    .times(0.12)
    .toNumber();
};

const calculateTotal = (subtotal, tax, shipping, discount = 0) => {
  return new Decimal(subtotal)
    .plus(new Decimal(tax))
    .plus(new Decimal(shipping))
    .minus(new Decimal(discount))
    .toNumber();
};

module.exports = {
  processTransaction,
};
