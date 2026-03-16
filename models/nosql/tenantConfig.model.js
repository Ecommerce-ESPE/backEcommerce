const mongoose = require("mongoose");

const ThemeSchema = new mongoose.Schema(
  {
    primary: { type: String, default: "#0f172a" },
    secondary: { type: String, default: "#64748b" },
    accent: { type: String, default: "#f97316" }
  },
  { _id: false }
);

const BrandingSchema = new mongoose.Schema(
  {
    logoUrl: { type: String, default: "" },
    faviconUrl: { type: String, default: "" },
    theme: { type: ThemeSchema, default: () => ({}) }
  },
  { _id: false }
);

const CoordinatesSchema = new mongoose.Schema(
  {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  { _id: false }
);

const BusinessContactSchema = new mongoose.Schema(
  {
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    website: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "EC" },
    scheduleText: { type: String, default: "" },
    googleMapsUrl: { type: String, default: "" },
    coordinates: { type: CoordinatesSchema, default: () => ({}) }
  },
  { _id: false }
);

const FooterLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" }
  },
  { _id: false }
);

const FooterContactSchema = new mongoose.Schema(
  {
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    schedule: { type: String, default: "" },
    whatsapp: { type: String, default: "" }
  },
  { _id: false }
);

const FooterSocialSchema = new mongoose.Schema(
  {
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    tiktok: { type: String, default: "" },
    x: { type: String, default: "" }
  },
  { _id: false }
);

const FooterSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    aboutText: { type: String, default: "" },
    showContact: { type: Boolean, default: true },
    showSchedule: { type: Boolean, default: true },
    showSocial: { type: Boolean, default: true },
    showQuickLinks: { type: Boolean, default: true },
    showLegalLinks: { type: Boolean, default: true },
    contactSource: { type: String, default: "business.contact" },
    contact: { type: FooterContactSchema, default: () => ({}) },
    social: { type: FooterSocialSchema, default: () => ({}) },
    quickLinks: { type: [FooterLinkSchema], default: [] },
    legalLinks: { type: [FooterLinkSchema], default: [] },
    copyrightText: { type: String, default: "" }
  },
  { _id: false }
);

const ModulesSchema = new mongoose.Schema(
  {
    ecommerceStorefront: { type: Boolean, default: true },
    pos: { type: Boolean, default: false },
    queuesTickets: { type: Boolean, default: false },
    kdsKitchen: { type: Boolean, default: false },
    dispatch: { type: Boolean, default: false },
    delivery: { type: Boolean, default: false },
    promotions: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    coupons: { type: Boolean, default: true },
    reviews: { type: Boolean, default: false },
    maintenance: { type: Boolean, default: true }
  },
  { _id: false }
);

const MaintenanceSchema = new mongoose.Schema(
  {
    storeMaintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: {
      type: String,
      default: "Sistema en mantenimiento. Intente mas tarde.",
      maxlength: 200
    },
    disableStorefront: { type: Boolean, default: false },
    disablePOS: { type: Boolean, default: false },
    allowAdminAccess: { type: Boolean, default: true },
    equipmentTracking: { type: Boolean, default: true },
    allowPrefixes: { type: [String], default: [] },
    allowExact: { type: [String], default: [] }
  },
  { _id: false }
);

const EffectiveRateSchema = new mongoose.Schema(
  {
    from: { type: Date, required: true },
    rate: { type: Number, required: true, min: 0, max: 1 }
  },
  { _id: false }
);

const ProductTaxRuleSchema = new mongoose.Schema(
  {
    match: {
      categoryId: { type: String },
      tag: { type: String }
    },
    rate: { type: Number, required: true, min: 0, max: 1 }
  },
  { _id: false }
);

const TaxSchema = new mongoose.Schema(
  {
    strategy: { type: String, default: "ecuador_iva" },
    priceIncludesTax: { type: Boolean, default: false },
    iva: {
      defaultRate: { type: Number, min: 0, max: 1, default: 0.15 },
      effectiveRates: { type: [EffectiveRateSchema], default: [] },
      productTaxRules: { type: [ProductTaxRuleSchema], default: [] }
    }
  },
  { _id: false }
);

const SalesSchema = new mongoose.Schema(
  {
    orderTypesEnabled: {
      pickup: { type: Boolean, default: true },
      delivery: { type: Boolean, default: true },
      dineIn: { type: Boolean, default: false }
    },
    paymentMethods: {
      cash: { type: Boolean, default: true },
      card: { type: Boolean, default: true },
      transfer: { type: Boolean, default: true }
    }
  },
  { _id: false }
);

const HourDaySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday"
      ],
      required: true
    },
    enabled: { type: Boolean, default: true },
    open: { type: String, default: "08:00" },
    close: { type: String, default: "18:00" }
  },
  { _id: false }
);

const HourSpecialDateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    closed: { type: Boolean, default: false },
    open: { type: String, default: null },
    close: { type: String, default: null },
    note: { type: String, default: "" }
  },
  { _id: false }
);

const HoursSchema = new mongoose.Schema(
  {
    timezone: { type: String, default: "America/Guayaquil" },
    weekly: { type: [HourDaySchema], default: [] },
    specialDates: { type: [HourSpecialDateSchema], default: [] },
    acceptOrdersOutsideHours: { type: Boolean, default: false }
  },
  { _id: false }
);

const CheckoutRequiredFieldsSchema = new mongoose.Schema(
  {
    customerName: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    phone: { type: Boolean, default: true },
    addressLine1: { type: Boolean, default: true },
    city: { type: Boolean, default: true }
  },
  { _id: false }
);

const CheckoutSchema = new mongoose.Schema(
  {
    guestCheckoutEnabled: { type: Boolean, default: true },
    requireIdentification: { type: Boolean, default: false },
    requirePhone: { type: Boolean, default: true },
    requireAddressByOrderType: {
      delivery: { type: Boolean, default: true },
      pickup: { type: Boolean, default: false },
      dineIn: { type: Boolean, default: false }
    },
    orderNotesEnabled: { type: Boolean, default: true },
    tipEnabled: { type: Boolean, default: false },
    termsText: { type: String, default: "" },
    privacyText: { type: String, default: "" },
    requiredFields: { type: CheckoutRequiredFieldsSchema, default: () => ({}) }
  },
  { _id: false }
);

const NotificationChannelSchema = new mongoose.Schema(
  {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    internal: { type: Boolean, default: true }
  },
  { _id: false }
);

const NotificationEventsSchema = new mongoose.Schema(
  {
    order_created: { type: NotificationChannelSchema, default: () => ({}) },
    order_paid: { type: NotificationChannelSchema, default: () => ({}) },
    order_preparing: { type: NotificationChannelSchema, default: () => ({}) },
    order_ready: { type: NotificationChannelSchema, default: () => ({}) },
    order_dispatched: { type: NotificationChannelSchema, default: () => ({}) },
    order_delivered: { type: NotificationChannelSchema, default: () => ({}) },
    invoice_generated: { type: NotificationChannelSchema, default: () => ({}) }
  },
  { _id: false }
);

const NotificationsSchema = new mongoose.Schema(
  {
    channels: { type: NotificationChannelSchema, default: () => ({}) },
    events: { type: NotificationEventsSchema, default: () => ({}) }
  },
  { _id: false }
);

const IntegrationProviderSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    provider: { type: String, default: "none" },
    publicKey: { type: String, default: "" },
    secretKey: { type: String, default: "" },
    apiKey: { type: String, default: "" },
    apiSecret: { type: String, default: "" },
    token: { type: String, default: "" },
    fromEmail: { type: String, default: "" },
    phoneId: { type: String, default: "" },
    environment: { type: String, default: "PRUEBAS" }
  },
  { _id: false }
);

const IntegrationsSchema = new mongoose.Schema(
  {
    payments: { type: IntegrationProviderSchema, default: () => ({}) },
    sri: {
      enabled: { type: Boolean, default: false },
      provider: { type: String, default: "none" },
      environment: { type: String, default: "PRUEBAS" },
      mode: { type: String, default: "certificate_file" },
      signature: {
        provider: { type: String, default: "vault" },
        hasCertificate: { type: Boolean, default: false },
        certificateAlias: { type: String, default: "" },
        serialNumber: { type: String, default: "" },
        validFrom: { type: String, default: "" },
        validTo: { type: String, default: "" },
        vaultKeyRef: { type: String, default: "" },
        pinSet: { type: Boolean, default: false },
        lastRotatedAt: { type: Date, default: null },
        lastTestAt: { type: Date, default: null },
        lastTestStatus: { type: String, default: "" }
      }
    },
    whatsapp: { type: IntegrationProviderSchema, default: () => ({}) },
    email: { type: IntegrationProviderSchema, default: () => ({}) },
    maps: { type: IntegrationProviderSchema, default: () => ({}) }
  },
  { _id: false }
);

const SecuritySchema = new mongoose.Schema(
  {
    session: {
      sessionTimeoutMinutes: { type: Number, default: 120, min: 5 },
      rememberMeEnabled: { type: Boolean, default: true },
      maxConcurrentSessions: { type: Number, default: 3, min: 1 }
    },
    ipSecurity: {
      whitelistEnabled: { type: Boolean, default: false },
      allowedIps: { type: [String], default: [] },
      adminOnlyIpRestriction: { type: Boolean, default: false }
    },
    rateLimits: {
      loginAttempts: { type: Number, default: 5, min: 1 },
      patchConfigAttempts: { type: Number, default: 20, min: 1 },
      checkoutAttempts: { type: Number, default: 30, min: 1 }
    },
    abuseProtection: {
      slowdownEnabled: { type: Boolean, default: true },
      blockDurationSec: { type: Number, default: 900, min: 30 },
      maxConcurrentCheckout: { type: Number, default: 20, min: 1 }
    },
    audit: {
      enabled: { type: Boolean, default: true },
      logConfigChanges: { type: Boolean, default: true },
      logAdminActions: { type: Boolean, default: true }
    },
    authRules: {
      requireReauthForSensitiveChanges: { type: Boolean, default: true },
      requireTenantAdminRoleForConfigChanges: { type: Boolean, default: true }
    }
  },
  { _id: false }
);

const BackupSchema = new mongoose.Schema(
  {
    policy: {
      enabled: { type: Boolean, default: true },
      frequency: { type: String, default: "daily" },
      retentionDays: { type: Number, default: 30, min: 1 },
      timeWindowStart: { type: String, default: "02:00" },
      timeWindowEnd: { type: String, default: "04:00" },
      notifyOnSuccess: { type: Boolean, default: false },
      notifyOnFailure: { type: Boolean, default: true },
      notificationEmails: { type: [String], default: [] }
    },
    restoreDrills: {
      enabled: { type: Boolean, default: true },
      frequencyDays: { type: Number, default: 30, min: 1 },
      lastDrillAt: { type: Date, default: null },
      responsibleEmails: { type: [String], default: [] },
      notes: { type: String, default: "" }
    }
  },
  { _id: false }
);

const ComplianceSchema = new mongoose.Schema(
  {
    dataRetentionDays: { type: Number, default: 365, min: 30 },
    maskSensitiveLogs: { type: Boolean, default: true },
    exportAuditEnabled: { type: Boolean, default: true },
    requireInvoiceNumberingAudit: { type: Boolean, default: true }
  },
  { _id: false }
);

const QueueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    ticketPrefix: { type: String, default: "" },
    displayEnabled: { type: Boolean, default: true }
  },
  { _id: false }
);

const WorkflowStageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    role: {
      type: String,
      enum: ["CASHIER", "KITCHEN", "DISPATCH", "COURIER", "ADMIN", "MANAGER"],
      required: true
    },
    enabled: { type: Boolean, default: true }
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    id: { type: String, default: "default" },
    stages: { type: [WorkflowStageSchema], default: [] }
  },
  { _id: false }
);

const StaffSchema = new mongoose.Schema(
  {
    maxActiveTasks: {
      CASHIER: { type: Number, default: 1, min: 1 },
      KITCHEN: { type: Number, default: 1, min: 1 },
      DISPATCH: { type: Number, default: 1, min: 1 },
      COURIER: { type: Number, default: 1, min: 1 }
    },
    presence: {
      heartbeatSeconds: { type: Number, default: 20, min: 5 },
      offlineAfterSeconds: { type: Number, default: 60, min: 10 }
    }
  },
  { _id: false }
);

const OperationsSchema = new mongoose.Schema(
  {
    multiBranchEnabled: { type: Boolean, default: false },
    defaultBranchId: { type: String, default: "DEFAULT" },
    queues: { type: [QueueSchema], default: [] },
    workflow: { type: WorkflowSchema, default: () => ({}) },
    staff: { type: StaffSchema, default: () => ({}) }
  },
  { _id: false }
);

const NumbersSchema = new mongoose.Schema(
  {
    orderNumber: {
      format: { type: String, default: "ORD-{YYYY}{MM}{DD}-{SEQ}" },
      reset: {
        type: String,
        enum: ["daily", "monthly", "yearly", "never"],
        default: "daily"
      }
    },
    ticketNumber: {
      format: { type: String, default: "T-{YYYY}{MM}{DD}-{SEQ}" },
      reset: {
        type: String,
        enum: ["daily", "monthly", "yearly", "never"],
        default: "daily"
      }
    },
    invoiceNumber: {
      format: { type: String, default: "INV-{YYYY}{MM}{DD}-{SEQ}" },
      reset: {
        type: String,
        enum: ["daily", "monthly", "yearly", "never"],
        default: "daily"
      }
    }
  },
  { _id: false }
);

const SriSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    environment: { type: String, default: "PRUEBAS" },
    emissionType: { type: String, default: "NORMAL" },
    obligatedAccounting: { type: String, default: "NO" },
    specialContributor: { type: String, default: "" },
    mainOfficeAddress: { type: String, default: "" },
    authorizationNumber: { type: String, default: "" },
    accessKey: { type: String, default: "" }
  },
  { _id: false }
);

const InvoiceConfigSchema = new mongoose.Schema(
  {
    termsAndConditions: {
      type: String,
      default:
        "Las devoluciones se aceptan dentro de los 5 dias posteriores a la compra, con comprobante y producto en buen estado."
    },
    showShippingAddress: { type: Boolean, default: true },
    showBranchInfo: { type: Boolean, default: true },
    sri: { type: SriSchema, default: () => ({}) }
  },
  { _id: false }
);

const TenantConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    business: {
      name: { type: String, default: "Mi Negocio" },
      ruc: { type: String, default: "" },
      industryMode: {
        type: String,
        enum: [
          "restaurant",
          "hardware_store",
          "retail",
          "services",
          "ecommerce",
          "hardware",
          "clothing"
        ],
        default: "restaurant"
      },
      currency: { type: String, default: "USD" },
      locale: { type: String, default: "es-EC" },
      timezone: { type: String, default: "America/Guayaquil" },
      contact: { type: BusinessContactSchema, default: () => ({}) }
    },
    branding: { type: BrandingSchema, default: () => ({}) },
    footer: { type: FooterSchema, default: () => ({}) },
    modules: { type: ModulesSchema, default: () => ({}) },
    tax: { type: TaxSchema, default: () => ({}) },
    sales: { type: SalesSchema, default: () => ({}) },
    hours: { type: HoursSchema, default: () => ({}) },
    checkout: { type: CheckoutSchema, default: () => ({}) },
    notifications: { type: NotificationsSchema, default: () => ({}) },
    integrations: { type: IntegrationsSchema, default: () => ({}) },
    security: { type: SecuritySchema, default: () => ({}) },
    backup: { type: BackupSchema, default: () => ({}) },
    compliance: { type: ComplianceSchema, default: () => ({}) },
    operations: { type: OperationsSchema, default: () => ({}) },
    numbers: { type: NumbersSchema, default: () => ({}) },
    invoice: { type: InvoiceConfigSchema, default: () => ({}) },
    maintenance: { type: MaintenanceSchema, default: () => ({}) }
  },
  { timestamps: true, versionKey: false }
);

const buildDefaultTenantConfig = (tenantId = "DEFAULT") => ({
  tenantId,
  business: {
    name: "Mi Negocio",
    ruc: "",
    industryMode: "restaurant",
    currency: "USD",
    locale: "es-EC",
    timezone: "America/Guayaquil",
    contact: {
      address: "",
      phone: "",
      email: "",
      whatsapp: "",
      website: "",
      city: "",
      country: "EC",
      scheduleText: "",
      googleMapsUrl: "",
      coordinates: {
        lat: null,
        lng: null
      }
    }
  },
  branding: {
    logoUrl: "",
    faviconUrl: "",
    theme: {
      primary: "#0f172a",
      secondary: "#64748b",
      accent: "#f97316"
    }
  },
  footer: {
    enabled: true,
    aboutText: "",
    showContact: true,
    showSchedule: true,
    showSocial: true,
    showQuickLinks: true,
    showLegalLinks: true,
    contactSource: "business.contact",
    contact: {
      address: "",
      phone: "",
      email: "",
      schedule: "",
      whatsapp: ""
    },
    social: {
      facebook: "",
      instagram: "",
      tiktok: "",
      x: ""
    },
    quickLinks: [],
    legalLinks: [],
    copyrightText: ""
  },
  modules: {
    ecommerceStorefront: true,
    pos: false,
    queuesTickets: false,
    kdsKitchen: false,
    dispatch: false,
    delivery: false,
    promotions: true,
    inventory: true,
    coupons: true,
    reviews: false,
    maintenance: true
  },
  tax: {
    strategy: "ecuador_iva",
    priceIncludesTax: false,
    iva: {
      defaultRate: 0.15,
      effectiveRates: [],
      productTaxRules: []
    }
  },
  sales: {
    orderTypesEnabled: { pickup: true, delivery: true, dineIn: false },
    paymentMethods: { cash: true, card: true, transfer: true }
  },
  hours: {
    timezone: "America/Guayaquil",
    weekly: [
      { day: "monday", enabled: true, open: "08:00", close: "18:00" },
      { day: "tuesday", enabled: true, open: "08:00", close: "18:00" },
      { day: "wednesday", enabled: true, open: "08:00", close: "18:00" },
      { day: "thursday", enabled: true, open: "08:00", close: "18:00" },
      { day: "friday", enabled: true, open: "08:00", close: "18:00" },
      { day: "saturday", enabled: true, open: "09:00", close: "14:00" },
      { day: "sunday", enabled: false, open: "00:00", close: "00:00" }
    ],
    specialDates: [],
    acceptOrdersOutsideHours: false
  },
  checkout: {
    guestCheckoutEnabled: true,
    requireIdentification: false,
    requirePhone: true,
    requireAddressByOrderType: {
      delivery: true,
      pickup: false,
      dineIn: false
    },
    orderNotesEnabled: true,
    tipEnabled: false,
    termsText: "",
    privacyText: "",
    requiredFields: {
      customerName: true,
      email: true,
      phone: true,
      addressLine1: true,
      city: true
    }
  },
  notifications: {
    channels: {
      email: true,
      whatsapp: false,
      sms: false,
      push: false,
      internal: true
    },
    events: {
      order_created: { email: true, whatsapp: false, sms: false, push: false, internal: true },
      order_paid: { email: true, whatsapp: false, sms: false, push: false, internal: true },
      order_preparing: { email: false, whatsapp: false, sms: false, push: false, internal: true },
      order_ready: { email: true, whatsapp: false, sms: false, push: false, internal: true },
      order_dispatched: { email: true, whatsapp: false, sms: false, push: false, internal: true },
      order_delivered: { email: true, whatsapp: false, sms: false, push: false, internal: true },
      invoice_generated: { email: true, whatsapp: false, sms: false, push: false, internal: true }
    }
  },
  integrations: {
    payments: { enabled: false, provider: "none", publicKey: "", secretKey: "" },
    sri: {
      enabled: false,
      provider: "none",
      environment: "PRUEBAS",
      mode: "certificate_file",
      signature: {
        provider: "vault",
        hasCertificate: false,
        certificateAlias: "",
        serialNumber: "",
        validFrom: "",
        validTo: "",
        vaultKeyRef: "",
        pinSet: false,
        lastRotatedAt: null,
        lastTestAt: null,
        lastTestStatus: ""
      }
    },
    whatsapp: { enabled: false, provider: "none", phoneId: "", token: "" },
    email: { enabled: false, provider: "none", fromEmail: "", apiKey: "" },
    maps: { enabled: false, provider: "none", apiKey: "" }
  },
  security: {
    session: {
      sessionTimeoutMinutes: 120,
      rememberMeEnabled: true,
      maxConcurrentSessions: 3
    },
    ipSecurity: {
      whitelistEnabled: false,
      allowedIps: [],
      adminOnlyIpRestriction: false
    },
    rateLimits: {
      loginAttempts: 5,
      patchConfigAttempts: 20,
      checkoutAttempts: 30
    },
    abuseProtection: {
      slowdownEnabled: true,
      blockDurationSec: 900,
      maxConcurrentCheckout: 20
    },
    audit: {
      enabled: true,
      logConfigChanges: true,
      logAdminActions: true
    },
    authRules: {
      requireReauthForSensitiveChanges: true,
      requireTenantAdminRoleForConfigChanges: true
    }
  },
  backup: {
    policy: {
      enabled: true,
      frequency: "daily",
      retentionDays: 30,
      timeWindowStart: "02:00",
      timeWindowEnd: "04:00",
      notifyOnSuccess: false,
      notifyOnFailure: true,
      notificationEmails: []
    },
    restoreDrills: {
      enabled: true,
      frequencyDays: 30,
      lastDrillAt: null,
      responsibleEmails: [],
      notes: ""
    }
  },
  compliance: {
    dataRetentionDays: 365,
    maskSensitiveLogs: true,
    exportAuditEnabled: true,
    requireInvoiceNumberingAudit: true
  },
  operations: {
    multiBranchEnabled: false,
    defaultBranchId: "DEFAULT",
    queues: [
      {
        key: "checkout",
        label: "Caja",
        enabled: true,
        ticketPrefix: "C",
        displayEnabled: true
      },
      {
        key: "pickup",
        label: "Retiro",
        enabled: false,
        ticketPrefix: "R",
        displayEnabled: true
      },
      {
        key: "dispatch",
        label: "Despacho",
        enabled: false,
        ticketPrefix: "D",
        displayEnabled: true
      }
    ],
    workflow: {
      id: "default",
      stages: [
        { key: "created", role: "CASHIER", enabled: true },
        { key: "preparing", role: "KITCHEN", enabled: true },
        { key: "ready", role: "DISPATCH", enabled: true }
      ]
    },
    staff: {
      maxActiveTasks: {
        CASHIER: 1,
        KITCHEN: 2,
        DISPATCH: 2,
        COURIER: 1
      },
      presence: {
        heartbeatSeconds: 20,
        offlineAfterSeconds: 60
      }
    }
  },
  numbers: {
    orderNumber: { format: "ORD-{YYYY}{MM}{DD}-{SEQ}", reset: "daily" },
    ticketNumber: { format: "T-{YYYY}{MM}{DD}-{SEQ}", reset: "daily" },
    invoiceNumber: { format: "INV-{YYYY}{MM}{DD}-{SEQ}", reset: "daily" }
  },
  invoice: {
    termsAndConditions:
      "Las devoluciones se aceptan dentro de los 5 dias posteriores a la compra, con comprobante y producto en buen estado.",
    showShippingAddress: true,
    showBranchInfo: true,
    sri: {
      enabled: false,
      environment: "PRUEBAS",
      emissionType: "NORMAL",
      obligatedAccounting: "NO",
      specialContributor: "",
      mainOfficeAddress: "",
      authorizationNumber: "",
      accessKey: ""
    }
  },
  maintenance: {
    storeMaintenanceMode: false,
    maintenanceMessage: "Sistema en mantenimiento. Intente mas tarde.",
    disableStorefront: false,
    disablePOS: false,
    allowAdminAccess: true,
    equipmentTracking: true,
    allowPrefixes: [],
    allowExact: []
  }
});

const TenantConfig = mongoose.model("TenantConfig", TenantConfigSchema);
TenantConfig.buildDefaultTenantConfig = buildDefaultTenantConfig;

module.exports = TenantConfig;
