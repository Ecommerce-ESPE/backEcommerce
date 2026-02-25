const fs = require('fs');
const path = require('path');

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
    const shippingMethods = await shippingMethodModel.find();

    if (!shippingMethods || shippingMethods.length === 0) {
      return res.status(404).json({ message: "No shipping methods found" });
    }

    return res.status(200).json(shippingMethods);
  } catch (error) {
    console.error("Error fetching shipping methods:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

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
  getShippingMethods,
  getAvailableShippingMethods,
  getShippingMethodHighlights
};
