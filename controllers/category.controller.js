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


module.exports = {
    crearCategoria,
    getCategorias
};
