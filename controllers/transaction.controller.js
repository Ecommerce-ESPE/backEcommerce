const Decimal = require('decimal.js');
const { facturaModel, itemModel, discountModel } = require('../models');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const PaymentSimulator = require('../middlewares/paymentSimulator');
const mongoose = require('mongoose');
const path = require('path');

// Procesar transacción completa
const processTransaction = async (req, res) => {
  const transactionData = req.body;

  try {
    const validationError = validateTransactionData(transactionData);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const { invoice } = await createInvoiceAndUpdateStock(transactionData);

    let paymentResult;
    if (transactionData.payment.method === 'credit-card') {
      const { cardNumber, expiry, cvc } = transactionData.payment.details;
      const [expMonth, expYear] = expiry.split('/');

      paymentResult = await PaymentSimulator.processPayment({
        cardNumber,
        expMonth,
        expYear,
        cvc,
        amount: invoice.total,
        currency: 'USD'
      });
    } else if (transactionData.payment.method === 'credits') {
      if (transactionData.customer.credits < invoice.total) {
        throw new Error('Créditos insuficientes');
      }
      paymentResult = { success: true };
    } else {
      paymentResult = { success: true };
    }

    const pdfBuffer = await generateInvoicePDF(invoice.toObject(), transactionData.customer, invoice.companyDetails);

    res.json({
      success: true,
      transactionId: paymentResult.transactionId || null,
      invoiceId: invoice._id,
      total: invoice.total,
      pdfUrl: `/invoices/${invoice._id}.pdf`
    });

  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

const validateTransactionData = (data) => {
  if (!data.customer || !data.customer.email) return 'Datos de cliente inválidos';
  if (!data.items || data.items.length === 0) return 'El carrito está vacío';
  if (!data.payment || !data.payment.method) return 'Método de pago no especificado';
  if (!data.shipping || !data.shipping.method) return 'Método de envío no especificado';
  return null;
};

const createInvoiceAndUpdateStock = async (transactionData) => {
  const productIds = transactionData.items.map(item => item.productId).filter(id => mongoose.Types.ObjectId.isValid(id));
  const items = await itemModel.find({ _id: { $in: productIds } });

  if (items.length !== productIds.length) {
    throw new Error('Algunos productos no fueron encontrados');
  }

  const productMap = items.reduce((map, product) => {
    map[product._id.toString()] = product;
    return map;
  }, {});

  let subtotalProducts = new Decimal(0);
  const invoiceItems = [];
  const stockUpdates = [];

  const safeDecimal = (value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error(`Valor numérico inválido: ${value}`);
    return new Decimal(num);
  };

  for (const cartItem of transactionData.items) {
    const productId = cartItem.productId;
    const product = productMap[productId];

    if (!product) throw new Error(`Producto no encontrado para ID: ${productId}`);

    const price = safeDecimal(cartItem.price);
    const quantity = Number(cartItem.quantity);
    const itemTotal = price.times(quantity);
    subtotalProducts = subtotalProducts.plus(itemTotal);

    invoiceItems.push({
      product: new mongoose.Types.ObjectId(productId),
      name: product.nameProduct,
      price: price.toNumber(),
      quantity: quantity,
      total: itemTotal.toNumber()
    });

    if (product.stock < quantity) {
      throw new Error(`Stock insuficiente para ${product.nameProduct}`);
    }

    stockUpdates.push({
      updateOne: {
        filter: { _id: productId },
        update: { $inc: { stock: -quantity } }
      }
    });
  }

  const shippingCost = safeDecimal(transactionData.shipping?.method?.costo ?? 0);
  const taxRate = safeDecimal(0.12);
  
  // Calcular impuestos sobre (productos + envío)
  const taxAmount = subtotalProducts.plus(shippingCost).times(taxRate);
  
  // Calcular total antes de descuento
  let total = subtotalProducts.plus(shippingCost).plus(taxAmount);

  let discountAmount = new Decimal(0);
  if (transactionData.discountCode) {
    const discount = await discountModel.findOne({
      code: transactionData.discountCode,
      isValid: true,
      expiresAt: { $gt: new Date() }
    });

    if (discount) {
      discountAmount = Decimal.min(safeDecimal(discount.amount), total);
      total = total.minus(discountAmount);
    }
  }

  const companyDetails = {
    name: 'Createx Shop',
    address: 'Av. Moran Valverde, S142-54',
    phone: '098521856226',
    email: 'ventas@createx.com',
    logoUrl: path.join(__dirname, '..', 'storage', 'logo.png')
  };

  const invoice = new facturaModel({
    cliente: new mongoose.Types.ObjectId(transactionData.customer._id),
    items: invoiceItems,
    subtotal: subtotalProducts.toNumber(),
    shippingCost: shippingCost.toNumber(),
    tax: taxAmount.toNumber(),
    discount: discountAmount.toNumber(),
    total: total.toNumber(),
    methodPay: transactionData.payment.method,
    nItems: transactionData.items.length,
    companyDetails: companyDetails,
    shipping: transactionData.shipping
  });

  const [savedInvoice] = await Promise.all([
    invoice.save(),
    itemModel.bulkWrite(stockUpdates)
  ]);

  return { invoice: savedInvoice };
};

const generateInvoicePDF = (factura, cliente, company) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Calcular valores desde la factura
    const subtotalProducts = factura.subtotal || 0;
    const shippingCostValue = factura.shippingCost || 0;
    const taxValue = factura.tax || 0;
    const discountValue = factura.discount || 0;
    const totalValue = factura.total || 0;

    // Encabezado con logo
    try {
      doc.image(company.logoUrl, 50, 45, { width: 80, height: 80 });
    } catch (e) {
      console.error('Error cargando logo:', e);
      doc.text('Logo no disponible', 50, 45);
    }
    
    // Información de la empresa
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(company.name, 350, 50, { align: 'right' })
       .font('Helvetica')
       .text(company.address, 350, 65, { align: 'right' })
       .text(`Tel: ${company.phone} | Email: ${company.email}`, 350, 80, { align: 'right' });
    
    // Título
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('FACTURA', 50, 150)
       .moveDown(0.5);
    
    // Detalles de factura
    doc.fontSize(10)
       .text(`Número: ${factura.factura_number || 'N/A'}`, 50, 200)
       .text(`Fecha: ${new Date(factura.createdAt).toLocaleDateString()}`, 50, 215)
       .text(`Vencimiento: ${new Date(factura.dueDate).toLocaleDateString()}`, 50, 230)
       .text(`Método de Pago: ${factura.methodPay?.toUpperCase() || 'N/A'}`, 50, 245)
       .moveDown(1);
    
    // Información del cliente
    const clientY = 280;
    doc.font('Helvetica-Bold').text('Cliente:', 50, clientY);
    doc.font('Helvetica')
       .text(cliente.name || 'N/A', 120, clientY)
       .text(cliente.email || 'N/A', 120, clientY + 15)
       .text(cliente.phone || 'N/A', 120, clientY + 30);
    
    // Información de envío
    const shippingY = clientY + 60;
    doc.font('Helvetica-Bold').text('Envío:', 50, shippingY);
    
    const shippingMethod = factura.shipping?.method || {};
    doc.font('Helvetica')
       .text(`Método: ${shippingMethod.descripcion || 'N/A'}`, 120, shippingY)
       .text(`Costo: $${shippingCostValue.toFixed(2)}`, 120, shippingY + 15)
       .text(`Entrega estimada: ${shippingMethod.fecha || 'N/A'}`, 120, shippingY + 30);
    
    const shippingAddress = factura.shipping?.address || {};
    doc.text(`Dirección: ${shippingAddress.directionPrincipal || 'N/A'} ${shippingAddress.nCasa || ''}`, 120, shippingY + 45)
       .text(`Código Postal: ${shippingAddress.codepostal || 'N/A'}`, 120, shippingY + 60)
       .text(`Teléfono: ${shippingAddress.telefono || 'N/A'}`, 120, shippingY + 75);
    
    // Tabla de productos
    const tableTop = shippingY + 110;
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('PRODUCTO', 50, tableTop)
       .text('PRECIO UNIT.', 300, tableTop)
       .text('CANTIDAD', 400, tableTop)
       .text('TOTAL', 500, tableTop);
    
    // Línea separadora
    doc.moveTo(50, tableTop + 20)
       .lineTo(550, tableTop + 20)
       .stroke();
    
    // Items de compra
    let y = tableTop + 30;
    factura.items?.forEach(item => {
      doc.font('Helvetica')
         .fontSize(10)
         .text(item.name || 'Producto no disponible', 50, y)
         .text(`$${(item.price || 0).toFixed(2)}`, 300, y)
         .text((item.quantity || 0).toString(), 400, y)
         .text(`$${(item.total || 0).toFixed(2)}`, 500, y);
      y += 20;
    });
    
    // Totales
    const totalY = y + 30;
    doc.fontSize(11)
       .text(`Subtotal productos: $${subtotalProducts.toFixed(2)}`, 350, totalY, { align: 'left', width: 200 })
       .text(`Costo de envío: $${shippingCostValue.toFixed(2)}`, 350, totalY + 20, { align: 'left', width: 200 })
       .text(`Subtotal: $${(subtotalProducts + shippingCostValue).toFixed(2)}`, 350, totalY + 40, { align: 'left', width: 200 })
       .text(`Impuestos (12%): $${taxValue.toFixed(2)}`, 350, totalY + 60, { align: 'left', width: 200 });
    
    if (discountValue > 0) {
      doc.text(`Descuento: -$${discountValue.toFixed(2)}`, 400, totalY + 80 , { align: 'left', width: 200 });
    }
    
    const totalPosition = discountValue > 0 ? totalY + 100 : totalY + 80;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(`TOTAL: $${totalValue.toFixed(2)}`, 400, totalPosition);
    
    // Pie de página
    doc.fontSize(8)
       .text('Gracias por su compra - Createx Shop © 2023', 50, 780, { align: 'center' });
    
    doc.end();
  });
};

const downloadInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await facturaModel.findById(invoiceId).populate('cliente');

    if (!invoice) return res.status(404).send('Factura no encontrada');

    const invoiceWithDetails = invoice.toObject();
    const pdfBuffer = await generateInvoicePDF(invoiceWithDetails, invoice.cliente, invoice.companyDetails);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${invoiceId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).send('Error al generar la factura: ' + error.message);
  }
};

module.exports = {
  processTransaction,
  downloadInvoice
};