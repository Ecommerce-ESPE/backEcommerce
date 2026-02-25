const mongoose = require("mongoose");
const { brandModel } = require("../../models/index");
const { slugifyText, ensureUniqueSlug } = require("../../utils/slug");
const cloudinary = require("cloudinary").v2;

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractCloudinaryPublicIdFromUrl = (url = "") => {
  try {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return null;

    const marker = "/upload/";
    const uploadIdx = cleanUrl.indexOf(marker);
    if (uploadIdx === -1) return null;

    let path = cleanUrl.slice(uploadIdx + marker.length);
    path = path.replace(/^v\d+\//, "");

    const lastDot = path.lastIndexOf(".");
    if (lastDot > -1) path = path.slice(0, lastDot);

    return path || null;
  } catch (_) {
    return null;
  }
};

const createBrand = async (req, res) => {
  try {
    const { name, logoUrl = "", website = "" } = req.body;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "El nombre de la marca es requerido",
      });
    }

    const existing = await brandModel.findOne({
      name: new RegExp(`^${escapeRegExp(cleanName)}$`, "i"),
    });
    if (existing) {
      return res.status(409).json({
        code: "409",
        ok: false,
        message: "La marca ya existe",
      });
    }

    const baseSlug =
      cleanName.toLowerCase() === "generic"
        ? "gen"
        : slugifyText(cleanName) || "gen";
    const uniqueSlug = await ensureUniqueSlug(brandModel, baseSlug);

    const brand = await brandModel.create({
      name: cleanName,
      slug: uniqueSlug,
      logoUrl,
      website,
      active: true,
    });

    res.status(201).json({
      code: "201",
      ok: true,
      item: brand,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        code: "409",
        ok: false,
        message: "Slug o nombre duplicado",
      });
    }

    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const getBrands = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const query = {};

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    if (q) {
      const regex = new RegExp(escapeRegExp(q), "i");
      query.$or = [{ name: regex }, { slug: regex }];
    }

    const [items, total] = await Promise.all([
      brandModel.find(query).sort({ name: 1 }).skip(skip).limit(parsedLimit).lean(),
      brandModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 1;

    res.json({
      code: "200",
      ok: true,
      brands: items,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "ID de marca inválido",
      });
    }

    const brand = await brandModel.findById(id).lean();
    if (!brand) {
      return res.status(404).json({
        code: "404",
        ok: false,
        message: "Marca no encontrada",
      });
    }

    res.json({
      code: "200",
      ok: true,
      brand,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "ID de marca inválido",
      });
    }

    const brand = await brandModel.findById(id);

    if (!brand) {
      return res.status(404).json({
        code: "404",
        ok: false,
        message: "Marca no encontrada",
      });
    }

    const publicId =
      (brand.logoPublicId && String(brand.logoPublicId).trim()) ||
      extractCloudinaryPublicIdFromUrl(brand.logoUrl);

    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    await brandModel.findByIdAndDelete(id);

    res.json({
      code: "200",
      ok: true,
      item: brand,
    });
  } catch (error) {
    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, website, active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        code: "400",
        ok: false,
        message: "ID de marca inválido",
      });
    }

    const brand = await brandModel.findById(id);
    if (!brand) {
      return res.status(404).json({
        code: "404",
        ok: false,
        message: "Marca no encontrada",
      });
    }

    if (typeof name !== "undefined") {
      const cleanName = String(name || "").trim();
      if (!cleanName) {
        return res.status(400).json({
          code: "400",
          ok: false,
          message: "El nombre de la marca es requerido",
        });
      }

      const duplicated = await brandModel.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${escapeRegExp(cleanName)}$`, "i"),
      });

      if (duplicated) {
        return res.status(409).json({
          code: "409",
          ok: false,
          message: "La marca ya existe",
        });
      }

      brand.name = cleanName;
      const baseSlug =
        cleanName.toLowerCase() === "generic"
          ? "gen"
          : slugifyText(cleanName) || "gen";
      brand.slug = await ensureUniqueSlug(brandModel, baseSlug, {
        _id: { $ne: brand._id },
      });
    }

    if (typeof logoUrl !== "undefined") {
      brand.logoUrl = String(logoUrl || "").trim();
    }

    if (typeof website !== "undefined") {
      brand.website = String(website || "").trim();
    }

    if (typeof active !== "undefined") {
      brand.active = Boolean(active);
    }

    await brand.save();

    res.json({
      code: "200",
      ok: true,
      item: brand,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        code: "409",
        ok: false,
        message: "Slug o nombre duplicado",
      });
    }

    res.status(500).json({
      code: "500",
      ok: false,
      error: error.message,
    });
  }
};

module.exports = {
  createBrand,
  getBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
};
