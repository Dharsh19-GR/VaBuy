const Offer = require("../models/Offer");

const isOfferActive = (offer, at = new Date()) =>
  offer.isActive && offer.startsAt <= at && offer.endsAt >= at;

const calculateDiscount = (price, offer) => {
  if (!offer || price <= 0) return 0;
  const discount = offer.discountType === "percentage"
    ? price * offer.value / 100
    : offer.value;
  return Number(Math.min(price, discount).toFixed(2));
};

const getOfferContext = async (products, { referralCode = "", at = new Date() } = {}) => {
  const productIds = products.map((product) => product._id);
  const categoryIds = products.map((product) => product.category?._id || product.category).filter(Boolean);
  const [offers, referralOffer] = await Promise.all([
    Offer.find({
      type: { $in: ["product", "category"] },
      isActive: true,
      startsAt: { $lte: at },
      endsAt: { $gte: at },
      $or: [
        { type: "product", product: { $in: productIds } },
        { type: "category", category: { $in: categoryIds } },
      ],
    }).lean(),
    referralCode
      ? Offer.findOne({
        type: "referral",
        code: String(referralCode).trim().toUpperCase(),
        isActive: true,
        startsAt: { $lte: at },
        endsAt: { $gte: at },
      }).lean()
      : null,
  ]);
  return { offers, referralOffer };
};

const getBestProductOffer = (product, offers) => {
  const productId = String(product._id);
  const categoryId = String(product.category?._id || product.category);
  return offers
    .filter((offer) =>
      (offer.type === "product" && String(offer.product) === productId) ||
      (offer.type === "category" && String(offer.category) === categoryId),
    )
    .map((offer) => ({ offer, discount: calculateDiscount(Number(product.price), offer) }))
    .sort((left, right) => right.discount - left.discount)[0] || { offer: null, discount: 0 };
};

const applyReferralDiscount = (cartItems, offer) => {
  const preReferralSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalDiscount = calculateDiscount(preReferralSubtotal, offer);
  let assigned = 0;
  cartItems.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    const lineDiscount = index === cartItems.length - 1
      ? Number((totalDiscount - assigned).toFixed(2))
      : Number((preReferralSubtotal ? totalDiscount * lineTotal / preReferralSubtotal : 0).toFixed(2));
    assigned = Number((assigned + lineDiscount).toFixed(2));
    item.referralDiscount = lineDiscount;
  });
  return { totalDiscount, preReferralSubtotal, subtotal: Number((preReferralSubtotal - totalDiscount).toFixed(2)) };
};

module.exports = { isOfferActive, calculateDiscount, getOfferContext, getBestProductOffer, applyReferralDiscount };
