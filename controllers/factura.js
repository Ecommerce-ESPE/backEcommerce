const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const {
  orderModel,
  transactionModel,
  invoiceModel,
  itemModel,
  discountModel,
  userModel,
  shippingMethodModel,
} = require("../models/index");

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

    // Números y fechas
    doc
      .fontSize(10)
      .text(`Factura Nº: ${invoice.invoiceNumber}`, 40, 170)
      .text(`Estado: ${estadoEnEspanol}`, 40, 185)
      .text(
        `Fecha emisión: ${new Date(invoice.createdAt).toLocaleDateString()}`,
        40,
        200
      )
      .text(
        `Fecha vencimiento: ${new Date(invoice.dueDate).toLocaleDateString()}`,
        40,
        215
      );

    // Datos cliente
    doc.fontSize(12).text("Datos del Cliente:", 350, 170);
    doc
      .fontSize(10)
      .text(`Nombre: ${invoice.orderId?.customerName || "N/A"}`, 350, 185)
      .text(`Email: ${invoice.orderId?.customerEmail || "N/A"}`, 350, 200)
      .text(`Teléfono: ${invoice.orderId?.customerPhone || "N/A"}`, 350, 215);

    // Dirección de envío
    const addr = invoice.orderId?.shippingAddress || {};
    doc.fontSize(12).text("Dirección de Envío:", 350, 240);
    doc
      .fontSize(10)
      .text(`Provincia: ${addr.provincia || "-"}`, 350, 255)
      .text(`Cantón: ${addr.canton || "-"}`, 350, 270)
      .text(`Parroquia: ${addr.parroquia || "-"}`, 350, 285)
      .text(`Calle: ${addr.callePrincipal || "-"}`, 350, 300)
      .text(`Número: ${addr.numeroCasa || "-"}`, 350, 315)
      .text(`Código postal: ${addr.codigoPostal || "-"}`, 350, 330);

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

    doc
      .text(`Impuestos:`, 400, totalsY + 30)
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

    // Método de pago y estado transacción
    doc
      .fontSize(10)
      .text(
        `Método de pago: ${invoice.transactionId?.method || "N/A"}`,
        40,
        totalsY + 100
      );
    doc.text(
      `Estado de pago: ${invoice.transactionId?.status || "N/A"}`,
      40,
      totalsY + 115
    );

    // Método de envío
    const shipping = invoice.orderId?.shippingMethod;
    if (shipping) {
      doc
        .fontSize(10)
        .text(
          `Método de envío: ${shipping.empresa} - ${shipping.tipoEnvio}`,
          40,
          totalsY + 140
        );
      doc.text(`Descripción: ${shipping.descripcion}`, 40, totalsY + 155);
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
