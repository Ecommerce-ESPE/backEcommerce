const {facturaModel} = require('../models/index');


//Producto Popular
const moreSold = async (req, res)=>{
    try {
        const productCount = await facturaModel.aggregate([
            { $unwind: '$items' }, // Descompone el array de items en documentos individuales
            {
              $lookup: {
                from: 'items', // Nombre de la colección de productos
                localField: 'items',
                foreignField: '_id',
                as: 'productDetails'
              }
            },
            { $unwind: '$productDetails' }, // Descompone los detalles del producto
            { $group: { _id: '$items', count: { $sum: 1 }, productName: { $first: '$productDetails.nameProduct' } } },
            { $sort: { count: -1 } } // Ordena por cantidad de forma ascendente
        ]);

        res.json({
            code:200,
            ok:true,
            moreSolds: productCount
        })
         console.log(productCount)
    } catch (error) {
        res.json({
            code:500,
            ok:false,
            msg:"Ocurrio un error con la obtencion de datos Productos Mas Vendido"
        }),
        console.log(error)
    }
}

module.exports = {
    moreSold
}