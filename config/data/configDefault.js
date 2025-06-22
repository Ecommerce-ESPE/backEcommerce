module.exports = {
  empresa: {
    nombre: "Createx Shop",
    direccion: "Av. Moran Valverde, S142-54",
    telefono: "098521856226",
    email: "ventas@createx.com",
    logoUrl: "https://ejemplo.com/logo.png"
  },
  impuestos: {
    aplicarIVA: true,
    porcentajeIVA: 0.12,
    descripcionIVA: "IVA 12%",
  },
  factura: {
    vencimientoDias: 30,
    aplicarDescuento: true,
    descuentoPorDefecto: 0.0,
    formatoNumero: "0000 0000 00"
  },
  metodosPago: {
    habilitados: ["visa", "paypal", "wallet", "money", "credits"]
  },
  tienda: {
    nombrePublico: "Createx Shop Online",
    moneda: "USD",
    simbolo: "$",
    mostrarStock: true,
    permitirResenas: true
  },
  mantenimiento: {
    modo: false,
    mensaje: "Estamos en mantenimiento."
  },
  envios: [
    {
      id: "courier",
      costo: 5,
      descripcion: "Mensajería a domicilio",
      fecha: "9 de noviembre"
    },
    {
      id: "store-pickup",
      costo: 0.0,
      descripcion: "Recoger en tienda",
      fecha: "8 de noviembre desde las 12:00pm"
    },
    {
      id: "ups",
      costo: 10.0,
      descripcion: "Envío terrestre UPS",
      fecha: "Hasta una semana"
    },
    {
      id: "locker-pickup",
      costo: 8.5,
      descripcion: "Recoger en casillero Createx",
      fecha: "8 de noviembre desde las 12:00pm"
    },
    {
      id: "global-export",
      costo: 3.0,
      descripcion: "Exportación Global Createx",
      fecha: "3-4 días"
    }
  ]
};
