const { itemModel } = require("../../models/index");
const suggestCache = require("../../services/search/suggestCache");
const {
  normalizeQuery,
  clampInteger,
  buildMatchQuery,
  buildRelevanceExpression,
} = require("../../services/search/searchEngine");

const getSuggest = async (req, res) => {
  const startedAt = Date.now();

  try {
    const normalizedQ = normalizeQuery(req.query.q);
    const limit = clampInteger(req.query.limit, 1, 15, 8);

    if (!normalizedQ || normalizedQ.length < 2) {
      return res.json([]);
    }

    const cacheKey = `${normalizedQ}::${limit}`;
    const cached = suggestCache.get(cacheKey);
    if (cached) {
      console.info(`[search.suggest] q="${normalizedQ}" limit=${limit} cache=hit ms=${Date.now() - startedAt}`);
      return res.json(cached);
    }

    const matchQuery = buildMatchQuery(normalizedQ);
    const relevanceExpr = buildRelevanceExpression(normalizedQ);

    const docs = await itemModel.aggregate([
      { $match: matchQuery },
      { $addFields: { _relevance: relevanceExpr } },
      { $sort: { _relevance: -1, updatedAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          nameProduct: 1,
          slug: 1,
          banner: 1,
          "images.imgUrl": 1,
          thumb: {
            $ifNull: [
              "$banner",
              {
                $ifNull: [{ $arrayElemAt: ["$images.imgUrl", 0] }, null],
              },
            ],
          },
        },
      },
    ]);

    const payload = docs.map((doc) => ({
      type: "product",
      id: doc._id,
      label: doc.nameProduct,
      slug: doc.slug,
      thumb: doc.thumb || null,
    }));

    suggestCache.set(cacheKey, payload);
    console.info(`[search.suggest] q="${normalizedQ}" limit=${limit} cache=miss ms=${Date.now() - startedAt}`);
    return res.json(payload);
  } catch (error) {
    console.error("Error en search suggest:", error);
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo sugerencias",
      items: [],
    });
  }
};

const getResults = async (req, res) => {
  const startedAt = Date.now();

  try {
    const normalizedQ = normalizeQuery(req.query.q);
    const page = clampInteger(req.query.page, 1, 100000, 1);
    const limit = clampInteger(req.query.limit, 1, 100, 12);

    if (!normalizedQ || normalizedQ.length < 2) {
      return res.json({
        ok: true,
        q: normalizedQ || "",
        total: 0,
        page,
        totalPages: 0,
        items: [],
      });
    }

    const skip = (page - 1) * limit;
    const matchQuery = buildMatchQuery(normalizedQ);
    const relevanceExpr = buildRelevanceExpression(normalizedQ);

    const [result] = await itemModel.aggregate([
      { $match: matchQuery },
      { $addFields: { _relevance: relevanceExpr } },
      {
        $facet: {
          items: [
            { $sort: { _relevance: -1, updatedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ],
          meta: [{ $count: "total" }],
        },
      },
    ]);

    const total = Number(result?.meta?.[0]?.total || 0);
    const items = result?.items || [];

    console.info(
      `[search.results] q="${normalizedQ}" page=${page} limit=${limit} total=${total} ms=${Date.now() - startedAt}`
    );

    return res.json({
      ok: true,
      q: normalizedQ,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 0,
      items,
    });
  } catch (error) {
    console.error("Error en search results:", error);
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo resultados",
      items: [],
    });
  }
};

module.exports = {
  getSuggest,
  getResults,
};
