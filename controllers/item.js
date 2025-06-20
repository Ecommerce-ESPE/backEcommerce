const {itemModel} = require('../models/index');

// @GET ALL ITEMS
const getItemsAll = async (req,res)=>{
    const {body} = req;
    const data = await itemModel.find().populate("createdBy",'name email')
    res.json({
        code:"200",
        ok:true,
        items:data
    });
}


const getItemsById = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await itemModel
            .findById(id)
            .populate("category", "name subcategories");

        if (!item) {
            return res.status(404).json({ code: "404", ok: false, message: "Item no encontrado" });
        }

        // Convertir a objeto plano para poder modificar
        const itemObj = item.toObject();

        // Buscar la subcategoría dentro de item.category.subcategories
        const subcatId = item.subcategory?.toString();
        const subcategory = item.category.subcategories?.find(
            (sub) => sub._id.toString() === subcatId
        );

        // Insertar la subcategoría completa en el objeto
        itemObj.subcategory = subcategory || null;

        res.json({
            code: "200",
            ok: true,
            item: itemObj
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ code: "500", ok: false, error: error.message });
    }
};


/// FILTRO
const getFilteredItems = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      sort = "createdAt_desc", // por defecto: más recientes
      page = 1,
      limit = 12,
    } = req.query;

    const query = {
      visibility: true,
    };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    // Ordenamiento dinámico
    const sortOptions = {
      price_asc: { "value.price": 1 },
      price_desc: { "value.price": -1 },
      rating: { rating: -1 },
      name_asc: { nameProduct: 1 },
      name_desc: { nameProduct: -1 },
      createdAt_desc: { createdAt: -1 },
    };

    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Buscar los items
    const [items, total] = await Promise.all([
      itemModel
        .find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("category", "name")
        .lean(),
      itemModel.countDocuments(query),
    ]);

    res.json({
      code: "200",
      ok: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: "500", ok: false, error: error.message });
  }
};

const createItem = async (req,res)=>{
    const {body} = req;
    const data = await itemModel.create(body);
    res.json({
        code:"200",
        ok:true,
        item:data
    })
}

module.exports = {
    createItem, 
    getItemsAll,
    getItemsById,
    getFilteredItems
}