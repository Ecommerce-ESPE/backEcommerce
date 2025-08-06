const mongoose = require("mongoose");

const PromoBarSchema = new mongoose.Schema({
    text: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      required: true,
      default: "/",
    },
    visible: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
// Verifica si la fecha actual está dentro del rango de fechas
PromoBarSchema.pre("save", function (next) {
    const currentDate = new Date();
    if (this.startDate > currentDate || this.endDate < currentDate) {
        this.visible = false;
    } else {
        this.visible = true;
    }
    next();
    }
);

module.exports = mongoose.model("PromoBar", PromoBarSchema);
