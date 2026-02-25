const mongoose = require("mongoose");
const SPEC_TYPES = ["text", "number", "boolean", "list_text", "list_number"];

const ImageSchema = new mongoose.Schema(
    {
        title: String,
        description: String,
        imgUrl: String,
        public_id: String,
    },
    { _id: false }
);

const SpecTemplateSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: SPEC_TYPES,
            required: true,
        },
        unit: {
            type: String,
            default: null,
        },
        options: [
            {
                type: String,
                trim: true,
            },
        ],
        required: {
            type: Boolean,
            default: false,
        },
        order: {
            type: Number,
            default: 0,
        },
        group: {
            type: String,
            default: null,
        },
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
        specTemplate: { type: [SpecTemplateSchema], default: [] },
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
        specTemplate: { type: [SpecTemplateSchema], default: [] },
        subcategories: [SubcategorySchema],
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("categories", CategorySchema);
