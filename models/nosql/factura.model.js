const mongoose = require("mongoose");
const Counter = require("./counter"); // Nuevo modelo para secuencia de facturas


const ShippingMethodSchema = new mongoose.Schema({
  id: String,
  costo: Number,
  descripcion: String,
  fecha: String
}, { _id: false });

const ShippingAddressSchema = new mongoose.Schema({
  directionPrincipal: String,
  nCasa: String,
  codepostal: String,
  telefono: String
}, { _id: false });

const FacturaSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 }, // Asegurar que este campo exista
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    factura_number: { type: String, unique: true },
    items: [
      {
        product: { type: mongoose.Schema.ObjectId, ref: "items" },
        name: String,
        price: Number,
        quantity: Number,
        total: Number,
      },
    ],
    cliente: { type: mongoose.Schema.ObjectId, ref: "users" },
    methodPay: {
      type: String,
      enum: ["visa", "paypal", "wallet", "money", "credits", "credit-card"],
      required: true
    },
    dueDate: { type: Date },
    nItems: { type: Number, default: 0 },
    shipping: {
      method: ShippingMethodSchema,
      address: ShippingAddressSchema
    },
    companyDetails: {
      name: { type: String, default: "Createx Shop" },
      address: { type: String, default: "Av. Moran Valverde, S142-54" },
      phone: { type: String, default: "098521856226" },
      email: { type: String, default: "ventas@createx.com" },
      logoUrl: { type: String, default: "../../storage/logo.svg" }
    }
  },
  { timestamps: true, versionKey: false }
);


// Auto-incrementar número de factura
FacturaSchema.pre("save", async function (next) {
  if (!this.isNew) return next();

  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "factura_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.factura_number = counter.seq
      .toString()
      .padStart(10, "0")
      .replace(/(\d{4})(\d{4})(\d{2})/, "$1 $2 $3");
    next();
  } catch (err) {
    next(err);
  }
});

// Calcular fecha de vencimiento
FacturaSchema.pre("save", function (next) {
  if (!this.dueDate) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    this.dueDate = dueDate;
  }
  next();
});

module.exports = mongoose.model("factura", FacturaSchema);
