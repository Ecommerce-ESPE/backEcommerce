const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema(
    {
        namefranchise:{
            type:String,
        },
        confg:{
            type:String,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
)
module.exports = mongoose.model("businnes", BusinessSchema);

