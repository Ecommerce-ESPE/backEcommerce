module.exports = {
  key: "ecommerce",
  label: "Ecommerce",
  description: "Preset para comercio online con reseñas, promociones y cupones.",
  defaultsSummary:
    "Storefront + inventario + reviews + promociones + cupones, con workflow sin cocina.",
  configPatch: {
    modules: {
      ecommerceStorefront: true,
      pos: false,
      queuesTickets: false,
      kdsKitchen: false,
      dispatch: true,
      delivery: true,
      promotions: true,
      inventory: true,
      coupons: true,
      reviews: true,
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
          label: "Checkout",
          enabled: true,
          ticketPrefix: "E",
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
        id: "ecommerce",
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
