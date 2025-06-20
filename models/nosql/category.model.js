const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema(
    {
        title: String,
        description: String,
        imgUrl: String,
    },
    { _id: false }
);

const SubcategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            default: "No description",
        },
        images: [ImageSchema],
    },
    { _id: true }
);

const CategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            default: "No description",
        },
        images: [ImageSchema],
        subcategories: [SubcategorySchema],
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("categories", CategorySchema);
