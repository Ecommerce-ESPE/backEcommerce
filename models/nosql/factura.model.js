const mongoose = require("mongoose");

const FacturaSchema = new mongoose.Schema(
    {
        subtotal: {
            type: Number,
            default: 0
        },
        tax: {
            type: Number,
            default: 0.12
        },
        total: {
            type: Number,
            default: 0
        },
        items:[
            {
                type: mongoose.Schema.ObjectId,
                ref: 'items'
            }
        ],
        cliente:{
            type: mongoose.Schema.ObjectId,
            ref: 'users'
        },
        methodPay:{
            type:["visa","paypal","wallet","money"],
        },
        dueDate: {
            type: Date
        },
        nItems:{
            type: Number,
            default: 0
        },
        discount:{
            type: Number,
            default: 0.0
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
)


FacturaSchema.pre("save", function(next) {
    const daysToAdd = 30; // Por ejemplo, 30 días
    const currentDate = new Date();
    const dueDate = new Date(currentDate);
    dueDate.setDate(currentDate.getDate() + daysToAdd);
    
    this.dueDate = dueDate; // Asignar la fecha de vencimiento calculada al campo dueDate
    next(); // Continuar con el proceso de guardado
});


module.exports = mongoose.model("factura", FacturaSchema);

