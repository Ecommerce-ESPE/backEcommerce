const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const deepMerge = (base, patch) => {
  if (!isPlainObject(base)) return patch;
  if (!isPlainObject(patch)) return patch;

  const result = { ...base };
  Object.keys(patch).forEach((key) => {
    const patchValue = patch[key];
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMerge(baseValue, patchValue);
      return;
    }
    result[key] = patchValue;
  });
  return result;
};

module.exports = { deepMerge, isPlainObject };
