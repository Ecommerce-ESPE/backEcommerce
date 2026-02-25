module.exports = {
  key: "retail",
  label: "Retail",
  description: "Preset retail generalista con ecommerce, POS e inventario.",
  defaultsSummary:
    "Retail equilibrado para tienda fisica y online, con flujo simple de despacho.",
  configPatch: {
    modules: {
      ecommerceStorefront: true,
      pos: true,
      queuesTickets: true,
      kdsKitchen: false,
      dispatch: true,
      delivery: true,
      promotions: true,
      inventory: true,
      coupons: true,
      reviews: false,
      maintenance: true
    },
    sales: {
      orderTypesEnabled: {
        pickup: true,
        delivery: true,
        dineIn: false
      }
    },
    operations: {
      queues: [
        {
          key: "checkout",
          label: "Caja",
          enabled: true,
          ticketPrefix: "C",
          displayEnabled: true
        },
        {
          key: "dispatch",
          label: "Despacho",
          enabled: true,
          ticketPrefix: "D",
          displayEnabled: true
        }
      ],
      workflow: {
        id: "retail",
        stages: [
          { key: "created", role: "CASHIER", enabled: true },
          { key: "ready", role: "DISPATCH", enabled: true }
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
