const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const DIGITS_RE = /^\d+$/;
const NUMBER_FORMAT_RE = /^(?=.*\{SEQ\}).+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const CIDR_RE = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})\/([0-9]|[1-2][0-9]|3[0-2])$/;
const VALID_RESETS = ["daily", "monthly", "yearly", "never"];
const VALID_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];
const VALID_CONTACT_SOURCE = ["business.contact", "footer.contact"];
const VALID_NOTIFICATION_EVENTS = [
  "order_created",
  "order_paid",
  "order_preparing",
  "order_ready",
  "order_dispatched",
  "order_delivered",
  "invoice_generated"
];
const VALID_NOTIFICATION_CHANNELS = ["email", "whatsapp", "sms", "push", "internal"];
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

const validateMaintenanceRoutes = (routes, path, details) => {
  if (routes === undefined) return;
  if (!Array.isArray(routes)) {
    details.push({ path, message: "Debe ser un array" });
    return;
  }
  if (routes.length > 50) {
    details.push({ path, message: "Maximo 50 rutas permitidas" });
    return;
  }

  routes.forEach((route, index) => {
    const value = String(route || "").trim();
    if (!value) {
      details.push({ path: `${path}[${index}]`, message: "Ruta no puede estar vacia" });
      return;
    }
    if (!value.startsWith("/")) {
      details.push({
        path: `${path}[${index}]`,
        message: "La ruta debe iniciar con /"
      });
      return;
    }
    if (value.length > 120) {
      details.push({
        path: `${path}[${index}]`,
        message: "Ruta demasiado larga (max 120)"
      });
      return;
    }
    if (["/", "/api", "/api/"].includes(value)) {
      details.push({
        path: `${path}[${index}]`,
        message: "Ruta demasiado amplia, usa rutas especificas"
      });
    }
  });
};

const validateBusinessContact = (config, details) => {
  const contact = config?.business?.contact;
  if (!contact) return;

  if (contact.email && !EMAIL_RE.test(String(contact.email).trim())) {
    details.push({ path: "business.contact.email", message: "Email invalido" });
  }
  if (contact.website && !URL_RE.test(String(contact.website).trim())) {
    details.push({ path: "business.contact.website", message: "URL invalida" });
  }
  if (contact.googleMapsUrl && !URL_RE.test(String(contact.googleMapsUrl).trim())) {
    details.push({ path: "business.contact.googleMapsUrl", message: "URL invalida" });
  }
};

const validateHours = (config, details) => {
  const hours = config?.hours || {};
  const weekly = Array.isArray(hours.weekly) ? hours.weekly : [];
  const daySet = new Set();
  weekly.forEach((entry, index) => {
    if (!VALID_DAYS.includes(entry?.day)) {
      details.push({ path: `hours.weekly[${index}].day`, message: "Dia invalido" });
      return;
    }
    if (daySet.has(entry.day)) {
      details.push({ path: `hours.weekly[${index}].day`, message: "Dia duplicado" });
    }
    daySet.add(entry.day);

    if (entry?.enabled !== false) {
      if (!TIME_RE.test(String(entry.open || ""))) {
        details.push({ path: `hours.weekly[${index}].open`, message: "Formato HH:mm" });
      }
      if (!TIME_RE.test(String(entry.close || ""))) {
        details.push({ path: `hours.weekly[${index}].close`, message: "Formato HH:mm" });
      }
      if (TIME_RE.test(String(entry.open || "")) && TIME_RE.test(String(entry.close || ""))) {
        if (String(entry.open) >= String(entry.close)) {
          details.push({
            path: `hours.weekly[${index}]`,
            message: "Hora apertura debe ser menor que cierre"
          });
        }
      }
    }
  });

  const specialDates = Array.isArray(hours.specialDates) ? hours.specialDates : [];
  specialDates.forEach((entry, index) => {
    if (!DATE_RE.test(String(entry?.date || ""))) {
      details.push({ path: `hours.specialDates[${index}].date`, message: "Formato YYYY-MM-DD" });
    }
    if (!entry?.closed) {
      if (!TIME_RE.test(String(entry?.open || ""))) {
        details.push({ path: `hours.specialDates[${index}].open`, message: "Formato HH:mm" });
      }
      if (!TIME_RE.test(String(entry?.close || ""))) {
        details.push({ path: `hours.specialDates[${index}].close`, message: "Formato HH:mm" });
      }
    }
  });
};

const validateCheckout = (config, details) => {
  const checkout = config?.checkout || {};
  ensureBooleanFields(
    checkout,
    [
      "guestCheckoutEnabled",
      "requireIdentification",
      "requirePhone",
      "orderNotesEnabled",
      "tipEnabled"
    ],
    "checkout",
    details
  );
  ensureBooleanFields(
    checkout?.requireAddressByOrderType,
    ["delivery", "pickup", "dineIn"],
    "checkout.requireAddressByOrderType",
    details
  );
};

const validateNotifications = (config, details) => {
  const notifications = config?.notifications || {};
  ensureBooleanFields(
    notifications?.channels,
    VALID_NOTIFICATION_CHANNELS,
    "notifications.channels",
    details
  );

  const events = notifications?.events || {};
  Object.keys(events).forEach((eventKey) => {
    if (!VALID_NOTIFICATION_EVENTS.includes(eventKey)) {
      details.push({
        path: `notifications.events.${eventKey}`,
        message: "Evento no soportado"
      });
      return;
    }
    ensureBooleanFields(
      events[eventKey],
      VALID_NOTIFICATION_CHANNELS,
      `notifications.events.${eventKey}`,
      details
    );
  });
};

const validateIntegrations = (config, details) => {
  const integrations = config?.integrations || {};
  ["payments", "sri", "whatsapp", "email", "maps"].forEach((key) => {
    const item = integrations?.[key];
    if (!item) return;
    if (item.enabled !== undefined && typeof item.enabled !== "boolean") {
      details.push({ path: `integrations.${key}.enabled`, message: "Debe ser boolean" });
    }
    if (item.enabled === true && !String(item.provider || "").trim()) {
      details.push({
        path: `integrations.${key}.provider`,
        message: "Provider requerido cuando enabled=true"
      });
    }
    if (
      item.provider !== undefined &&
      String(item.provider).trim().length > 50
    ) {
      details.push({
        path: `integrations.${key}.provider`,
        message: "Provider demasiado largo"
      });
    }
  });
};

const validateSecurity = (config, details) => {
  const security = config?.security || {};
  const session = security?.session || {};
  const rateLimits = security?.rateLimits || {};
  const abuseProtection = security?.abuseProtection || {};
  ensureBooleanFields(session, ["rememberMeEnabled"], "security.session", details);
  ensureBooleanFields(
    security?.ipSecurity,
    ["whitelistEnabled", "adminOnlyIpRestriction"],
    "security.ipSecurity",
    details
  );
  ensureBooleanFields(
    security?.audit,
    ["enabled", "logConfigChanges", "logAdminActions"],
    "security.audit",
    details
  );
  ensureBooleanFields(
    security?.authRules,
    ["requireReauthForSensitiveChanges", "requireTenantAdminRoleForConfigChanges"],
    "security.authRules",
    details
  );

  if (
    session.sessionTimeoutMinutes !== undefined &&
    (!Number.isFinite(Number(session.sessionTimeoutMinutes)) ||
      Number(session.sessionTimeoutMinutes) < 5 ||
      Number(session.sessionTimeoutMinutes) > 1440)
  ) {
    details.push({
      path: "security.session.sessionTimeoutMinutes",
      message: "Debe estar entre 5 y 1440"
    });
  }
  if (
    session.maxConcurrentSessions !== undefined &&
    (!Number.isFinite(Number(session.maxConcurrentSessions)) ||
      Number(session.maxConcurrentSessions) < 1 ||
      Number(session.maxConcurrentSessions) > 20)
  ) {
    details.push({
      path: "security.session.maxConcurrentSessions",
      message: "Debe estar entre 1 y 20"
    });
  }

  const allowedIps = Array.isArray(security?.ipSecurity?.allowedIps)
    ? security.ipSecurity.allowedIps
    : [];
  allowedIps.forEach((value, index) => {
    const ip = String(value || "").trim();
    if (!IPV4_RE.test(ip) && !CIDR_RE.test(ip)) {
      details.push({
        path: `security.ipSecurity.allowedIps[${index}]`,
        message: "IP/CIDR invalido"
      });
    }
  });

  ["loginAttempts", "patchConfigAttempts", "checkoutAttempts"].forEach((key) => {
    const value = rateLimits?.[key];
    if (
      value !== undefined &&
      (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 1000)
    ) {
      details.push({
        path: `security.rateLimits.${key}`,
        message: "Debe estar entre 1 y 1000"
      });
    }
  });

  if (
    abuseProtection.blockDurationSec !== undefined &&
    (!Number.isFinite(Number(abuseProtection.blockDurationSec)) ||
      Number(abuseProtection.blockDurationSec) < 30 ||
      Number(abuseProtection.blockDurationSec) > 86400)
  ) {
    details.push({
      path: "security.abuseProtection.blockDurationSec",
      message: "Debe estar entre 30 y 86400"
    });
  }
  if (
    abuseProtection.maxConcurrentCheckout !== undefined &&
    (!Number.isFinite(Number(abuseProtection.maxConcurrentCheckout)) ||
      Number(abuseProtection.maxConcurrentCheckout) < 1 ||
      Number(abuseProtection.maxConcurrentCheckout) > 500)
  ) {
    details.push({
      path: "security.abuseProtection.maxConcurrentCheckout",
      message: "Debe estar entre 1 y 500"
    });
  }
  ensureBooleanFields(
    abuseProtection,
    ["slowdownEnabled"],
    "security.abuseProtection",
    details
  );
};

const validateBackup = (config, details) => {
  const policy = config?.backup?.policy || {};
  const drills = config?.backup?.restoreDrills || {};

  ensureBooleanFields(
    policy,
    ["enabled", "notifyOnSuccess", "notifyOnFailure"],
    "backup.policy",
    details
  );
  if (
    policy.retentionDays !== undefined &&
    (!Number.isFinite(Number(policy.retentionDays)) ||
      Number(policy.retentionDays) < 1 ||
      Number(policy.retentionDays) > 3650)
  ) {
    details.push({
      path: "backup.policy.retentionDays",
      message: "Debe estar entre 1 y 3650"
    });
  }
  if (policy.timeWindowStart && !TIME_RE.test(String(policy.timeWindowStart))) {
    details.push({
      path: "backup.policy.timeWindowStart",
      message: "Formato HH:mm"
    });
  }
  if (policy.timeWindowEnd && !TIME_RE.test(String(policy.timeWindowEnd))) {
    details.push({
      path: "backup.policy.timeWindowEnd",
      message: "Formato HH:mm"
    });
  }
  if (
    policy.timeWindowStart &&
    policy.timeWindowEnd &&
    String(policy.timeWindowStart) >= String(policy.timeWindowEnd)
  ) {
    details.push({
      path: "backup.policy",
      message: "Ventana de backup invalida"
    });
  }

  const notificationEmails = Array.isArray(policy.notificationEmails)
    ? policy.notificationEmails
    : [];
  notificationEmails.forEach((email, index) => {
    if (!EMAIL_RE.test(String(email || "").trim())) {
      details.push({
        path: `backup.policy.notificationEmails[${index}]`,
        message: "Email invalido"
      });
    }
  });

  ensureBooleanFields(drills, ["enabled"], "backup.restoreDrills", details);
  if (
    drills.frequencyDays !== undefined &&
    (!Number.isFinite(Number(drills.frequencyDays)) ||
      Number(drills.frequencyDays) < 1 ||
      Number(drills.frequencyDays) > 365)
  ) {
    details.push({
      path: "backup.restoreDrills.frequencyDays",
      message: "Debe estar entre 1 y 365"
    });
  }
  const responsibleEmails = Array.isArray(drills.responsibleEmails)
    ? drills.responsibleEmails
    : [];
  responsibleEmails.forEach((email, index) => {
    if (!EMAIL_RE.test(String(email || "").trim())) {
      details.push({
        path: `backup.restoreDrills.responsibleEmails[${index}]`,
        message: "Email invalido"
      });
    }
  });
};

const validateCompliance = (config, details) => {
  const compliance = config?.compliance || {};
  if (
    compliance.dataRetentionDays !== undefined &&
    (!Number.isFinite(Number(compliance.dataRetentionDays)) ||
      Number(compliance.dataRetentionDays) < 30 ||
      Number(compliance.dataRetentionDays) > 3650)
  ) {
    details.push({
      path: "compliance.dataRetentionDays",
      message: "Debe estar entre 30 y 3650"
    });
  }
  ensureBooleanFields(
    compliance,
    ["maskSensitiveLogs", "exportAuditEnabled", "requireInvoiceNumberingAudit"],
    "compliance",
    details
  );
};

const validateFooter = (config, details) => {
  const source = config?.footer?.contactSource;
  if (source !== undefined && !VALID_CONTACT_SOURCE.includes(String(source))) {
    details.push({
      path: "footer.contactSource",
      message: `Debe ser uno de: ${VALID_CONTACT_SOURCE.join(", ")}`
    });
  }
  ensureBooleanFields(
    config?.footer,
    ["showContact", "showSchedule", "showSocial", "showQuickLinks", "showLegalLinks"],
    "footer",
    details
  );
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
  ensureBooleanFields(config?.footer, ["enabled"], "footer", details);

  const validateFooterLinks = (links, path) => {
    if (links === undefined) return;
    if (!Array.isArray(links)) {
      details.push({ path, message: "Debe ser un array" });
      return;
    }
    links.forEach((link, index) => {
      if (link?.label !== undefined && String(link.label).trim().length === 0) {
        details.push({ path: `${path}[${index}].label`, message: "Label no vacio" });
      }
      if (link?.href !== undefined && String(link.href).trim().length === 0) {
        details.push({ path: `${path}[${index}].href`, message: "Href no vacio" });
      }
    });
  };
  validateFooterLinks(config?.footer?.quickLinks, "footer.quickLinks");
  validateFooterLinks(config?.footer?.legalLinks, "footer.legalLinks");

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
      message: "Debe incluir al menos el placeholder {SEQ}"
    });
  }

  const ticketFormat = config?.numbers?.ticketNumber?.format;
  if (ticketFormat !== undefined && !NUMBER_FORMAT_RE.test(String(ticketFormat))) {
    details.push({
      path: "numbers.ticketNumber.format",
      message: "Debe incluir al menos el placeholder {SEQ}"
    });
  }

  const invoiceFormat = config?.numbers?.invoiceNumber?.format;
  if (invoiceFormat !== undefined && !NUMBER_FORMAT_RE.test(String(invoiceFormat))) {
    details.push({
      path: "numbers.invoiceNumber.format",
      message: "Debe incluir al menos el placeholder {SEQ}"
    });
  }

  const orderReset = config?.numbers?.orderNumber?.reset;
  if (orderReset !== undefined && !VALID_RESETS.includes(String(orderReset))) {
    details.push({
      path: "numbers.orderNumber.reset",
      message: `Debe ser uno de: ${VALID_RESETS.join(", ")}`
    });
  }

  const ticketReset = config?.numbers?.ticketNumber?.reset;
  if (ticketReset !== undefined && !VALID_RESETS.includes(String(ticketReset))) {
    details.push({
      path: "numbers.ticketNumber.reset",
      message: `Debe ser uno de: ${VALID_RESETS.join(", ")}`
    });
  }

  const invoiceReset = config?.numbers?.invoiceNumber?.reset;
  if (invoiceReset !== undefined && !VALID_RESETS.includes(String(invoiceReset))) {
    details.push({
      path: "numbers.invoiceNumber.reset",
      message: `Debe ser uno de: ${VALID_RESETS.join(", ")}`
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

  validateMaintenanceRoutes(config?.maintenance?.allowPrefixes, "maintenance.allowPrefixes", details);
  validateMaintenanceRoutes(config?.maintenance?.allowExact, "maintenance.allowExact", details);
  validateBusinessContact(config, details);
  validateHours(config, details);
  validateCheckout(config, details);
  validateNotifications(config, details);
  validateIntegrations(config, details);
  validateSecurity(config, details);
  validateBackup(config, details);
  validateCompliance(config, details);
  validateFooter(config, details);

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
