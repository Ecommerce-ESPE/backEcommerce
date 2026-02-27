const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeLooseText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sanitizeSearchTerm = (q, maxLength = 80) => {
  const normalized = String(q || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
};

const clampInteger = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const buildSearchRegex = (term, mode = "contains") => {
  const escaped = escapeRegex(term);
  if (!escaped) return null;
  if (mode === "exact") return new RegExp(`^${escaped}$`, "i");
  if (mode === "prefix") return new RegExp(`^${escaped}`, "i");
  return new RegExp(escaped, "i");
};

const extractBrandLabel = (brandValue) => {
  if (!brandValue) return "";
  if (typeof brandValue === "string") return brandValue;
  if (typeof brandValue === "object") return brandValue.name || brandValue.slug || "";
  return "";
};

const computeSuggestionScore = (item, term) => {
  const normalizedTerm = normalizeLooseText(term);
  if (!normalizedTerm) return 0;

  const name = normalizeLooseText(item?.nameProduct);
  const slug = normalizeLooseText(item?.slug);
  const brand = normalizeLooseText(extractBrandLabel(item?.brand));
  const description = normalizeLooseText(item?.description);

  const exactNameOrSlug = name === normalizedTerm || slug === normalizedTerm;
  if (exactNameOrSlug) return 300;

  const prefixNameOrSlug =
    (name && name.startsWith(normalizedTerm)) ||
    (slug && slug.startsWith(normalizedTerm));
  if (prefixNameOrSlug) return 200;

  const containsNameOrSlug =
    (name && name.includes(normalizedTerm)) ||
    (slug && slug.includes(normalizedTerm));
  if (containsNameOrSlug) return 100;

  if (brand === normalizedTerm) return 90;
  if (brand && brand.startsWith(normalizedTerm)) return 80;
  if (brand && brand.includes(normalizedTerm)) return 70;
  if (description && description.startsWith(normalizedTerm)) return 60;
  if (description && description.includes(normalizedTerm)) return 50;

  return 0;
};

module.exports = {
  escapeRegex,
  normalizeLooseText,
  sanitizeSearchTerm,
  clampInteger,
  buildSearchRegex,
  extractBrandLabel,
  computeSuggestionScore,
};
