const mongoose = require("mongoose");

const redemptionCodeSchema  = new mongoose.Schema(
    {
        code:{
            type:String,
        },
        value:{
            type:Number,
            default: 0
        },
        redeemed:{
            type:Boolean,
            default: false
        },
        createdBy:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
)
module.exports = mongoose.model("redemptionCode", redemptionCodeSchema );

