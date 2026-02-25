module.exports = {
  key: "restaurant",
  label: "Restaurant",
  description: "Preset para restaurante con POS, colas y cocina.",
  defaultsSummary:
    "POS + tickets + KDS + despacho + delivery + inventario + workflow de cocina.",
  configPatch: {
    modules: {
      ecommerceStorefront: true,
      pos: true,
      queuesTickets: true,
      kdsKitchen: true,
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
        dineIn: true
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
          key: "pickup",
          label: "Retiro",
          enabled: true,
          ticketPrefix: "R",
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
        id: "restaurant",
        stages: [
          { key: "created", role: "CASHIER", enabled: true },
          { key: "preparing", role: "KITCHEN", enabled: true },
          { key: "ready", role: "DISPATCH", enabled: true }
        ]
      }
    },
    tax: {
      strategy: "ecuador_iva",
      priceIncludesTax: false,
      iva: {
        defaultRate: 0.15
      }
    }
  }
};
