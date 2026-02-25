const { response } = require('express');
const mongoose = require('mongoose');
const { categoryModel, itemModel } = require('../../models/index'); 
const { registrarAuditoria } = require("../../helpers/auditoria");

// Crear categoría
const crearCategoria = async (req, res = response) => {
    const { name, description, images, specTemplate, subcategories } = req.body;
    const usuarioId = req.uid;

    try {
        // Verificar si ya existe una categoría con el mismo nombre
        const categoriaExistente = await categoryModel.findOne({ name });
        if (categoriaExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'Ya existe una categoría con ese nombre'
            });
        }

        const nuevaCategoria = new categoryModel({
            name,
            description,
            images,
            specTemplate,
            subcategories
        });

        await nuevaCategoria.save();

        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'CREAR_CATEGORIA',
        //    descripcion: `Categoría creada: ${name}`,
        //    entidad: 'Category',
        //    entidadId: nuevaCategoria._id,
        //    req
        //});

        res.status(201).json({
            ok: true,
            categoria: nuevaCategoria
        });

    } catch (error) {
        console.error(error);
        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ERROR_CREAR_CATEGORIA',
        //    descripcion: `Error al crear categoría: ${error.message}`,
        //    entidad: 'Category',
        //    req
        //});
        res.status(500).json({
            ok: false,
            msg: 'Error al crear categoría'
        });
    }
};

// Obtener todas las categorías
const getCategorias = async (req, res = response) => {
    try {
        const { page = 1, limit = 10, q } = req.query;
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (parsedPage - 1) * parsedLimit;

        const query = {};
        if (q) {
            query.name = { $regex: q, $options: 'i' };
        }

        const [categorias, total] = await Promise.all([
            categoryModel.find(query).sort({ name: 1 }).skip(skip).limit(parsedLimit),
            categoryModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / parsedLimit) || 1;

        res.status(200).json({
            ok: true,
            categorias,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages,
                hasNextPage: parsedPage < totalPages,
                hasPrevPage: parsedPage > 1
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: 'Error al obtener las categorías'
        });
    }
};

// Obtener una categoria por id (incluye subcategorias)
const getCategoriaById = async (req, res = response) => {
    const { id } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                ok: false,
                msg: 'Id de categoria invalido'
            });
        }

        const categoria = await categoryModel.findById(id);
        if (!categoria) {
            return res.status(404).json({
                ok: false,
                msg: 'Categoria no encontrada'
            });
        }

        res.status(200).json({
            ok: true,
            categoria
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: 'Error al obtener la categoria'
        });
    }
};

const mergeSpecTemplates = (categoryTemplate = [], subcategoryTemplate = []) => {
    const merged = [...(Array.isArray(categoryTemplate) ? categoryTemplate : [])];
    const indexByKey = new Map(
        merged.map((entry, idx) => [String(entry?.key || "").trim().toLowerCase(), idx])
    );

    (Array.isArray(subcategoryTemplate) ? subcategoryTemplate : []).forEach((entry) => {
        const key = String(entry?.key || "").trim().toLowerCase();
        if (!key) return;

        if (indexByKey.has(key)) {
            merged[indexByKey.get(key)] = { ...merged[indexByKey.get(key)], ...entry };
            return;
        }

        indexByKey.set(key, merged.length);
        merged.push(entry);
    });

    return merged
        .map((entry, idx) => ({
            ...entry,
            order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : idx,
        }))
        .sort((a, b) => a.order - b.order);
};

const getCategorySpecTemplate = async (req, res = response) => {
    const { id, subcategoryId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                ok: false,
                msg: "Id de categoria invalido",
            });
        }

        const categoria = await categoryModel.findById(id).select("name specTemplate subcategories");
        if (!categoria) {
            return res.status(404).json({
                ok: false,
                msg: "Categoria no encontrada",
            });
        }

        let subcategory = null;
        if (subcategoryId) {
            if (!mongoose.Types.ObjectId.isValid(subcategoryId)) {
                return res.status(400).json({
                    ok: false,
                    msg: "Id de subcategoria invalido",
                });
            }

            subcategory = categoria.subcategories.id(subcategoryId);
            if (!subcategory) {
                return res.status(404).json({
                    ok: false,
                    msg: "Subcategoria no encontrada",
                });
            }
        }

        const categoryTemplate = Array.isArray(categoria.specTemplate)
            ? categoria.specTemplate
            : [];
        const subcategoryTemplate = Array.isArray(subcategory?.specTemplate)
            ? subcategory.specTemplate
            : [];

        return res.status(200).json({
            ok: true,
            categoryId: categoria._id,
            categoryName: categoria.name,
            subcategoryId: subcategory?._id || null,
            subcategoryName: subcategory?.name || null,
            categoryTemplate,
            subcategoryTemplate,
            effectiveTemplate: mergeSpecTemplates(categoryTemplate, subcategoryTemplate),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: "Error al obtener specTemplate",
        });
    }
};

// Obtener categorias populares
const getPopularCategories = async (req, res = response) => {
    try {
        const limit = Math.max(1, parseInt(req.query.limit) || 6);

        const topCategories = await itemModel.aggregate([
            { $match: { visibility: true, category: { $ne: null } } },
            { $group: { _id: "$category", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: limit }
        ]);

        const categoryIds = topCategories.map((c) => c._id);
        const categories = await categoryModel
            .find({ _id: { $in: categoryIds } })
            .select("name images")
            .lean();

        const categoryMap = new Map(
            categories.map((cat) => [String(cat._id), cat])
        );

        const popular = topCategories
            .map((row) => {
                const cat = categoryMap.get(String(row._id));
                if (!cat) return null;
                const image = Array.isArray(cat.images) && cat.images.length > 0
                    ? cat.images[0]
                    : null;
                return {
                    _id: cat._id,
                    name: cat.name,
                    image,
                    total: row.total
                };
            })
            .filter(Boolean);

        res.status(200).json({
            ok: true,
            categories: popular
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: 'Error al obtener categorias populares'
        });
    }
};
// DELETE
const deleteCategoria = async (req, res = response) => {
    const { id } = req.params;
    //const usuarioId = req.uid;
    try {
        const categoria = await categoryModel.findById(id);
        if (!categoria) {
            return res.status(404).json({
                ok: false,
                msg: 'Categoría no encontrada'
            });
        }

        await categoryModel.findByIdAndDelete(id);

        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ELIMINAR_CATEGORIA',
        //    descripcion: `Categoría eliminada: ${categoria.name}`,
        //    entidad: 'Category',
        //    entidadId: id,
        //    req
        //});

        res.status(200).json({
            ok: true,
            msg: 'Categoría eliminada correctamente'
        });

    } catch (error) {
        console.error(error);
        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ERROR_ELIMINAR_CATEGORIA',
        //    descripcion: `Error al eliminar categoría: ${error.message}`,
        //    entidad: 'Category',
        //    req
        //});
        res.status(500).json({
            ok: false,
            msg: 'Error al eliminar categoría'
        });
    }
}

// Update

const updateCategoria = async (req, res = response) => {
    const { id } = req.params;
    const { name, description, images, specTemplate, subcategories } = req.body;
    //const usuarioId = req.uid;

    try {
        const categoria = await categoryModel.findById(id);
        if (!categoria) {
            return res.status(404).json({
                ok: false,
                msg: 'Categoría no encontrada'
            });
        }

        // Actualizar los campos de la categoría
        categoria.name = name || categoria.name;
        categoria.description = description || categoria.description;
        categoria.images = images || categoria.images;
        categoria.specTemplate = specTemplate || categoria.specTemplate;
        categoria.subcategories = subcategories || categoria.subcategories;

        await categoria.save();

        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ACTUALIZAR_CATEGORIA',
        //    descripcion: `Categoría actualizada: ${name}`,
        //    entidad: 'Category',
        //    entidadId: id,
        //    req
        //});

        res.status(200).json({
            ok: true,
            categoria
        });

    } catch (error) {
        console.error(error);
        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ERROR_ACTUALIZAR_CATEGORIA',
        //    descripcion: `Error al actualizar categoría: ${error.message}`,
        //    entidad: 'Category',
        //    req
        //});
        res.status(500).json({
            ok: false,
            msg: 'Error al actualizar categoría'
        });
    }
}
//   

// Eliminar una subcategoría de una categoría
const deleteSubcategory = async (req, res = response) => {
    const { categoryId, subcategoryId } = req.params;
    //const usuarioId = req.uid;
    try {
        // Buscar la categoría principal
        const categoria = await categoryModel.findById(categoryId);
        if (!categoria) {
            return res.status(404).json({
                ok: false,
                msg: 'Categoría no encontrada'
            });
        }

        // Buscar la subcategoría dentro del array
        const subcatIndex = categoria.subcategories.findIndex(
            (subcat) => subcat._id.toString() === subcategoryId
        );
        if (subcatIndex === -1) {
            return res.status(404).json({
                ok: false,
                msg: 'Subcategoría no encontrada'
            });
        }

        // Eliminar la subcategoría del array
        const subcategoriaEliminada = categoria.subcategories[subcatIndex];
        categoria.subcategories.splice(subcatIndex, 1);

        await categoria.save();

        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ELIMINAR_SUBCATEGORIA',
        //    descripcion: `Subcategoría eliminada: ${subcategoriaEliminada.name}`,
        //    entidad: 'Category',
        //    entidadId: categoryId,
        //    req
        //});

        res.status(200).json({
            ok: true,
            msg: 'Subcategoría eliminada correctamente'
        });

    } catch (error) {
        console.error(error);
        //await registrarAuditoria({
        //    usuarioId,
        //    accion: 'ERROR_ELIMINAR_SUBCATEGORIA',
        //    descripcion: `Error al eliminar subcategoría: ${error.message}`,
        //    entidad: 'Category',
        //    req
        //});
        res.status(500).json({
            ok: false,
            msg: 'Error al eliminar subcategoría'
        });
    }
};


module.exports = {
    crearCategoria,
    getCategorias,
    getCategoriaById,
    getCategorySpecTemplate,
    getPopularCategories,
    deleteCategoria,
    updateCategoria,
    deleteSubcategory
};
