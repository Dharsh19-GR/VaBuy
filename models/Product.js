const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: { type: String, trim: true, default: "" },
    slug: {
      type: String,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    couponCode: {
      type: String,
      trim: true,
      default: "",
    },
    couponDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    maxPerOrder: {
      type: Number,
      min: 1,
      max: 99,
      default: 5,
    },
    soldCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    images: {
      type: [String],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 3,
        message: "A product must have at least 3 images.",
      },
      required: true,
    },
    imageNote: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    highlights: {
      type: [String],
      default: [],
    },
    specifications: {
      type: [
        {
          name: { type: String, trim: true },
          value: { type: String, trim: true },
        },
      ],
      default: [],
    },
    reviews: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
          name: { type: String, trim: true },
          rating: { type: Number, min: 1, max: 5 },
          title: { type: String, trim: true },
          text: { type: String, trim: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    sampleContentInitialized: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
