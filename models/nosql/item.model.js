const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema({
  size: String,
  icon: String,
  originalPrice: { type: Number, required: true },
  discountPrice: Number,
  stock: { type: Number, default: 0 },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
});

const PromotionSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  percentage: { type: Number, min: 0, max: 100, default: 0 },
  startDate: Date,
  endDate: Date
}, { _id: false });

const ItemSchema = new mongoose.Schema({
  nameProduct: { type: String, required: true },
  value: [VariantSchema],
  description: { type: String, default: "No description" },
  images: [{
    description: String,
    imgUrl: String,
    public_id: String,
    _id: false
  }],
  banner: String,
  visibility: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'categories',
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  nventas: { type: Number, default: 0 },
  promotion: PromotionSchema
}, {
  timestamps: true,
  versionKey: false,
});

// Middleware para calcular precios automáticamente
ItemSchema.pre('save', function(next) {
  // Recalcular siempre que "promotion" cambie
  if (this.isModified('promotion')) {
    const now = new Date();
    
    this.value.forEach(variant => {
      // Resetear precio de descuento primero
      variant.discountPrice = null;
      
      // Calcular nuevo descuento si la promoción está activa y vigente
      if (this.promotion?.active) {
        const start = new Date(this.promotion.startDate);
        const end = new Date(this.promotion.endDate);
        
        if (now >= start && now <= end) {
          const discount = variant.originalPrice * (this.promotion.percentage / 100);
          variant.discountPrice = Math.round(variant.originalPrice - discount);
        }
      }
    });
  }
  next();
});

module.exports = mongoose.model("items", ItemSchema);