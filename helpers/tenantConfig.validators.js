const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const DIGITS_RE = /^\d+$/;
const NUMBER_FORMAT_RE = /^(?=.*\{YYYY\})(?=.*\{MM\})(?=.*\{DD\})(?=.*\{SEQ\}).+$/;
const VALID_ROLES = ["CASHIER", "KITCHEN", "DISPATCH", "COURIER", "ADMIN", "MANAGER"];
const MODULE_KEYS = [
  "ecommerceStorefront",
  "pos",
  "queuesTickets",
  "kdsKitchen",
  "dispatch",
  "delivery",
  "promotions",
  "inventory",
  "coupons",
  "reviews",
  "maintenance"
];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

const ensureBooleanFields = (obj, keys, path, details) => {
  if (!obj || typeof obj !== "object") return;
  keys.forEach((key) => {
    if (obj[key] !== undefined && typeof obj[key] !== "boolean") {
      details.push({ path: `${path}.${key}`, message: "Debe ser boolean" });
    }
  });
};

const ensureUniqueKeys = (items, path, details) => {
  const set = new Set();
  items.forEach((item, index) => {
    const key = item?.key;
    if (!key) return;
    if (set.has(key)) {
      details.push({ path: `${path}[${index}].key`, message: "La key debe ser unica" });
      return;
    }
    set.add(key);
  });
};

const validateTenantConfig = (config = {}) => {
  const details = [];

  if (!config?.business?.name || String(config.business.name).trim().length === 0) {
    details.push({ path: "business.name", message: "Requerido y no vacio" });
  }

  if (config?.business?.ruc) {
    const ruc = String(config.business.ruc);
    if (!DIGITS_RE.test(ruc) || ![10, 13].includes(ruc.length)) {
      details.push({ path: "business.ruc", message: "Debe contener 10 o 13 digitos" });
    }
  }

  const theme = config?.branding?.theme || {};
  ["primary", "secondary", "accent"].forEach((key) => {
    if (theme[key] !== undefined && !HEX_COLOR_RE.test(String(theme[key]))) {
      details.push({ path: `branding.theme.${key}`, message: "Debe ser color HEX #RRGGBB" });
    }
  });

  if (config?.tax?.iva?.defaultRate !== undefined) {
    config.tax.iva.defaultRate = round3(config.tax.iva.defaultRate);
    if (
      Number.isNaN(Number(config.tax.iva.defaultRate)) ||
      config.tax.iva.defaultRate < 0 ||
      config.tax.iva.defaultRate > 1
    ) {
      details.push({ path: "tax.iva.defaultRate", message: "Debe estar entre 0 y 1" });
    }
  }

  ensureBooleanFields(config.modules, MODULE_KEYS, "modules", details);
  ensureBooleanFields(
    config?.sales?.orderTypesEnabled,
    ["pickup", "delivery", "dineIn"],
    "sales.orderTypesEnabled",
    details
  );
  ensureBooleanFields(
    config?.sales?.paymentMethods,
    ["cash", "card", "transfer"],
    "sales.paymentMethods",
    details
  );
  ensureBooleanFields(
    config?.maintenance,
    [
      "storeMaintenanceMode",
      "disableStorefront",
      "disablePOS",
      "allowAdminAccess",
      "equipmentTracking"
    ],
    "maintenance",
    details
  );

  const queues = Array.isArray(config?.operations?.queues) ? config.operations.queues : [];
  ensureUniqueKeys(queues, "operations.queues", details);
  queues.forEach((queue, index) => {
    if (!queue?.label || String(queue.label).trim().length === 0) {
      details.push({ path: `operations.queues[${index}].label`, message: "Label requerido" });
    }
    if (queue?.ticketPrefix !== undefined) {
      const prefix = String(queue.ticketPrefix);
      if (prefix.length < 1 || prefix.length > 3) {
      details.push({
        path: `operations.queues[${index}].ticketPrefix`,
        message: "Ticket prefix debe tener entre 1 y 3 caracteres"
      });
      }
    }
  });

  const stages = Array.isArray(config?.operations?.workflow?.stages)
    ? config.operations.workflow.stages
    : [];
  ensureUniqueKeys(stages, "operations.workflow.stages", details);
  stages.forEach((stage, index) => {
    if (!VALID_ROLES.includes(stage?.role)) {
      details.push({
        path: `operations.workflow.stages[${index}].role`,
        message: `Rol invalido. Permitidos: ${VALID_ROLES.join(", ")}`
      });
    }
  });

  const orderFormat = config?.numbers?.orderNumber?.format;
  if (orderFormat !== undefined && !NUMBER_FORMAT_RE.test(String(orderFormat))) {
    details.push({
      path: "numbers.orderNumber.format",
      message: "Debe incluir placeholders {YYYY}{MM}{DD}{SEQ}"
    });
  }

  const ticketFormat = config?.numbers?.ticketNumber?.format;
  if (ticketFormat !== undefined && !NUMBER_FORMAT_RE.test(String(ticketFormat))) {
    details.push({
      path: "numbers.ticketNumber.format",
      message: "Debe incluir placeholders {YYYY}{MM}{DD}{SEQ}"
    });
  }

  if (
    config?.maintenance?.maintenanceMessage !== undefined &&
    String(config.maintenance.maintenanceMessage).length > 200
  ) {
    details.push({
      path: "maintenance.maintenanceMessage",
      message: "Maximo 200 caracteres"
    });
  }

  return {
    valid: details.length === 0,
    details,
    sanitized: config
  };
};

module.exports = {
  validateTenantConfig,
  round2,
  round3,
  VALID_ROLES,
  MODULE_KEYS
};
