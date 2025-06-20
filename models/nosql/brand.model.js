const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String,
            default: "No description"
        },
        logo: {
            type: String, // URL del logo de la marca
            default: ""
        },
        website: {
            type: String, // Sitio web oficial (opcional)
            default: ""
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("brands", BrandSchema);
