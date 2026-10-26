const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 100 },
    type: { type: String, enum: ["product", "category", "referral"], required: true, index: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 30, default: undefined },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

offerSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "referral", code: { $type: "string" } },
  },
);
offerSchema.index({ type: 1, isActive: 1, startsAt: 1, endsAt: 1 });

offerSchema.pre("validate", function () {
  if (this.type === "referral") {
    this.code = String(this.code || "").trim().toUpperCase();
    this.product = null;
    this.category = null;
  } else if (this.type === "product") {
    this.code = undefined;
    this.category = null;
  } else if (this.type === "category") {
    this.code = undefined;
    this.product = null;
  }
  if (this.discountType === "percentage" && this.value > 100) {
    this.invalidate("value", "Percentage discounts cannot exceed 100%.");
  }
});

module.exports = mongoose.model("Offer", offerSchema);
