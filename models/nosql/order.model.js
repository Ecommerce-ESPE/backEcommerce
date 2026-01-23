const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId
  },
  name: { type: String, required: true },
  variantName: { type: String },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} no es un valor entero'
    }
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  unitPriceCharged: {
    type: Number,
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  pricingSource: {
    type: String,
    enum: ["globalPromo", "productPromo", "storedDiscount", "none"],
    default: "none"
  },
  promoPercentageApplied: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  promoId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  image: { type: String }
}, { _id: false });

const ShippingAddressSchema = new mongoose.Schema({
  provincia: { type: String, required: true },
  canton: { type: String, required: true },
  parroquia: { type: String },
  callePrincipal: { type: String, required: true },
  numeroCasa: { type: String },
  referencia: { type: String },
  codigoPostal: { type: String }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { 
    type: String, 
    required: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email no válido']
  },
  customerPhone: { type: String, required: true },
  products: {
    type: [OrderItemSchema],
    required: true,
    validate: {
      validator: v => Array.isArray(v) && v.length > 0,
      message: 'El pedido debe tener al menos un producto'
    }
  },
  shippingMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShippingMethod",
    required: true
  },
  shippingAddress: {
    type: ShippingAddressSchema,
    required: true
  },
  subtotal: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  tax: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  shippingCost: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  discountAmount: { 
    type: Number, 
    default: 0, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  total: { 
    type: Number, 
    required: true, 
    min: 0,
    set: v => parseFloat(v.toFixed(2))
  },
  discountCode: { type: String },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "cancelled", "failed", "refunded"],
    default: "pending"
  },
  paidAt: { type: Date },
  analyticsProcessed: { type: Boolean, default: false },
  analyticsProcessing: { type: Boolean, default: false },
  analyticsProcessedAt: { type: Date },
  paymentMethod: { 
    type: String,
    enum: ["credit-card", "paypal", "transfer", "credits"],
    required: true
  },
  notes: { type: String },
  estimatedDelivery: { type: Date }
}, { 
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejor performance
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

// Middleware para actualizar el estado
OrderSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'completed') {
    this.estimatedDelivery = new Date();
  }
  next();
});

module.exports = mongoose.model("Order", OrderSchema);
