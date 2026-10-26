const WalletTransaction = require("../models/WalletTransaction");
const Order = require("../models/Order");

const creditOrderRefund = async (order, reason) => {
  if (!["cancelled", "returned"].includes(order.status)) {
    throw new Error(`Order ${order.orderNumber} is not eligible for a wallet refund.`);
  }
  if (order.paymentStatus !== "paid") {
    await Order.updateOne({ _id: order._id }, { walletRefundStatus: "not_required" });
    return null;
  }
  let transaction;
  try {
    transaction = await WalletTransaction.findOneAndUpdate(
      { order: order._id, type: "order_refund" },
      {
        $setOnInsert: {
          user: order.user,
          order: order._id,
          type: "order_refund",
          amount: order.total,
          reason: String(reason || "Order refund").slice(0, 500),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    transaction = await WalletTransaction.findOne({ order: order._id, type: "order_refund" });
  }
  if (!transaction) throw new Error(`Unable to record wallet refund for order ${order.orderNumber}.`);
  await Order.updateOne({ _id: order._id }, { walletRefundStatus: "completed" });
  return transaction;
};

const reconcilePendingRefunds = async (userId) => {
  const pendingOrders = await Order.find({
    user: userId,
    status: { $in: ["cancelled", "returned"] },
    paymentStatus: "paid",
    walletRefundStatus: "pending",
  });
  for (const order of pendingOrders) {
    await creditOrderRefund(
      order,
      order.status === "returned" ? "Approved return refund" : "Cancelled order refund",
    );
  }
};

module.exports = { creditOrderRefund, reconcilePendingRefunds };
