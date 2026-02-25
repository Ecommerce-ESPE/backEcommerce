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
    equipmentTracking: { type: Boolean, default: true }
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
      reset: { type: String, default: "daily" }
    },
    ticketNumber: {
      format: { type: String, default: "T-{YYYY}{MM}{DD}-{SEQ}" },
      reset: { type: String, default: "daily" }
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
      timezone: { type: String, default: "America/Guayaquil" }
    },
    branding: { type: BrandingSchema, default: () => ({}) },
    modules: { type: ModulesSchema, default: () => ({}) },
    tax: { type: TaxSchema, default: () => ({}) },
    sales: { type: SalesSchema, default: () => ({}) },
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
    timezone: "America/Guayaquil"
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
    ticketNumber: { format: "T-{YYYY}{MM}{DD}-{SEQ}", reset: "daily" }
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
    equipmentTracking: true
  }
});

const TenantConfig = mongoose.model("TenantConfig", TenantConfigSchema);
TenantConfig.buildDefaultTenantConfig = buildDefaultTenantConfig;

module.exports = TenantConfig;
