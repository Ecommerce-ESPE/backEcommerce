const mongoose = require("mongoose");

const UserAddressSchema = new mongoose.Schema({
  provincia: {
    type: String,
    required: false
  },
  canton: {
    type: String,
    required: false
  },
  parroquia: {
    type: String,
    required: false
  },
  directionPrincipal: {
    type: String,
    default: ""
  },
  nCasa: {
    type: String,
    default: ""
  },
  codepostal: {
    type: String,
    default: ""
  },
  telefono: {
    type: String,
    default: ""
  }
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      unique: true,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    ci:{
        type: String,
        unique: true,
        required: false
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN", "DEV"],
      default: "USER",
      immutable: true 
    },
    address: [
      {
      type: UserAddressSchema,
      default: () => ({})
      }
    ],
    phone: {
      type: String,
      default: "",
      required: false
    },
    profileUrl: {
      type: String,
      default: "https://ejemplo.com/default-avatar.jpg",
      required: false
    },
    config: {
      type: String,
      default: "",
      required: false
    },
    credits: {
      type: Number,
      default: 0,
      required: false
    },
    public_id: {
      type: String,
      default: "",
      required: false
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.method("toJSON", function () {
  const { _id, password, ...object } = this.toObject();
  object.uid = _id;
  return object;
});

module.exports = mongoose.model("users", UserSchema);