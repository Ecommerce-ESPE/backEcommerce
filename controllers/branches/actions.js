const { branchModel } = require("../../models/index");

const BRANCH_ID_RE = /^[A-Za-z0-9_-]{2,40}$/;

const normalizeBranchId = (value = "") => String(value).trim();

const listBranches = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branches = await branchModel.find({ tenantId }).sort({ createdAt: 1 }).lean();
    return res.json({ ok: true, data: branches, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo sucursales"
    });
  }
};

const getBranchById = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = normalizeBranchId(req.params.branchId);
    const branch = await branchModel.findOne({ tenantId, branchId }).lean();
    if (!branch) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Sucursal no encontrada"
      });
    }
    return res.json({ ok: true, data: branch, message: "OK" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error obteniendo sucursal"
    });
  }
};

const createBranch = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const config = req.tenantConfig;
    if (!config?.operations?.multiBranchEnabled) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "Habilite operations.multiBranchEnabled para crear sucursales"
      });
    }

    const { branchId, code, name, address, contact, invoicing } = req.body || {};
    const normalizedBranchId = normalizeBranchId(branchId);

    if (!normalizedBranchId || !BRANCH_ID_RE.test(normalizedBranchId)) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "branchId invalido (2-40 chars, letras, numeros, _ o -)"
      });
    }
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "name es requerido"
      });
    }

    const exists = await branchModel.findOne({ tenantId, branchId: normalizedBranchId }).lean();
    if (exists) {
      return res.status(409).json({
        ok: false,
        data: null,
        message: "Ya existe una sucursal con ese branchId"
      });
    }

    const branch = await branchModel.create({
      tenantId,
      branchId: normalizedBranchId,
      code: code || "",
      name: String(name).trim(),
      address: address || {},
      contact: contact || {},
      invoicing: invoicing || {}
    });

    return res.status(201).json({
      ok: true,
      data: branch,
      message: "Sucursal creada"
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: error.message || "Error creando sucursal"
    });
  }
};

const updateBranch = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = normalizeBranchId(req.params.branchId);
    const { code, name, address, contact, invoicing } = req.body || {};

    const update = {};
    if (code !== undefined) update.code = code;
    if (name !== undefined) update.name = String(name).trim();
    if (address !== undefined) update.address = address;
    if (contact !== undefined) update.contact = contact;
    if (invoicing !== undefined) update.invoicing = invoicing;

    if (update.name !== undefined && update.name.length === 0) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "name no puede ser vacio"
      });
    }

    const branch = await branchModel.findOneAndUpdate(
      { tenantId, branchId },
      { $set: update },
      { new: true }
    );

    if (!branch) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Sucursal no encontrada"
      });
    }

    return res.json({
      ok: true,
      data: branch,
      message: "Sucursal actualizada"
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: error.message || "Error actualizando sucursal"
    });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const tenantId = req.tenantId || "DEFAULT";
    const branchId = normalizeBranchId(req.params.branchId);
    const defaultBranchId = req.tenantConfig?.operations?.defaultBranchId || "DEFAULT";
    if (branchId === defaultBranchId) {
      return res.status(400).json({
        ok: false,
        data: null,
        message: "No puede eliminar la sucursal por defecto"
      });
    }

    const deleted = await branchModel.findOneAndDelete({ tenantId, branchId });
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        data: null,
        message: "Sucursal no encontrada"
      });
    }

    return res.json({
      ok: true,
      data: deleted,
      message: "Sucursal eliminada"
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      message: "Error eliminando sucursal"
    });
  }
};

module.exports = {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};
