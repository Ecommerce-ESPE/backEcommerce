const { deepMerge } = require("./deepMerge");

const CONTROLLED_SECTIONS = [
  "modules",
  "sales",
  "operations",
  "tax",
  "numbers",
  "invoice"
];

const applyPreset = (config, preset, mode = "merge", defaultTemplate = {}) => {
  const current = typeof config.toObject === "function" ? config.toObject() : config;
  const patch = preset?.configPatch || {};

  let result;
  if (mode === "replace") {
    result = { ...current };
    CONTROLLED_SECTIONS.forEach((section) => {
      const defaultSection = defaultTemplate[section] || current[section] || {};
      const presetSection = patch[section] || {};
      result[section] = deepMerge(defaultSection, presetSection);
    });
  } else {
    result = deepMerge(current, patch);
  }

  result.business = {
    ...(result.business || {}),
    industryMode: preset.key
  };
  return result;
};

module.exports = {
  applyPreset,
  CONTROLLED_SECTIONS
};
