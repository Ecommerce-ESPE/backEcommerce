const mongoose = require("mongoose");
const uuid = require('uuid');

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

