const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeQuery = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const clampInteger = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const buildSearchRegex = (normalizedQ) => {
  const escaped = escapeRegex(normalizedQ);
  return {
    prefixRegex: new RegExp(`^${escaped}`),
    containsRegex: new RegExp(escaped),
  };
};

const buildMatchQuery = (normalizedQ) => {
  const { prefixRegex, containsRegex } = buildSearchRegex(normalizedQ);
  return {
    visibility: true,
    $or: [
      { nameProductLower: prefixRegex },
      { nameProductLower: containsRegex },
      { slug: prefixRegex },
      { slug: containsRegex },
      { description: containsRegex },
    ],
  };
};

const buildRelevanceExpression = (normalizedQ) => {
  const { prefixRegex, containsRegex } = buildSearchRegex(normalizedQ);
  return {
    $switch: {
      branches: [
        { case: { $regexMatch: { input: "$nameProductLower", regex: prefixRegex } }, then: 300 },
        { case: { $regexMatch: { input: "$slug", regex: prefixRegex, options: "i" } }, then: 260 },
        { case: { $regexMatch: { input: "$nameProductLower", regex: containsRegex } }, then: 200 },
        { case: { $regexMatch: { input: "$slug", regex: containsRegex, options: "i" } }, then: 170 },
        { case: { $regexMatch: { input: "$description", regex: containsRegex, options: "i" } }, then: 120 },
      ],
      default: 0,
    },
  };
};

module.exports = {
  normalizeQuery,
  clampInteger,
  buildSearchRegex,
  buildMatchQuery,
  buildRelevanceExpression,
};
