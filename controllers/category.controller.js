const { response } = require('express');
const {categoryModel} = require('../models/index'); 
const { registrarAuditoria } = require("../helpers/auditoria");

// Crear categoría
const crearCategoria = async (req, res = response) => {
    const { name, description, images, subcategories } = req.body;
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
        const categorias = await categoryModel.find();
        await categoryModel.populate(categorias, { path: 'subcategories' });
        res.status(200).json({
            ok: true,
            categorias
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            ok: false,
            msg: 'Error al obtener las categorías'
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
    const { name, description, images, subcategories } = req.body;
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
    deleteCategoria,
    updateCategoria,
    deleteSubcategory
};
