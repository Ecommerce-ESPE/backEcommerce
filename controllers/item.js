const { itemModel } = require('../models/index');
const mongoose = require('mongoose');
const { moment } = require('../config/components/timeConfig'); 
// @GET ALL ITEMS
const getItemsAll = async (req, res) => {
  try {
    const data = await itemModel.find().populate("createdBy", 'name email');
    res.json({
      code: "200",
      ok: true,
      items: data
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message
    });
  }
};

const getItemsById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await itemModel
      .findById(id)
      .populate("category", "name subcategories");

    if (!item) {
      return res.status(404).json({ 
        code: "404", 
        ok: false, 
        message: "Item no encontrado" 
      });
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
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      error: error.message 
    });
  }
};

/// FILTRO
const getFilteredItems = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      sort = "createdAt_desc",
      page = 1,
      limit = 12,
    } = req.query;

    const query = { visibility: true };

    // 1. Validar si los valores son ObjectIds antes de agregarlos al query
    if (category && category !== "ninguna" && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }
    if (subcategory && subcategory !== "ninguna" && mongoose.Types.ObjectId.isValid(subcategory)) {
      query.subcategory = subcategory;
    }

    // Ordenamiento
    const sortOptions = {
      price_asc: { "value.originalPrice": 1 },
      price_desc: { "value.originalPrice": -1 },
      //price_asc: { "value.price": 1 },
      //price_desc: { "value.price": -1 }, 
      discount_asc: { "value.discountPrice": 1 },
      discount_desc: { "value.discountPrice": -1 },
      rating: { rating: -1 },
      name_asc: { nameProduct: 1 },
      name_desc: { nameProduct: -1 },
      createdAt_desc: { createdAt: -1 },
    };
    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 2. Filtrar documentos con categorías/subcategorías inválidas
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

    // 3. Limpieza manual de referencias rotas (opcional)
    const safeItems = items.map(item => ({
      ...item,
      category: item.category?._id ? item.category : null,
      subcategory: item.subcategory?._id ? item.subcategory : null,
    }));

    res.json({
      code: "200",
      ok: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      items: safeItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      error: "Error al obtener productos" 
    });
  }
};
// Filtro Admin

const getFilteredItemsAdmin = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      sort = "createdAt_desc",
      page = 1,
      limit = 12,
      showHidden = "true", // por defecto mostrar ocultos
    } = req.query;

    // Mostrar todos los productos (visibles y ocultos) por defecto
    const query = {};
    if (showHidden !== "true") {
      query.visibility = true;
    }

    // 1. Validar si los valores son ObjectIds antes de agregarlos al query
    if (category && category !== "ninguna" && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }
    if (subcategory && subcategory !== "ninguna" && mongoose.Types.ObjectId.isValid(subcategory)) {
      query.subcategory = subcategory;
    }

    // Ordenamiento
    const sortOptions = {
      price_asc: { "value.originalPrice": 1 },
      price_desc: { "value.originalPrice": -1 },
      discount_asc: { "value.discountPrice": 1 },
      discount_desc: { "value.discountPrice": -1 },
      rating: { rating: -1 },
      name_asc: { nameProduct: 1 },
      name_desc: { nameProduct: -1 },
      createdAt_desc: { createdAt: -1 },
    };
    const sortQuery = sortOptions[sort] || { createdAt: -1 };

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 2. Filtrar documentos con categorías/subcategorías inválidas
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

    // 3. Limpieza manual de referencias rotas (opcional)
    const safeItems = items.map(item => ({
      ...item,
      category: item.category?._id ? item.category : null,
      subcategory: item.subcategory?._id ? item.subcategory : null,
    }));

    res.json({
      code: "200",
      ok: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      items: safeItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      error: "Error al obtener productos" 
    });
  }
};

// CREAR ITEM 
const createItem = async (req, res) => {
  try {
    const uid = req.uid; // uid obtenido del token
    const {
      nameProduct,
      description,
      category,
      subcategory,
      value,
      images,
      promotion,
      stock,
      //tags,
      visibility = true
    } = req.body;

    // Ajustar fechas de promoción si existen
    let promotionObj = promotion;
    if (promotionObj) {
      if (promotionObj.startDate) {
        promotionObj.startDate = moment(promotionObj.startDate)
          .startOf('day')
          .toDate();
      }
      if (promotionObj.endDate) {
        promotionObj.endDate = moment(promotionObj.endDate)
          .endOf('day')
          .toDate();
      }
    }

    // Crear item con valores controlados
    const item = new itemModel({
      nameProduct,
      description: description || "",
      category,
      subcategory: subcategory || null,
      value: value || [],
      images: images || [],
      promotion: promotionObj || {},
      stock: stock || 0,
      //tags: tags || [],
      visibility,
      createdBy: uid
    });

    const data = await item.save();
    res.json({
      code: "200",
      ok: true,
      item: data
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message
    });
  }
};

// ACTUALIZAR PRODUCTO COMPLETO
const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        code: "400", 
        ok: false, 
        message: "ID de producto inválido" 
      });
    }

    // Ajustar fechas si existen
    if (updateData.promotion) {
      if (updateData.promotion.startDate) {
        updateData.promotion.startDate = moment(updateData.promotion.startDate)
          .startOf('day')
          .toDate();
      }
      if (updateData.promotion.endDate) {
        updateData.promotion.endDate = moment(updateData.promotion.endDate)
          .endOf('day')
          .toDate();
      }
    }

    const item = await itemModel.findById(id);
    if (!item) {
      return res.status(404).json({ 
        code: "404", 
        ok: false, 
        message: "Producto no encontrado" 
      });
    }

    // Mezclar los cambios
    Object.assign(item, updateData);
    const updatedItem = await item.save();

    res.json({
      code: "200",
      ok: true,
      message: "Producto actualizado exitosamente",
      item: updatedItem
    });

  } catch (error) {
    console.error("Error actualizando producto:", error);
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
};


// ELIMINAR PRODUCTO
const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        code: "400", 
        ok: false, 
        message: "ID de producto inválido" 
      });
    }

    // Eliminar el producto definitivamente
    const deletedItem = await itemModel.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ 
        code: "404", 
        ok: false, 
        message: "Producto no encontrado" 
      });
    }

    res.json({
      code: "200",
      ok: true,
      message: "Producto eliminado",
      item: deletedItem
    });

  } catch (error) {
    console.error("Error eliminando producto:", error);
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
};

// ACTUALIZAR PROMOCIÓN DE UN ITEM
const updateItemPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { promotion } = req.body;

    // Validaciones básicas
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        code: "400", 
        ok: false, 
        message: "ID de producto inválido" 
      });
    }

    if (!promotion || typeof promotion.active !== 'boolean') {
      return res.status(400).json({ 
        code: "400", 
        ok: false, 
        message: "Datos de promoción inválidos" 
      });
    }

    // Si la promoción está activa, validar campos requeridos
    if (promotion.active) {
      if (typeof promotion.percentage !== 'number' || 
          promotion.percentage <= 0 || 
          promotion.percentage > 100) {
        return res.status(400).json({ 
          code: "400", 
          ok: false, 
          message: "Porcentaje de descuento inválido (debe ser entre 1 y 100)" 
        });
      }

      if (!promotion.startDate || !promotion.endDate) {
        return res.status(400).json({ 
          code: "400", 
          ok: false, 
          message: "Fechas de inicio y fin son requeridas" 
        });
      }

      // Convertir fechas a objetos Date
      promotion.startDate = new Date(promotion.startDate);
      promotion.endDate = new Date(promotion.endDate);

      if (isNaN(promotion.startDate.getTime()) || isNaN(promotion.endDate.getTime())) {
        return res.status(400).json({ 
          code: "400", 
          ok: false, 
          message: "Formato de fecha inválido" 
        });
      }

      // Ajustar fechas: startDate al inicio del día y endDate al final del día
      promotion.startDate.setUTCHours(0, 0, 0, 0);
      promotion.endDate.setUTCHours(23, 59, 59, 999);

      if (promotion.endDate <= promotion.startDate) {
        return res.status(400).json({ 
          code: "400", 
          ok: false, 
          message: "La fecha de fin debe ser posterior a la fecha de inicio" 
        });
      }
    }

    // Buscar el producto y actualizar usando save() para activar middleware
    const item = await itemModel.findById(id);
    if (!item) {
      return res.status(404).json({ 
        code: "404", 
        ok: false, 
        message: "Producto no encontrado" 
      });
    }

    // Actualizar la promoción
    item.promotion = promotion;
    const updatedItem = await item.save(); // Esto activará el middleware pre('save')

    // Preparar respuesta
    res.json({
      code: "200",
      ok: true,
      message: "Promoción actualizada exitosamente",
      item: {
        _id: updatedItem._id,
        nameProduct: updatedItem.nameProduct,
        promotion: updatedItem.promotion,
        value: updatedItem.value.map(variant => ({
          size: variant.size,
          originalPrice: variant.originalPrice,
          discountPrice: variant.discountPrice
        }))
      }
    });

  } catch (error) {
    console.error("Error actualizando promoción:", error);
    res.status(500).json({ 
      code: "500", 
      ok: false, 
      message: "Error interno del servidor",
      error: error.message 
    });
  }
};

// Productos Recientemente agreagados
const getItemRecentlyAdded = async (req, res) => {
  try {
    const items = await itemModel
      .find({ visibility: true })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({
      code: "200",
      ok: true,
      items
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message
    });
  }
};

//Productos Destacados
const getFeaturedItems = async (req, res) => {
  try {
    const items = await itemModel
      .find({ visibility: true, "promotion.active": true })
      .sort({ "promotion.startDate": -1 })
      .limit(10);
    res.json({
      code: "200",
      ok: true,
      items
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message
    });
  }
};

module.exports = {
  createItem, 
  getItemsAll,
  getItemsById,
  getFilteredItems,
  updateItem,
  deleteItem,
  updateItemPromotion,
  getItemRecentlyAdded,
  getFilteredItemsAdmin,
  getFeaturedItems
};