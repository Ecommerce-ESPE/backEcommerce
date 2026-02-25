const restaurant = require("./restaurant");
const hardwareStore = require("./hardware_store");
const retail = require("./retail");
const services = require("./services");
const ecommerce = require("./ecommerce");

const PRESETS = [restaurant, hardwareStore, retail, services, ecommerce];

const PRESET_MAP = PRESETS.reduce((acc, preset) => {
  acc[preset.key] = preset;
  return acc;
}, {});

module.exports = {
  PRESETS,
  PRESET_MAP
};
