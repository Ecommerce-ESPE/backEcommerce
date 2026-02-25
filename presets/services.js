module.exports = {
  key: "services",
  label: "Services",
  description: "Preset orientado a empresas de servicios con flujo operativo simple.",
  defaultsSummary:
    "Servicios con flujo corto, sin inventario, sin cupones ni promociones.",
  configPatch: {
    modules: {
      ecommerceStorefront: false,
      pos: true,
      queuesTickets: false,
      kdsKitchen: false,
      dispatch: false,
      delivery: false,
      promotions: false,
      inventory: false,
      coupons: false,
      reviews: false,
      maintenance: true
    },
    sales: {
      orderTypesEnabled: {
        pickup: true,
        delivery: false,
        dineIn: false
      }
    },
    operations: {
      queues: [
        {
          key: "checkout",
          label: "Atencion",
          enabled: true,
          ticketPrefix: "S",
          displayEnabled: true
        }
      ],
      workflow: {
        id: "services",
        stages: [
          { key: "created", role: "CASHIER", enabled: true },
          { key: "ready", role: "MANAGER", enabled: true }
        ]
      }
    },
    tax: {
      strategy: "ecuador_iva",
      priceIncludesTax: false,
      iva: { defaultRate: 0.15 }
    }
  }
};
