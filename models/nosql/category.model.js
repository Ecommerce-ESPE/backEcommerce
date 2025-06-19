// Define the schema for categories and subcategories
{
    "name": "Electronics",
    "description": "Category for electronic devices",
    "images": [
        {
            "title": "Electronics Banner",
            "description": "A banner image for electronics",
            "imgUrl": "https://example.com/electronics-banner.jpg"
        }
    ],
    "subcategories": [
        {
            "name": "Mobile Phones",
            "description": "Subcategory for mobile phones",
            "images": [
                {
                    "title": "Mobile Phones Banner",
                    "description": "A banner image for mobile phones",
                    "imgUrl": "https://example.com/mobile-phones-banner.jpg"
                }
            ]
        },
        {
            "name": "Laptops",
            "description": "Subcategory for laptops",
            "images": [
                {
                    "title": "Laptops Banner",
                    "description": "A banner image for laptops",
                    "imgUrl": "https://example.com/laptops-banner.jpg"
                }
            ]
        }
    ]
}
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
        images: [
            {
                _id: false,
                title: String,
                description: String,
                imgUrl: String,
            },
        ],
        subcategories: [
            {
                name: {
                    type: String,
                    required: false,
                },
                description: {
                    type: String,
                    default: "No description",
                },
                images: [
                    {
                        _id: false,
                        title: String,
                        description: String,
                        imgUrl: String,
                    },
                ],
            },
        ],
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("categories", CategorySchema);
const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema(
    {
        nameProduct:{
            type:String,
        },
        value:[
            {   
                size: String,
                icon:String,
                price: Number  
            }
        ],
        description:{
            type:String,
            default: "No description"
        },
        images:[
             {
                _id:false,
                title: String,
                description:"String",
                imgUrl:"String"
             }
        ],
        banner:{
            type:String,
        },
        visibility:{
            type:Boolean,
            default:true
        },
        createdBy:{
            type: mongoose.Types.ObjectId,
            ref: 'users',
            required: true
        },
        category:{
            type:String,
        },
        stock:{
            type:Number,
            required:true
        },
        nventas:{
            type:Number,
            default:0,
            required:false
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
)
module.exports = mongoose.model("items", ItemSchema);

