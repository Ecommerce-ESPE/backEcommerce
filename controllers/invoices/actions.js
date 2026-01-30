const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
let QRCode;
try {
  QRCode = require("qrcode");
} catch (error) {
  QRCode = null;
}
const moment = require("moment-timezone");

const {
  orderModel,
  transactionModel,
  invoiceModel,
  itemModel,
  discountModel,
  userModel,
  shippingMethodModel,
} = require("../../models/index");

const getInvoicesAll = async (req, res) => {
  try {
    // Obtenemos todas las facturas con los datos relacionados
    const invoices = await invoiceModel
      .find()
      .populate({
        path: "orderId",
        populate: {
          path: "shippingMethod",
        },
      })
      .populate("transactionId");

    res.json({
      code: 200,
      ok: true,
      invoices,
    });
  } catch (error) {
    console.error("[getInvoicesAll] Error:", error);
    res.status(500).json({
      code: 500,
      ok: false,
      error: error.message,
    });
  }
};

const getInvoicesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    // Asumo que en order tienes el userId o cliente, si no, ajustar lógica
    const invoices = await invoiceModel
      .find()
      .populate({
        path: "orderId",
        match: { "customer.userId": customerId },
      })
      .populate("transactionId");

    // Filtrar los que no tienen order (porque populate falló)
    const filteredInvoices = invoices.filter((inv) => inv.orderId != null);

    res.json({
      code: 200,
      ok: true,
      invoices: filteredInvoices,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      ok: false,
      error: error.message,
    });
  }
};

const createInvoice = async (invoiceData) => {
  // Aquí recibes datos validados para crear la factura
  const invoice = new invoiceModel(invoiceData);
  return await invoice.save();
};

const generateInvoicePDF = async (req, res) => {
  try {
    const { id: invoiceId } = req.params;

    const invoice = await invoiceModel
      .findById(invoiceId)
      .populate({
        path: "orderId",
        populate: { path: "shippingMethod" },
      })
      .populate("transactionId");

    if (!invoice) {
      return res
        .status(404)
        .json({ ok: false, error: "Factura no encontrada" });
    }

    // Traducción estados
    const statusMap = {
      pending: "Pendiente",
      paid: "Pagado",
      processing: "Procesando",
      shipped: "Enviado",
      delivered: "Entregado",
      cancelled: "Cancelado",
      refunded: "Reembolsado",
      failed: "Fallido",
      ISSUED: "Emitida",
      VOID: "Anulada"
    };
    const estadoEnEspanol = statusMap[invoice.status] || invoice.status;

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const pdfPath = path.join(
      __dirname,
      "..",
      "temp",
      `factura_${invoice.invoiceNumber}.pdf`
    );

    if (!fs.existsSync(path.dirname(pdfPath))) {
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    }

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // --- HEADER con logo y datos empresa ---
    // Intentamos descargar el logo si es URL externa
    if (invoice.companyDetails.logoUrl) {
      try {
        const logoUrl = invoice.companyDetails.logoUrl;
        let logoPath = null;

        if (logoUrl.startsWith("http")) {
          // Descargar imagen temporal para logo
          const response = await axios.get(logoUrl, {
            responseType: "arraybuffer",
          });
          logoPath = path.join(
            __dirname,
            "..",
            "temp",
            `logo_${invoice.invoiceNumber}.png`
          );
          fs.writeFileSync(logoPath, response.data);
          doc.image(logoPath, 40, 40, { width: 100 });
          // Luego borramos la imagen temporal después de finalizar el PDF
        } else {
          // Logo local
          const logoLocalPath = path.resolve(
            __dirname,
            "..",
            invoice.companyDetails.logoUrl
          );
          if (fs.existsSync(logoLocalPath)) {
            doc.image(logoLocalPath, 40, 40, { width: 100 });
          }
        }
      } catch (e) {
        // No pasa nada si no se carga el logo
      }
    }

    // Datos empresa a la derecha del logo
    doc.fontSize(14).text(invoice.companyDetails.name, 150, 50);
    doc
      .fontSize(10)
      .text(invoice.companyDetails.address, 150, 70)
      .text(`Teléfono: ${invoice.companyDetails.phone}`, 150, 85)
      .text(`Email: ${invoice.companyDetails.email}`, 150, 100);

    // Línea separadora
    doc.moveTo(40, 130).lineTo(555, 130).stroke();

    // --- Datos factura y cliente ---
    doc.fontSize(16).text("Factura de Compra", 40, 140, { underline: true });
    const tz = process.env.TZ || "America/Guayaquil";
    const issuedAt = invoice.issuedAt || invoice.createdAt || new Date();
    const dueAt = invoice.dueDate || new Date();

    // Números y fechas
    doc
      .fontSize(10)
      .text(`Factura No.: ${invoice.invoiceNumber}`, 40, 170)
      .text(
        `Orden: ${invoice.orderNumber || invoice.orderId?.orderNumber || invoice.orderId?._id || "-"}`,
        40,
        180
      )
      .text(`Estado: ${estadoEnEspanol}`, 40, 195)
      .text(
        `Fecha emisión: ${moment(issuedAt).tz(tz).format("YYYY-MM-DD")}`,
        40,
        210
      )
      .text(
        `Fecha vencimiento: ${moment(dueAt).tz(tz).format("YYYY-MM-DD")}`,
        40,
        225
      );

    // Datos cliente
    doc.fontSize(12).text("Datos del Cliente:", 350, 170);
    doc
      .fontSize(10)
      .text(`Nombre: ${invoice.orderId?.customerName || "N/A"}`, 350, 185)
      .text(`Email: ${invoice.orderId?.customerEmail || "N/A"}`, 350, 200)
      .text(`Teléfono: ${invoice.orderId?.customerPhone || "N/A"}`, 350, 215);

    // Direccion de envio (solo si existe)
    const showShippingAddr = invoice?.showShippingAddress ?? true;
    const addr = invoice.orderId?.shippingAddress || null;
    if (showShippingAddr && addr && (addr.provincia || addr.canton || addr.callePrincipal)) {
      doc.fontSize(12).text("Direccion de Envio:", 350, 240);
      doc
        .fontSize(10)
        .text(`Provincia: ${addr.provincia || "-"}`, 350, 255)
        .text(`Canton: ${addr.canton || "-"}`, 350, 270)
        .text(`Parroquia: ${addr.parroquia || "-"}`, 350, 285)
        .text(`Calle: ${addr.callePrincipal || "-"}`, 350, 300)
        .text(`Numero: ${addr.numeroCasa || "-"}`, 350, 315)
        .text(`Codigo postal: ${addr.codigoPostal || "-"}`, 350, 330);
    }

    // Sucursal (informacion extra)
    const branch = invoice.branchSnapshot || {};
    const showBranchInfo = invoice?.showBranchInfo ?? true;
    if (showBranchInfo && (branch.name || branch.address || branch.establishmentCode || branch.emissionPoint)) {
      doc.fontSize(12).text("Sucursal:", 40, 240);
      doc
        .fontSize(10)
        .text(`Nombre: ${branch.name || "-"}`, 40, 255)
        .text(`Direccion: ${branch.address || "-"}`, 40, 270)
        .text(`Establecimiento: ${branch.establishmentCode || "-"}`, 40, 285)
        .text(`Punto emision: ${branch.emissionPoint || "-"}`, 40, 300);
    }

    doc.moveDown(2);

    // --- Tabla Productos ---
    doc.fontSize(12).text("Productos:", 40, 350);

    // Headers tabla
    const tableTop = 370;
    const itemX = 40;
    const qtyX = 280;
    const priceX = 340;
    const totalX = 430;
    const imageX = 500;
    const rowHeight = 70;

    doc.fontSize(10).text("Producto", itemX, tableTop);
    doc.text("Cantidad", qtyX, tableTop);
    doc.text("Precio Unitario", priceX, tableTop);
    doc.text("Total", totalX, tableTop);

    // Línea debajo de header
    doc
      .moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .stroke();

    let y = tableTop + 25;

    // Agregamos productos con imagenes
    for (const item of invoice.items) {
      // Producto y variante
      let productName = item.name;
      if (item.variantName) productName += ` (${item.variantName})`;

      doc.text(productName, itemX, y, { width: 220 });

      doc.text(item.quantity.toString(), qtyX, y);
      doc.text(`$${item.price.toFixed(2)}`, priceX, y);
      doc.text(`$${item.total.toFixed(2)}`, totalX, y);

      // Imagen del producto (si existe)
      // Intentamos obtener la imagen desde orderId.products para el mismo producto
      const prodFromOrder = invoice.orderId?.products?.find(
        (p) => p.name === item.name && p.price === item.price
      );
      if (prodFromOrder?.image) {
        try {
          // Descarga imagen remota
          const response = await axios.get(prodFromOrder.image, {
            responseType: "arraybuffer",
          });
          const imagePath = path.join(
            __dirname,
            "..",
            "temp",
            `prod_${invoice.invoiceNumber}_${item.product || "noid"}.jpg`
          );
          fs.writeFileSync(imagePath, response.data);

          doc.image(imagePath, imageX, y - 10, { width: 50, height: 50 });

          // Borramos la imagen al final del PDF
          fs.unlinkSync(imagePath);
        } catch (e) {
          // No mostramos imagen si falla
        }
      }

      y += rowHeight;
    }

    // --- Totales ---
    const totalsY = y + 10;
    doc
      .moveTo(350, totalsY - 5)
      .lineTo(555, totalsY - 5)
      .stroke();

    doc
      .fontSize(10)
      .text(`Subtotal:`, 400, totalsY)
      .text(`$${invoice.subtotal.toFixed(2)}`, 500, totalsY, {
        width: 50,
        align: "right",
      });

    doc
      .text(
        `Descuento (${invoice.discountPercentage || 0}%):`,
        400,
        totalsY + 15
      )
      .text(`-$${invoice.discount.toFixed(2)}`, 500, totalsY + 15, {
        width: 50,
        align: "right",
      });

    const ivaRate = invoice.taxBreakdown?.meta?.effectiveRateAtDate;
    const taxLabel = ivaRate !== undefined
      ? `Impuestos (IVA ${Number(ivaRate * 100).toFixed(0)}%):`
      : "Impuestos:";
    doc
      .text(taxLabel, 400, totalsY + 30)
      .text(`$${invoice.tax.toFixed(2)}`, 500, totalsY + 30, {
        width: 50,
        align: "right",
      });

    doc
      .text(`Costo de envío:`, 400, totalsY + 45)
      .text(`$${invoice.shippingCost.toFixed(2)}`, 500, totalsY + 45, {
        width: 50,
        align: "right",
      });

    doc.fontSize(14).text(`Total a pagar:`, 400, totalsY + 70);
    doc
      .fontSize(14)
      .text(`$${invoice.total.toFixed(2)}`, 500, totalsY + 70, {
        width: 50,
        align: "right",
      });

    // Metodo de pago y estado transaccion
    const paymentMethodMap = {
      cash: "Dinero en efectivo",
      "credit-card": "Pago con tarjeta de debito/credito",
      transfer: "Transferencia bancaria",
      credits: "Credito interno",
      paypal: "PayPal"
    };
    const rawMethod = invoice.transactionId?.method || "N/A";
    const paymentStatusMap = {
      completed: "Pagado",
      paid: "Pagado",
      pending: "Pendiente",
      failed: "Fallido",
      refunded: "Reembolsado"
    };
    const methodLabel = paymentMethodMap[rawMethod] || rawMethod;
    const authorizedBy = invoice.transactionId?.metadata?.authorizedBy || "N/A";

    doc
      .fontSize(10)
      .text(
        `Metodo de pago: ${methodLabel}`,
        40,
        totalsY + 100
      );
    doc.text(
      `Estado de pago: ${paymentStatusMap[invoice.transactionId?.status] || invoice.transactionId?.status || "N/A"}`,
      40,
      totalsY + 115
    );
    doc.text(
      `Autorizado por: ${authorizedBy}`,
      40,
      totalsY + 130
    );

    // Metodo de envio
// Método de envío
    const shipping = invoice.orderId?.shippingMethod;
    if (shipping) {
      doc
        .fontSize(10)
        .text(
          `Método de envío: ${shipping.empresa} - ${shipping.tipoEnvio}`,
          40,
          totalsY + 155
        );
      doc.text(`Descripción: ${shipping.descripcion}`, 40, totalsY + 170);
    }

    // Datos SRI (si aplica)
    const sri = invoice.sriSnapshot || {};
    if (sri.enabled) {
      doc
        .fontSize(10)
        .text(`Ambiente: ${sri.environment || "-"}`, 40, totalsY + 190)
        .text(`Emision: ${sri.emissionType || "-"}`, 40, totalsY + 205)
        .text(`Obligado a llevar contabilidad: ${sri.obligatedAccounting || "-"}`, 40, totalsY + 220)
        .text(`Contribuyente especial: ${sri.specialContributor || "-"}`, 40, totalsY + 235)
        .text(`Dir. Matriz: ${sri.mainOfficeAddress || "-"}`, 40, totalsY + 250)
        .text(`Numero de autorizacion: ${sri.authorizationNumber || "-"}`, 40, totalsY + 265)
        .text(`Clave de acceso: ${sri.accessKey || "-"}`, 40, totalsY + 280);
    }

    // QR (dinamico si qrData existe)
    if (QRCode && invoice.qrData) {
      try {
        const qrDataUrl = await QRCode.toDataURL(invoice.qrData, { margin: 1, width: 120 });
        const qrBase64 = qrDataUrl.split(",")[1];
        const qrBuffer = Buffer.from(qrBase64, "base64");
        doc.image(qrBuffer, 440, totalsY + 190, { width: 100, height: 100 });
      } catch (error) {
        // Ignorar si falla QR
      }
    }

    // Terminos y condiciones (texto pequeno)
    const terms = invoice.termsAndConditions || "";
    if (terms) {
      doc
        .fontSize(8)
        .fillColor("#666666")
        .text(terms, 40, totalsY + 310, { width: 520, align: "left" })
        .fillColor("#000000");
    }

    // Mensaje final
    doc
      .fontSize(12)
      .text("¡Gracias por su compra!", 0, totalsY + 190, { align: "center" });

    doc.end();

    stream.on("finish", () => {
      // Borrar logo temporal si se descargó
      if (
        invoice.companyDetails.logoUrl &&
        invoice.companyDetails.logoUrl.startsWith("http")
      ) {
        const logoTempPath = path.join(
          __dirname,
          "..",
          "temp",
          `logo_${invoice.invoiceNumber}.png`
        );
        if (fs.existsSync(logoTempPath)) fs.unlinkSync(logoTempPath);
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=factura_${invoice.invoiceNumber}.pdf`
      );

      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);

      fileStream.on("end", () => {
        fs.unlink(pdfPath, (err) => {
          if (err) console.error("Error al borrar archivo temporal:", err);
        });
      });
    });

    stream.on("error", (err) => {
      console.error("Error al generar PDF:", err);
      res.status(500).send("Error al generar factura PDF");
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const getMyTransaction = async (req, res) => {
  try {
    const uid = req.uid;
    const limit = parseInt(req.query.limit) || 10; // Permite personalizar el límite

    // Validar que el límite no sea demasiado alto
    if (limit > 20) {
      return res.status(400).json({ 
        message: 'El límite máximo permitido es 20' 
      });
    }

    // Buscar órdenes del usuario ordenadas por fecha descendente
    const orders = await orderModel.find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ 
        ok: false,
        message: 'No se encontraron órdenes para este usuario' 
      });
    }

    const orderIds = orders.map(order => order._id);

    // Buscar transacciones asociadas a esas órdenes
    const transactions = await transactionModel.find({ 
      orderId: { $in: orderIds } 
    })
    .sort({ createdAt: -1 })
    .lean();

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ 
        ok: false,
        message: 'No se encontraron transacciones para las órdenes de este usuario' 
      });
    }

    // Combinar información de órdenes y transacciones
    const enrichedTransactions = transactions.map(transaction => {
      const relatedOrder = orders.find(order => order._id.equals(transaction.orderId));
      return {
        ...transaction,
        orderDetails: {
          totalAmount: relatedOrder.total,
          status: relatedOrder.status,
          productsCount: relatedOrder.products.length
        }
      };
    });

    return res.json({
      ok: true,
      count: enrichedTransactions.length,
      transactions: enrichedTransactions
    });

  } catch (error) {
    console.error('Error al obtener transacciones del usuario:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

const getOrdenByID = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Buscamos la transacción por ID
    const transaction = await transactionModel.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transacción no encontrada' });
    }

    // 2. Extraemos el orderId de la transacción
    const orderId = transaction.orderId;

    // 3. Buscamos la orden con ese orderId
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Orden asociada no encontrada' });
    }

    // 4. Enviamos la orden (puedes enviar también la transacción si deseas)
    return res.json({
      order,
      transaction
    });

  } catch (error) {
    console.error('Error al obtener la orden:', error);
    return res.status(500).json({
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};



module.exports = {
  getInvoicesAll,
  getInvoicesByCustomer,
  createInvoice,
  generateInvoicePDF,
  getMyTransaction,
  getOrdenByID
};
