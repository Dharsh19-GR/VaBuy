const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "" },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    baseUnitPrice: { type: Number, min: 0, default: null },
    productOfferDiscount: { type: Number, min: 0, default: 0 },
    couponDiscount: { type: Number, min: 0, default: 0 },
    referralDiscount: { type: Number, min: 0, default: 0 },
    couponCode: { type: String, default: "" },
    couponDiscountPercent: { type: Number, default: 0 },
  },
  { _id: false },
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    label: String,
    recipient: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city: { type: String, required: true },
    region: { type: String, default: "" },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: addressSnapshotSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    grossSubtotal: { type: Number, min: 0, default: null },
    offerDiscount: { type: Number, min: 0, default: 0 },
    couponDiscount: { type: Number, min: 0, default: 0 },
    referralDiscount: { type: Number, min: 0, default: 0 },
    referralCode: { type: String, default: "" },
    paymentMethod: { type: String, enum: ["cash_on_delivery", "razorpay", "paypal"], default: "cash_on_delivery" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    paymentProviderOrderId: { type: String, default: "" },
    paymentApprovalUrl: { type: String, default: "" },
    paymentCancelToken: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancellation_requested", "cancelled", "return_requested", "returned"],
      default: "pending",
      index: true,
    },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    cancellationPreviousStatus: { type: String, enum: ["pending", "confirmed", ""], default: "" },
    returnRequestedAt: { type: Date, default: null },
    returnReason: { type: String, default: "" },
    returnedAt: { type: Date, default: null },
    walletRefundStatus: { type: String, enum: ["not_required", "pending", "completed"], default: "not_required" },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1, status: 1 });

module.exports = mongoose.model("Order", orderSchema);
