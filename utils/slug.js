const slugifyLib = require("slugify");

const slugifyText = (value) =>
  slugifyLib(value || "", { lower: true, strict: true });

const ensureUniqueSlug = async (model, baseSlug, queryExtra = {}) => {
  const safeBase = baseSlug && baseSlug.trim() ? baseSlug.trim() : "gen";
  let slug = safeBase;
  let suffix = 2;

  while (true) {
    const exists = await model
      .findOne({ ...queryExtra, slug })
      .select("_id")
      .lean();

    if (!exists) return slug;

    slug = `${safeBase}-${suffix}`;
    suffix += 1;
  }
};

module.exports = { slugifyText, ensureUniqueSlug };
