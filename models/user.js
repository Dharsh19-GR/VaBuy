const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "Home" },
    recipient: { type: String, trim: true, required: true, maxlength: 80 },
    phone: { type: String, trim: true, required: true, maxlength: 24 },
    line1: { type: String, trim: true, required: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120, default: "" },
    city: { type: String, trim: true, required: true, maxlength: 80 },
    region: { type: String, trim: true, maxlength: 80, default: "" },
    postalCode: { type: String, trim: true, required: true, maxlength: 20 },
    country: { type: String, trim: true, required: true, maxlength: 80, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: false,
    },

    authProviders: {
      type: [
        {
          provider: { type: String, enum: ["google", "facebook"], required: true },
          providerId: { type: String, required: true },
        },
      ],
      default: [],
    },

    phone: { type: String, trim: true, maxlength: 24, default: "" },
    referralOfferCode: { type: String, trim: true, uppercase: true, maxlength: 30, default: "" },
    addresses: {
      type: [addressSchema],
      default: [],
      validate: {
        validator: (addresses) => addresses.length <= 20,
        message: "You can save up to 20 addresses.",
      },
    },
    cart: {
      type: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, min: 1, max: 99, required: true },
      }],
      default: [],
    },
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      default: [],
      validate: { validator: (items) => items.length <= 100, message: "A wishlist can contain up to 100 products." },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  if (this.$locals.passwordAlreadyHashed) {
    this.$locals.passwordAlreadyHashed = false;
    return;
  }
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
