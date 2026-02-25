module.exports = {
  key: "hardware_store",
  label: "Hardware Store",
  description: "Preset para ferreteria con POS, tienda online e inventario.",
  defaultsSummary:
    "POS + inventario + ecommerce + promociones, sin cocina ni colas complejas.",
  configPatch: {
    modules: {
      ecommerceStorefront: true,
      pos: true,
      queuesTickets: false,
      kdsKitchen: false,
      dispatch: true,
      delivery: false,
      promotions: true,
      inventory: true,
      coupons: true,
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
        id: "hardware",
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
