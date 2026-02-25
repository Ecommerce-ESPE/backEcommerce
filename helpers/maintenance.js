const isMaintenanceModeEnabled = (config) =>
  Boolean(config?.modules?.maintenance) &&
  config?.maintenance?.storeMaintenanceMode === true;

module.exports = { isMaintenanceModeEnabled };
