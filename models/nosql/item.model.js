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
        //brand: {
        //    type: mongoose.Schema.Types.ObjectId,
        //    ref: 'brands',
        //    required: true
        //},
        //tags: [
        //    {
        //        type: mongoose.Schema.Types.ObjectId,
        //        ref: 'tags',
        //    }
        //],
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
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

