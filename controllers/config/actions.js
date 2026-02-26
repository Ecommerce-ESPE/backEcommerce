const fs = require('fs');
const path = require('path');
const mongoose = require("mongoose");

// Función para configurar o retornar opciones si fuera necesario
const confg = () => {
  // Puedes poner lógica de configuración aquí si es necesario
  return {
    message: 'Configuración cargada correctamente'
  };
};

const {shippingMethodModel, userModel} = require('../../models/index');

const normalizeProvince = (value = "") => String(value).trim().toUpperCase();

const isMethodAvailableForProvince = (method, province) => {
  if (!province) return true;

  const allow = Array.isArray(method.provinciasPermitidas)
    ? method.provinciasPermitidas.map(normalizeProvince)
    : [];
  const deny = Array.isArray(method.provinciasRestringidas)
    ? method.provinciasRestringidas.map(normalizeProvince)
    : [];

  if (allow.length > 0 && !allow.includes(province)) return false;
  if (deny.length > 0 && deny.includes(province)) return false;
  return true;
};

// CARGAR DIRECCIONES DE ENVÍO DESDE UN ARCHIVO JSON
const getShippingAddresses = (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'storage', 'ecuador.json');

    const jsonData = fs.readFileSync(filePath, 'utf-8');

    const addresses = JSON.parse(jsonData);
    res.status(200).json(addresses);

  } catch (error) {
    console.error("Error al cargar direcciones:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// CREAR METOPDO DE ENVÍO
const createShippingMethod = async (req, res) => {
  try {
    const {
      costo,
      descripcion,
      tiempoEstimado,
      isFeatured,
      priority,
      empresa,
      tipoEnvio,
      provinciasPermitidas,
      provinciasRestringidas,
    } = req.body;

    // Validaciones más robustas
    if (
      typeof costo !== "number" || costo < 0 ||
      !descripcion?.trim() ||
      !empresa?.trim() ||
      !tipoEnvio?.trim()
    ) {
      return res.status(400).json({ error: "Datos inválidos o incompletos" });
    }

    const newShippingMethod = new shippingMethodModel({
      costo,
      descripcion,
      tiempoEstimado: String(tiempoEstimado || "").trim(),
      isFeatured: Boolean(isFeatured),
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      empresa,
      tipoEnvio,
      provinciasPermitidas: provinciasPermitidas || [],
      provinciasRestringidas: provinciasRestringidas || [],
    });

    await newShippingMethod.save();

    return res.status(201).json(newShippingMethod);
  } catch (error) {
    console.error("Error al crear el método de envío:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};


// OBTENER TODOS LOS MÉTODOS DE ENVÍO EXCEPTO LOS NO VISIBLES
const getShippingMethods = async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const shouldPaginate =
      Number.isFinite(rawPage) || Number.isFinite(rawLimit) || req.query.paginated === "true";

    if (shouldPaginate) {
      const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
      const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 10));
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        shippingMethodModel
          .find()
          .sort({ isFeatured: -1, priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        shippingMethodModel.countDocuments()
      ]);

      return res.status(200).json({
        ok: true,
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      });
    }

    const shippingMethods = await shippingMethodModel
      .find()
      .sort({ isFeatured: -1, priority: -1, createdAt: -1 });

    if (!shippingMethods || shippingMethods.length === 0) {
      return res.status(404).json({ message: "No shipping methods found" });
    }

    return res.status(200).json(shippingMethods);
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

const getShippingMethodById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID de metodo de envio invalido" });
    }
    const method = await shippingMethodModel.findById(id);

    if (!method) {
      return res.status(404).json({ error: "Metodo de envio no encontrado" });
    }

    return res.status(200).json(method);
  } catch (error) {
    console.error("Error fetching shipping method by id:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// filtrarMetodosPorProvincia
// filtrarMetodosPorProvincia
const getAvailableShippingMethods = async (req, res) => {
  try {
    const uid = req.uid || req.query.uid;
    const direccionIndex = parseInt(req.query.direccionIndex) || 0;

    if (!uid) {
      return res.status(400).json({ error: "Falta el UID del usuario." });
    }

    const usuario = await userModel.findById(uid);

    if (!usuario || !Array.isArray(usuario.address) || usuario.address.length === 0) {
      return res.status(404).json({ error: "El usuario no tiene direcciones registradas." });
    }

    if (direccionIndex < 0 || direccionIndex >= usuario.address.length) {
      return res.status(400).json({ error: "Índice de dirección inválido." });
    }

    const direccionSeleccionada = usuario.address[direccionIndex];

    if (
      !direccionSeleccionada ||
      !direccionSeleccionada.provincia ||
      typeof direccionSeleccionada.provincia !== "string"
    ) {
      return res.status(400).json({ error: "Dirección inválida o sin provincia definida." });
    }

    const provinciaCliente = direccionSeleccionada.provincia.trim().toUpperCase();
    console.log(`🚚 Provincia del cliente: ${provinciaCliente}`);

    const todosLosMetodos = await shippingMethodModel.find({ visible: true });
    console.log(`📦 Métodos visibles encontrados: ${todosLosMetodos.length}`);

    const metodosFiltrados = todosLosMetodos.filter((metodo) => {
      const { provinciasPermitidas = [], provinciasRestringidas = [] } = metodo;

      if (provinciasPermitidas.length > 0 && !provinciasPermitidas.includes(provinciaCliente)) {
        return false;
      }

      if (provinciasRestringidas.length > 0 && provinciasRestringidas.includes(provinciaCliente)) {
        return false;
      }

      return true;
    });

    console.log(`✅ Métodos de envío disponibles para ${provinciaCliente}: ${metodosFiltrados.length}`);

    return res.status(200).json(metodosFiltrados);
  } catch (error) {
    console.error("❌ Error obteniendo métodos de envío:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};

const patchShippingMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "costo",
      "descripcion",
      "tiempoEstimado",
      "visible",
      "isFeatured",
      "priority",
      "empresa",
      "tipoEnvio",
      "provinciasPermitidas",
      "provinciasRestringidas"
    ];

    const incoming = req.body || {};
    const patch = {};

    Object.keys(incoming).forEach((key) => {
      if (allowedFields.includes(key)) {
        patch[key] = incoming[key];
      }
    });

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No hay campos validos para actualizar" });
    }

    if (patch.costo !== undefined) {
      if (typeof patch.costo !== "number" || patch.costo < 0) {
        return res.status(400).json({ error: "costo invalido" });
      }
    }

    if (patch.descripcion !== undefined) {
      if (!String(patch.descripcion || "").trim()) {
        return res.status(400).json({ error: "descripcion invalida" });
      }
      patch.descripcion = String(patch.descripcion).trim();
    }

    if (patch.empresa !== undefined) {
      if (!String(patch.empresa || "").trim()) {
        return res.status(400).json({ error: "empresa invalida" });
      }
      patch.empresa = String(patch.empresa).trim();
    }

    if (patch.tipoEnvio !== undefined) {
      if (!String(patch.tipoEnvio || "").trim()) {
        return res.status(400).json({ error: "tipoEnvio invalido" });
      }
      patch.tipoEnvio = String(patch.tipoEnvio).trim();
    }

    if (patch.tiempoEstimado !== undefined) {
      patch.tiempoEstimado = String(patch.tiempoEstimado || "").trim();
    }

    if (patch.visible !== undefined) patch.visible = Boolean(patch.visible);
    if (patch.isFeatured !== undefined) patch.isFeatured = Boolean(patch.isFeatured);

    if (patch.priority !== undefined) {
      patch.priority = Number(patch.priority);
      if (!Number.isFinite(patch.priority)) {
        return res.status(400).json({ error: "priority invalido" });
      }
    }

    if (patch.provinciasPermitidas !== undefined) {
      if (!Array.isArray(patch.provinciasPermitidas)) {
        return res.status(400).json({ error: "provinciasPermitidas debe ser un array" });
      }
      patch.provinciasPermitidas = patch.provinciasPermitidas.map(normalizeProvince);
    }

    if (patch.provinciasRestringidas !== undefined) {
      if (!Array.isArray(patch.provinciasRestringidas)) {
        return res.status(400).json({ error: "provinciasRestringidas debe ser un array" });
      }
      patch.provinciasRestringidas = patch.provinciasRestringidas.map(normalizeProvince);
    }

    const updated = await shippingMethodModel.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ error: "Metodo de envio no encontrado" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error actualizando metodo de envio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

const deleteShippingMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await shippingMethodModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Metodo de envio no encontrado" });
    }

    return res.status(200).json({ ok: true, message: "Metodo de envio eliminado" });
  } catch (error) {
    console.error("Error eliminando metodo de envio:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

const getShippingMethodHighlights = async (req, res) => {
  try {
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 3));
    const province = normalizeProvince(req.query.provincia || req.query.province || "");

    const methods = await shippingMethodModel
      .find({ visible: true })
      .sort({ isFeatured: -1, priority: -1, costo: 1, createdAt: -1 })
      .lean();

    const items = methods
      .filter((method) => isMethodAvailableForProvince(method, province))
      .slice(0, limit)
      .map((method) => ({
        id: method._id,
        delivery: method.empresa || "Delivery",
        type: method.tipoEnvio,
        howLong: method.tiempoEstimado || method.descripcion || "",
        howMuch: method.costo,
        currency: "USD"
      }));

    return res.status(200).json({
      ok: true,
      total: items.length,
      items
    });
  } catch (error) {
    console.error("Error fetching shipping highlights:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  confg,
  getShippingAddresses,
  // METODOS DE ENVIO
  createShippingMethod,
  patchShippingMethod,
  deleteShippingMethod,
  getShippingMethods,
  getShippingMethodById,
  getAvailableShippingMethods,
  getShippingMethodHighlights
};
