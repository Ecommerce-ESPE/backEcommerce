const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        name:{
            type:String,
        },
        email:{
            type:String,
            unique: true,
            require: true
        },
        password:{
            type:String,
            require: true
        },
        role:{
            type:["USER", "ADMIN", "DEV"],
            default: "USER"
        },
        address:{
            type:Object,
        },
        phone:{
            type: String
        },
        profileUrl:{
            type: String
        },
        transactions:{
            type: String

            //type: mongoose.Types.ObjectId,
            //ref: 'transactions',
            //required: false
        }, 
        config:{
            type: String
        },
        credits:{
            type: Number,
            default:0 
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
)
UserSchema.method("toJSON", function () {
  const { _id, password, ...object } = this.toObject();
  object.uid = _id;
  return object;
});

module.exports = mongoose.model("users", UserSchema);