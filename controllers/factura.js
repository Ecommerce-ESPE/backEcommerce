const Decimal = require('decimal.js');
const {facturaModel, itemModel, discountModel} = require('../models/index');

const getFactoryAll = async (req,res)=>{
    const {body} = req;
    const data = await facturaModel.find()
        .populate("cliente",'name email')
        //.populate("items",'nameProduct description value category')    
    res.json({
        code:"200",
        ok:true,
        facturas:data
    })
}

const createFactura = async (req, res) => {
    const { items: _uid, cliente, methodPay, discountCode } = req.body;

    try {
        const factura = new facturaModel();
        const items = await itemModel.find({ _id: { $in: _uid } });

        if (!items.length) {
            return res.status(400).json({
                code: "400",
                ok: false,
                error: "No se encontraron productos",
            });
        }

        // Depuración: Ver estructura completa de los productos
        //console.log("Productos encontrados (formateados):", JSON.stringify(items, null, 2));

        // Verificar precios
        items.forEach(item => {
            console.log(`--- Producto: ${item.nameProduct} ---`);
            console.log("Valores (value):", item.value);
            if (item.value.length > 0) {
                const price = item.value[0].price;
                console.log("Precio (price):", price);
                return new Decimal(price);
            } else {
                console.log("⚠️ Este producto no tiene precios definidos.");
                return new Decimal(0);
            }
        });

        // Obtener precios (con validación robusta)
        const values = items.map(item => {
            if (item.value?.length > 0 && item.value[0].price !== undefined) {
                const price = item.value[0].price;
                console.log(`✅ Precio válido para ${item.nameProduct}: ${price}`);
                return new Decimal(price);
            } else {
                console.log(`❌ Precio no definido para ${item.nameProduct}, se usa 0 por defecto.`);
                return new Decimal(0);
            }
        });

        const subtotal = values.reduce((total, value) => total.plus(value), new Decimal(0));
        console.log("Subtotal:", subtotal.toString());

        // Calcular total (subtotal + impuesto)
        const taxRate = new Decimal(factura.tax || 0);
        let total = subtotal.times(new Decimal(1).plus(taxRate));
        console.log("Impuesto:", taxRate.toString());
        console.log("Total antes de descuento:", total.toString());

        // Aplicar descuento (si el subtotal es >= 10 y hay código de descuento)
        let discountAmount = new Decimal(0);
        let baseDescuento = new Decimal(0);

        if (subtotal.greaterThanOrEqualTo(10)) {
            if (!discountCode) {
                console.log("ℹ️ No se proporcionó código de descuento");
            } else {
                const discount = await discountModel.findOne({
                    code: discountCode,
                });

                if (!discount) {
                    console.log("❌ Código de descuento no existe:", discountCode);
                } else if (!discount.isValid) {
                    console.log("❌ Descuento no está activo:", discountCode);
                } else if (discount.expiresAt <= new Date()) {
                    console.log(`❌ Descuento caducó el ${discount.expiresAt}`);
                } else {
                    console.log('✅ DESCUENTO VÁLIDO ENCONTRADO');
                    discountAmount = new Decimal(discount.amount);
                    
                    // Verificar si el descuento es porcentaje (0-1) o monto fijo
                    if (discountAmount.lessThanOrEqualTo(1)) {
                        // Descuento porcentual (ej: 0.1 para 10%)
                        baseDescuento = total.times(discountAmount);
                        console.log(`🔹 Descuento del ${discountAmount.times(100)}% aplicado:`, baseDescuento.toString());
                    } else {
                        // Descuento de monto fijo (ej: 1.99)
                        baseDescuento = discountAmount;
                        console.log('🔹 Descuento fijo aplicado:', baseDescuento.toString());
                    }
                    
                    total = total.minus(baseDescuento);
                    console.log("Total con descuento:", total.toString());
                }
            }
        } else {
            console.log("ℹ️ Subtotal menor a 10, no se aplican descuentos");
        }

        // Guardar la factura en la base de datos
        factura.subtotal = subtotal.toString();
        factura.total = total.toString();
        factura.items = items.map(item => item._id);
        factura.cliente = cliente;
        factura.methodPay = methodPay;
        factura.nItems = items.length;
        factura.discount = baseDescuento.toString();

        await factura.save();

        res.json({
            code: "200",
            ok: true,
            factura,
        });

    } catch (error) {
        console.error("Error detallado:", error);
        res.status(500).json({
            code: "500",
            ok: false,
            error: error.message,
        });
    }
};


const sendFactura = ()=>{
    const doc = new PDFDocument();

    // Agregar contenido al PDF
    doc.fontSize(14).text('Factura', { align: 'center' });
    doc.text('-----------------------------');

    doc.fontSize(12).text(`Cliente: ${cliente.name}`);
    doc.text('Productos:');
    items.forEach(item => {
        doc.text(`${item.nameProduct}: $${item.value}`);
    });
    doc.text(`Subtotal: $${subtotal}`);
    doc.text(`Total: $${total}`);

    // Generar el PDF y guardarlo en una ubicación temporal
    const pdfPath = path.join(__dirname, 'factura.pdf');
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.end();

    // Enviar el archivo PDF como respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=factura.pdf');
    fs.createReadStream(pdfPath).pipe(res);

    // Eliminar el archivo temporal después de enviarlo
    fs.unlinkSync(pdfPath);

}


module.exports = {
    createFactura, 
    getFactoryAll,
    
}