const mongoose = require("mongoose");
const { tagModel } = require("../../models/index");
const { slugifyText, ensureUniqueSlug } = require("../../utils/slug");

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createTag = async (req, res) => {
  try {
    const { name } = req.body;
    const cleanName = String(name || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "El nombre del tag es requerido",
      });
    }

    const baseSlug = slugifyText(cleanName);
    if (!baseSlug) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "Nombre de tag inválido",
      });
    }

    const existing = await tagModel.findOne({ slug: baseSlug }).lean();
    if (existing) {
      return res.status(409).json({
        code: "409",
        ok: false,
        message: "El tag ya existe",
      });
    }

    const uniqueSlug = await ensureUniqueSlug(tagModel, baseSlug);
    const tag = await tagModel.create({
      name: cleanName,
      slug: uniqueSlug,
      active: true,
    });

    res.status(201).json({
      code: "201",
      ok: true,
      item: tag,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        code: "409",
        ok: false,
        message: "Slug duplicado",
      });
    }

    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const getTags = async (req, res) => {
  try {
    const { q, includeInactive } = req.query;
    const query = {};

    if (includeInactive !== "true") {
      query.active = true;
    }

    if (q) {
      const regex = new RegExp(escapeRegExp(q), "i");
      query.$or = [{ name: regex }, { slug: regex }];
    }

    const items = await tagModel.find(query).sort({ name: 1 }).lean();

    res.json({
      code: "200",
      ok: true,
      tags: items,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const getTagById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "ID de tag inválido",
      });
    }

    const tag = await tagModel.findById(id).lean();
    if (!tag) {
      return res.status(404).json({
        code: "404",
        ok: false,
        message: "Tag no encontrado",
      });
    }

    res.json({
      code: "200",
      ok: true,
      item: tag,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "ID de tag inválido",
      });
    }

    const tag = await tagModel.findByIdAndUpdate(
      id,
      { active: false },
      { new: true },
    );

    if (!tag) {
      return res.status(404).json({
        code: "404",
        ok: false,
        message: "Tag no encontrado",
      });
    }

    res.json({
      code: "200",
      ok: true,
      item: tag,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

module.exports = {
  createTag,
  getTags,
  getTagById,
  deleteTag,
};
