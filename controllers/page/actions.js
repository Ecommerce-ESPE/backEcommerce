const mongoose = require("mongoose");
const slugify = require("slugify");
const {
  itemModel,
  categoryModel,
  bannerHeroModel,
  bannerPromotionModel,
} = require("../../models/index");

const escapeRegExp = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePath = (pathname = "") => {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const buildSortQuery = (sort) => {
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

  return sortOptions[sort] || { createdAt: -1 };
};

const getPromoState = (banner) => {
  if (!banner) {
    return { active: false, estado: "finalizado" };
  }

  const now = new Date();
  const start = banner.startDate ? new Date(banner.startDate) : null;
  const end = banner.endDate ? new Date(banner.endDate) : null;

  if (start && end) {
    if (now < start) return { active: false, estado: "proximo" };
    if (now > end) return { active: false, estado: "finalizado" };
    return { active: true, estado: "enCurso" };
  }

  if (typeof banner.active === "boolean") {
    return {
      active: banner.active,
      estado: banner.active ? "enCurso" : "proximo",
    };
  }

  return { active: false, estado: "proximo" };
};

const resolveCategoryBySegment = async (segment) => {
  if (!segment) return null;

  if (mongoose.Types.ObjectId.isValid(segment)) {
    return categoryModel.findById(segment).lean();
  }

  const normalized = segment.replace(/-/g, " ").trim();

  const directMatch = await categoryModel
    .findOne({ name: new RegExp(`^${escapeRegExp(normalized)}$`, "i") })
    .lean();

  if (directMatch) return directMatch;

  const categories = await categoryModel.find().lean();
  const targetSlug = slugify(segment, { lower: true, strict: true });

  return (
    categories.find(
      (cat) => slugify(cat.name || "", { lower: true, strict: true }) === targetSlug
    ) || null
  );
};

const resolveSubcategoryBySegment = (category, segment) => {
  if (!category || !segment) return null;

  const subcategories = Array.isArray(category.subcategories)
    ? category.subcategories
    : [];

  if (mongoose.Types.ObjectId.isValid(segment)) {
    return (
      subcategories.find((sub) => String(sub._id) === String(segment)) || null
    );
  }

  const normalized = segment.replace(/-/g, " ").trim().toLowerCase();
  const targetSlug = slugify(segment, { lower: true, strict: true });

  return (
    subcategories.find((sub) => {
      const name = (sub.name || "").toLowerCase();
      return (
        name === normalized ||
        slugify(sub.name || "", { lower: true, strict: true }) === targetSlug
      );
    }) || null
  );
};

const resolvePage = async (req, res) => {
  try {
    const href = req.query.href || req.body?.href;

    if (!href || typeof href !== "string") {
      return res.status(400).json({
        ok: false,
        code: "400",
        message: "El parametro href es requerido",
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(href, "http://resolver.local");
    } catch (error) {
      return res.status(400).json({
        ok: false,
        code: "400",
        message: "Href invalido",
      });
    }

    const pathname = normalizePath(parsedUrl.pathname);
    const segments = pathname.split("/").filter(Boolean);
    const sort = parsedUrl.searchParams.get("sort") || req.query.sort;
    const safeNumber = (value, fallback) => {
      const parsed = parseInt(value, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const page = safeNumber(
      parsedUrl.searchParams.get("page") || req.query.page,
      1
    );
    const limit = safeNumber(
      parsedUrl.searchParams.get("limit") || req.query.limit,
      12
    );

    const pathCategoryIndex = segments.findIndex(
      (seg) => seg === "category" || seg === "categoria"
    );

    const categorySegment =
      pathCategoryIndex >= 0 ? segments[pathCategoryIndex + 1] : null;
    const subcategorySegment =
      pathCategoryIndex >= 0 ? segments[pathCategoryIndex + 2] : null;

    let pageType = "products";
    if (categorySegment) {
      pageType = subcategorySegment ? "subcategory" : "category";
    }

    const hrefCandidates =
      pathname === "/"
        ? ["/"]
        : [pathname, pathname.endsWith("/") ? pathname.slice(0, -1) : `${pathname}/`];

    const [promoBanner, heroBanner] = await Promise.all([
      bannerPromotionModel
        .findOne({ href: { $in: hrefCandidates } })
        .sort({ startDate: -1 })
        .lean(),
      bannerHeroModel
        .findOne({
          href: { $in: hrefCandidates },
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
          visible: true,
        })
        .sort({ startDate: -1 })
        .lean(),
    ]);

    const promoState = getPromoState(promoBanner);
    if (promoState.active && promoBanner && promoBanner.tipo === "promo") {
      pageType = "promo";
    }

    const promoProductIds =
      promoState.active && promoBanner?.products ? promoBanner.products : [];
    const promoSubcategoryIds =
      promoState.active && promoBanner?.subcategories
        ? promoBanner.subcategories
        : [];
    const promoCategoryIds =
      promoState.active && promoBanner?.categories ? promoBanner.categories : [];
    const promoApplyAll =
      promoState.active && promoBanner?.applyAll === true;

    let category = null;
    let subcategory = null;

    if (promoCategoryIds.length > 0) {
      category = await categoryModel.findById(promoCategoryIds[0]).lean();
      if (category && subcategorySegment) {
        subcategory = resolveSubcategoryBySegment(category, subcategorySegment);
      }
    } else if (promoSubcategoryIds.length > 0) {
      category = await categoryModel
        .findOne({ "subcategories._id": promoSubcategoryIds[0] })
        .lean();
      if (category) {
        if (subcategorySegment) {
          subcategory = resolveSubcategoryBySegment(
            category,
            subcategorySegment
          );
        } else {
          subcategory =
            category.subcategories?.find(
              (sub) =>
                String(sub._id) === String(promoSubcategoryIds[0])
            ) || null;
        }
      }
    } else if (categorySegment || parsedUrl.searchParams.get("category")) {
      category = await resolveCategoryBySegment(
        categorySegment || parsedUrl.searchParams.get("category")
      );
      subcategory = resolveSubcategoryBySegment(
        category,
        subcategorySegment || parsedUrl.searchParams.get("subcategory")
      );
    }

    const andFilters = [{ visibility: true }];

    if (promoProductIds.length) {
      andFilters.push({ _id: { $in: promoProductIds } });
    } else if (promoSubcategoryIds.length) {
      andFilters.push({ subcategory: { $in: promoSubcategoryIds } });
    } else if (promoCategoryIds.length) {
      andFilters.push({ category: { $in: promoCategoryIds } });
    } else if (!promoApplyAll) {
      if (category?._id) andFilters.push({ category: category._id });
      if (subcategory?._id) andFilters.push({ subcategory: subcategory._id });
    }

    const query =
      andFilters.length > 1 ? { $and: andFilters } : andFilters[0];

    const skip = (page - 1) * limit;
    const sortQuery = buildSortQuery(sort);

    const [items, total] = await Promise.all([
      itemModel
        .find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate("category", "name")
        .lean(),
      itemModel.countDocuments(query),
    ]);

    let products = items;

    const subcategoryList =
      category && Array.isArray(category.subcategories)
        ? category.subcategories
        : [];

    if (category && subcategoryList.length > 0) {
      const subcategoryMap = new Map(
        subcategoryList.map((sub) => [String(sub._id), sub])
      );
      products = products.map((item) => ({
        ...item,
        subcategory: subcategoryMap.get(String(item.subcategory)) || null,
      }));
    }

    if (
      promoState.active &&
      typeof promoBanner?.promotionPercentage === "number"
    ) {
      const percentage = promoBanner.promotionPercentage;
      products = products.map((item) => {
        const variants = Array.isArray(item.value) ? item.value : [];
        const pricedVariants = variants.map((variant) => {
          if (typeof variant.originalPrice !== "number") return variant;
          const discount = variant.originalPrice * (percentage / 100);
          const promoPrice = Number(
            (variant.originalPrice - discount).toFixed(2)
          );
          return { ...variant, promoPrice };
        });

        const originals = pricedVariants
          .map((variant) => variant.originalPrice)
          .filter((value) => typeof value === "number");
        const promos = pricedVariants
          .map((variant) => variant.promoPrice)
          .filter((value) => typeof value === "number");

        const originalMin =
          originals.length > 0 ? Math.min(...originals) : null;
        const promoMin = promos.length > 0 ? Math.min(...promos) : null;

        return {
          ...item,
          value: pricedVariants,
          pricing: {
            original: originalMin,
            promo: promoMin,
            percentage,
          },
        };
      });
    }

    return res.status(200).json({
      ok: true,
      code: "200",
      href,
      path: pathname,
      pageType,
      banner: heroBanner || null,
      promo: promoBanner
        ? { ...promoBanner, active: promoState.active, estado: promoState.estado }
        : null,
      category: category || null,
      subcategory: subcategory || null,
      subcategories: category?.subcategories || [],
      products,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
      promotionApplied:
        promoState.active && typeof promoBanner?.promotionPercentage === "number"
          ? {
              percentage: promoBanner.promotionPercentage,
              startDate: promoBanner.startDate || null,
              endDate: promoBanner.endDate || null,
            }
          : null,
    });
  } catch (error) {
    console.error("Error resolving page:", error);
    res.status(500).json({
      ok: false,
      code: "500",
      message: "Error al resolver la pagina",
      error: error.message,
    });
  }
};

module.exports = {
  resolvePage,
};
