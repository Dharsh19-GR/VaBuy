const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/user");
const Order = require("../models/Order");
const WalletTransaction = require("../models/WalletTransaction");
const {
  isRazorpayConfigured,
  isPayPalConfigured,
  createRazorpayOrder,
  getRazorpayPayment,
  getRazorpayOrderPayments,
  verifyRazorpaySignature,
  createPayPalOrder,
  getPayPalOrder,
  capturePayPalOrder,
  getPayPalCapturedAmount,
} = require("../services/payment-gateways");
const { creditOrderRefund, reconcilePendingRefunds } = require("../services/wallet");
const { calculateDiscount, getOfferContext, getBestProductOffer, applyReferralDiscount } = require("../services/offer-pricing");
const PDFDocument = require("pdfkit");

const router = express.Router();
const DEFAULT_MAX_PER_ORDER = 5;
const getDeliveryCharge = (postalCode = "") => {
  const fixed = Number(process.env.DELIVERY_CHARGE_INR ?? 8);
  const defaultCharge = Number.isFinite(fixed) && fixed >= 0 ? fixed : 8;
  try {
    const byPrefix = JSON.parse(process.env.DELIVERY_CHARGES_BY_POSTAL_PREFIX || "{}");
    const prefix = Object.keys(byPrefix).sort((a, b) => b.length - a.length).find((key) => String(postalCode).startsWith(key));
    const locationCharge = prefix ? Number(byPrefix[prefix]) : NaN;
    return Number.isFinite(locationCharge) && locationCharge >= 0 ? locationCharge : defaultCharge;
  } catch (_error) { return defaultCharge; }
};

const ensureCustomer = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "user") return res.redirect("/login");
  next();
};

const validId = (value) => mongoose.Types.ObjectId.isValid(value);

const getProductLimit = (product) => {
  const configuredLimit = Number(product.maxPerOrder);
  return Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? Math.min(99, configuredLimit)
    : DEFAULT_MAX_PER_ORDER;
};

const getCartItems = async (req) => {
  const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
  const productIds = cart.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds }, isDeleted: false })
    .populate({ path: "category", match: { isDeleted: false }, select: "name" })
    .lean();
  if (!products.length) return [];
  const { offers } = await getOfferContext(products);

  return cart.flatMap((cartItem) => {
    const product = products.find((item) => String(item._id) === String(cartItem.productId));
    if (!product || !product.category) return [];
    const basePrice = Number(product.price);
    const productOffer = getBestProductOffer(product, offers);
    const offerPrice = Number((basePrice - productOffer.discount).toFixed(2));
    const appliedCouponCode = String(req.session.appliedCouponCode || "");
    const couponMatches = appliedCouponCode &&
      String(product.couponCode || "").toUpperCase() === appliedCouponCode &&
      Number(product.couponDiscountPercent) > 0;
    const couponDiscountPercent = couponMatches ? Number(product.couponDiscountPercent) : 0;
    const couponDiscount = couponMatches
      ? Number((offerPrice * couponDiscountPercent / 100).toFixed(2))
      : 0;
    const price = Number((offerPrice - couponDiscount).toFixed(2));
    return [{
      ...product,
      id: product._id,
      quantity: cartItem.quantity,
      image: product.images?.[0] || "",
      basePrice,
      offerDiscount: productOffer.discount,
      offerPrice,
      offerName: productOffer.offer?.name || "",
      couponDiscount,
      couponCode: couponMatches ? product.couponCode : "",
      couponDiscountPercent,
      maxPerOrder: getProductLimit(product),
      price,
    }];
  });
};

const getReferralPricing = async (req, cartItems) => {
  if (!req.session.user?.id || !cartItems.length) {
    return { referralOffer: null, referralCode: "", referralDiscount: 0, subtotal: getSubtotal(cartItems) };
  }
  const user = await User.findById(req.session.user.id).select("referralOfferCode").lean();
  const referralCode = String(user?.referralOfferCode || "");
  if (!referralCode) {
    return { referralOffer: null, referralCode: "", referralDiscount: 0, subtotal: getSubtotal(cartItems) };
  }
  const previousOrder = await Order.exists({
    user: req.session.user.id,
  });
  if (previousOrder) {
    return { referralOffer: null, referralCode: "", referralDiscount: 0, subtotal: getSubtotal(cartItems) };
  }
  const { referralOffer } = await getOfferContext([], { referralCode });
  if (!referralOffer) {
    return { referralOffer: null, referralCode: "", referralDiscount: 0, subtotal: getSubtotal(cartItems) };
  }
  const referral = applyReferralDiscount(cartItems, referralOffer);
  return {
    referralOffer,
    referralCode,
    referralDiscount: referral.totalDiscount,
    subtotal: referral.subtotal,
  };
};

const getCartPricing = async (req) => {
  const items = await getCartItems(req);
  const referral = await getReferralPricing(req, items);
  return { items, ...referral };
};

const getCartCount = (req) =>
  (Array.isArray(req.session.cart) ? req.session.cart : []).reduce((count, item) => count + item.quantity, 0);

const persistCustomerCart = async (req) => {
  if (!req.session.user || req.session.user.role !== "user") return;
  const cart = (Array.isArray(req.session.cart) ? req.session.cart : [])
    .filter((item) => validId(item.productId) && Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0)
    .map((item) => ({ product: item.productId, quantity: Math.min(99, Number(item.quantity)) }));
  await User.updateOne({ _id: req.session.user.id }, { $set: { cart } });
};

const clearCustomerCart = async (req) => {
  req.session.cart = [];
  delete req.session.appliedCouponCode;
  await persistCustomerCart(req);
};

const restoreOrderToCart = (req, order) => {
  req.session.cart = order.items.map((item) => ({ productId: item.product, quantity: item.quantity }));
  const couponItem = order.items.find((item) => item.couponCode);
  if (couponItem) req.session.appliedCouponCode = couponItem.couponCode.toUpperCase();
  else delete req.session.appliedCouponCode;
};

const getWishlistIds = (req) =>
  Array.isArray(req.session.wishlist) ? req.session.wishlist.map(String) : [];

router.use(async (req, _res, next) => {
  if (!req.session.user || req.session.user.role !== "user" || req.session.wishlistLoaded) return next();
  try {
    const user = await User.findById(req.session.user.id).select("wishlist").lean();
    const wishlist = [...new Set([
      ...(user?.wishlist || []).map(String),
      ...getWishlistIds(req),
    ].filter(validId))].slice(0, 100);
    req.session.wishlist = wishlist;
    req.session.wishlistLoaded = true;
    if (user) await User.updateOne({ _id: user._id }, { $set: { wishlist } });
    return next();
  } catch (error) {
    return next(error);
  }
});

const getReturnPath = (value, fallback = "/") => {
  const path = String(value || "");
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
};

const withNotice = (path, notice) => `${path}${path.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`;

const getSubtotal = (cartItems) =>
  cartItems.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 100);
  const categoryId = String(req.query.category || "").trim();
  const sortBy = String(req.query.sort || "newest");
  if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).send("Select a valid product category.");
  }

  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).lean();
  const filter = { isDeleted: false };
  if (categoryId) filter.category = categoryId;
  if (query) filter.name = { $regex: escapeRegex(query), $options: "i" };
  const sortOptions = {
    popularity: { soldCount: -1, rating: -1 },
    "price-low": { price: 1 },
    "price-high": { price: -1 },
    rating: { rating: -1 },
    featured: { isFeatured: -1, soldCount: -1 },
    newest: { createdAt: -1 },
    "name-asc": { name: 1 },
    "name-desc": { name: -1 },
  };
  const sort = sortOptions[sortBy] || sortOptions.newest;
  const stockFilter = String(req.query.stock || "available");
  if (stockFilter === "available") filter.stock = { $gt: 0 };
  else if (stockFilter === "sold-out") filter.stock = 0;

  const products = await Product.find(filter)
    .populate({ path: "category", match: { isDeleted: false }, select: "name slug" })
    .sort(sort)
    .lean();
  const { offers } = await getOfferContext(products);
  const normalizedProducts = products.filter((product) => product.category).map((product) => ({
    ...product,
    id: product._id,
    category: product.category?.name || "Uncategorized",
    categorySlug: product.category?.slug || "",
    image: product.images?.[0] || "/images/placeholder.jpg",
    offer: getBestProductOffer(product, offers).offer,
    offerDiscount: getBestProductOffer(product, offers).discount,
    offerPrice: Number((Number(product.price) - getBestProductOffer(product, offers).discount).toFixed(2)),
    isWishlisted: getWishlistIds(req).includes(String(product._id)),
  }));
  return res.render("home", {
    products: normalizedProducts,
    categories,
    filters: { q: query, category: categoryId, sort: sortBy, stock: stockFilter },
    cartCount: getCartCount(req),
    currentUser: req.session.user || null,
    returnTo: req.originalUrl,
  });
});

router.get("/api/categories", async (_req, res) => {
  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 }).select("name slug").lean();
  res.json(categories);
});

router.get("/categories/:slug", async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isDeleted: false }).lean();
  if (!category) return res.status(404).send("Category not found.");

  const query = String(req.query.q || "").trim().slice(0, 100);
  const sortBy = String(req.query.sort || "newest");
  const stockFilter = ["available", "sold-out", "all"].includes(req.query.stock) ? req.query.stock : "available";
  const filter = { category: category._id, isDeleted: false };
  if (query) filter.name = { $regex: escapeRegex(query), $options: "i" };
  if (stockFilter === "available") filter.stock = { $gt: 0 };
  else if (stockFilter === "sold-out") filter.stock = 0;
  const sortOptions = {
    newest: { createdAt: -1 }, popularity: { soldCount: -1, rating: -1 },
    "price-low": { price: 1 }, "price-high": { price: -1 }, rating: { rating: -1 },
  };
  const products = await Product.find(filter)
    .populate({ path: "category", match: { isDeleted: false }, select: "name slug" })
    .sort(sortOptions[sortBy] || sortOptions.newest)
    .lean();
  const { offers } = await getOfferContext(products);
  const normalizedProducts = products.filter((product) => product.category).map((product) => {
    const productOffer = getBestProductOffer(product, offers);
    return {
      ...product,
      id: product._id,
      category: product.category.name,
      categorySlug: product.category.slug,
      image: product.images?.[0] || "/images/placeholder.jpg",
      offer: productOffer.offer,
      offerDiscount: productOffer.discount,
      offerPrice: Number((Number(product.price) - productOffer.discount).toFixed(2)),
      isWishlisted: getWishlistIds(req).includes(String(product._id)),
    };
  });

  return res.render("category", {
    category,
    products: normalizedProducts,
    filters: { q: query, sort: sortBy, stock: stockFilter },
    cartCount: getCartCount(req),
    currentUser: req.session.user || null,
    returnTo: getReturnPath(req.query.returnTo, req.originalUrl),
  });
});

router.get("/login", (req, res) => res.render("login", {
  currentUser: req.session.user || null,
  returnTo: getReturnPath(req.query.returnTo, "/"),
  message: String(req.query.message || "").slice(0, 160),
}));
router.post("/login", (req, res) => res.redirect("/"));
router.get("/register", (req, res) => res.render("register", { currentUser: req.session.user || null }));
router.post("/register", (req, res) => res.redirect("/login"));
router.get("/verify-otp", (req, res) =>
  res.render("otp", {
    email: req.session.pendingUser?.email || "",
    purpose: "registration",
    error: null,
    expiresAt: req.session.otpExpiresAt,
    resendAfter: req.session.otpSentAt,
  }),
);
router.post("/verify-otp", (req, res) => res.redirect("/login"));
router.get("/forgot-password", (req, res) => res.render("forgot-password"));
router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
});
router.get("/products/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Product not found.");
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false })
    .populate({ path: "category", match: { isDeleted: false }, select: "name slug" })
    .lean();
  if (!product || !product.category) return res.status(404).send("Product not found.");
  const offerContext = await getOfferContext([product]);
  const productOffer = getBestProductOffer(product, offerContext.offers);
  const offerPrice = Number((Number(product.price) - productOffer.discount).toFixed(2));
  let relatedProducts = await Product.find({
    _id: { $ne: product._id },
    category: product.category._id,
    isDeleted: false,
  })
    .limit(4)
    .select("name price compareAtPrice rating stock images")
    .lean();
  if (relatedProducts.length < 4) {
    const otherProducts = await Product.find({
      _id: { $ne: product._id, $nin: relatedProducts.map((related) => related._id) },
      isDeleted: false,
    })
      .sort({ rating: -1, createdAt: -1 })
      .limit(4 - relatedProducts.length)
      .select("name price compareAtPrice rating stock images")
      .lean();
    relatedProducts = [...relatedProducts, ...otherProducts];
  }
  product.id = product._id;
  product.categoryId = product.category._id;
  product.categoryName = product.category.name;
  product.categorySlug = product.category.slug;
  product.category = product.category.name;
  product.images = product.images || [];
  const discountPercent = product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;
  const couponPrice = product.couponDiscountPercent > 0
    ? Number((offerPrice * (1 - product.couponDiscountPercent / 100)).toFixed(2))
    : null;
  const wishlistIds = getWishlistIds(req);
  const reviewedByUser = req.session.user?.role === "user" && product.reviews.some((review) => String(review.user || "") === String(req.session.user.id));
  const reviewOrder = req.session.user?.role === "user" && !reviewedByUser
    ? await Order.findOne({ user: req.session.user.id, status: "delivered", paymentStatus: "paid", "items.product": product._id }).select("_id").lean()
    : null;
  return res.render("product-details", {
    product,
    relatedProducts: relatedProducts.map((related) => ({
      ...related,
      id: related._id,
      image: related.images?.[0] || "/images/backpack-1.svg",
      isWishlisted: wishlistIds.includes(String(related._id)),
    })),
    discountPercent,
    couponPrice,
    productOffer: productOffer.offer,
    offerDiscount: productOffer.discount,
    offerPrice,
    cartCount: getCartCount(req),
    currentUser: req.session.user || null,
    isWishlisted: wishlistIds.includes(String(product._id)),
    canReview: Boolean(reviewOrder),
    hasReviewed: reviewedByUser,
    returnTo: getReturnPath(req.query.returnTo, `/categories/${encodeURIComponent(product.categorySlug)}`),
  });
});

router.post("/products/:id/reviews", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Product not found.");
  const rating = Number(req.body.rating);
  const title = String(req.body.title || "").trim().slice(0, 100);
  const text = String(req.body.text || "").trim().slice(0, 1500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !title || text.length < 5) {
    return res.status(400).send("Provide a 1–5 star rating, a title, and a review of at least 5 characters.");
  }
  const order = await Order.findOne({ user: req.session.user.id, status: "delivered", paymentStatus: "paid", "items.product": req.params.id }).select("_id").lean();
  if (!order) return res.status(403).send("Only customers with a delivered, paid order can review this product.");
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) return res.status(404).send("Product not found.");
  if (product.reviews.some((review) => String(review.user || "") === String(req.session.user.id))) {
    return res.redirect(`/products/${product._id}#reviews`);
  }
  product.reviews.push({ user: req.session.user.id, order: order._id, name: req.session.user.name, rating, title, text });
  product.rating = Number((product.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / product.reviews.length).toFixed(2));
  await product.save();
  return res.redirect(`/products/${product._id}#reviews`);
});
router.get("/product-details", async (req, res) => {
  const product = await Product.findOne({ isDeleted: false }).sort({ createdAt: 1 }).lean();
  if (!product) return res.status(404).send("No products available.");
  return res.redirect(`/products/${product._id}`);
});

router.get("/cart", async (req, res) => {
  let cartItems = await getCartItems(req);
  if (req.session.appliedCouponCode && !cartItems.some((item) => item.couponDiscountPercent > 0)) {
    delete req.session.appliedCouponCode;
    cartItems = await getCartItems(req);
  }
  const referral = await getReferralPricing(req, cartItems);
  const subtotal = referral.subtotal;
  const shipping = cartItems.length ? getDeliveryCharge() : 0;
  return res.render("cart", {
    cartItems,
    subtotal,
    shipping,
    cartCount: getCartCount(req),
    error: req.query.error || "",
    appliedCouponCode: req.session.appliedCouponCode || "",
    referralCode: referral.referralCode,
    referralDiscount: referral.referralDiscount,
    offerDiscount: cartItems.reduce((sum, item) => sum + item.offerDiscount * item.quantity, 0),
    couponDiscount: cartItems.reduce((sum, item) => sum + item.couponDiscount * item.quantity, 0),
  });
});

router.post("/cart/coupon", async (req, res) => {
  const code = String(req.body?.code || "").trim().slice(0, 30).toUpperCase();
  if (!code) return res.redirect(`/cart?error=${encodeURIComponent("Enter a coupon code.")}`);
  const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
  const products = await Product.find({
    _id: { $in: cart.map((item) => item.productId) },
    isDeleted: false,
  }).select("couponCode couponDiscountPercent").lean();
  const couponExists = products.some((product) =>
    String(product.couponCode || "").toUpperCase() === code &&
    Number(product.couponDiscountPercent) > 0,
  );
  if (!couponExists) {
    return res.redirect(`/cart?error=${encodeURIComponent("That coupon is not valid for items in your cart.")}`);
  }
  req.session.appliedCouponCode = code;
  return res.redirect(withNotice(getReturnPath(req.body.returnTo, "/cart"), "Coupon applied to eligible items."));
});

router.post("/cart/coupon/remove", (req, res) => {
  delete req.session.appliedCouponCode;
  return res.redirect("/cart");
});

router.post("/cart", async (req, res) => {
  if (!req.session.user || req.session.user.role !== "user") {
    const returnTo = getReturnPath(req.body?.returnTo, "/");
    return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}&message=${encodeURIComponent("Sign in to add products to your cart.")}`);
  }
  const productId = req.body.productId;
  const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).send("Select a valid product and quantity.");
  }
  const product = await Product.findOne({ _id: productId, isDeleted: false })
    .populate({ path: "category", match: { isDeleted: false }, select: "name" })
    .lean();

  if (!product || !product.category || !Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).send("Select a valid product and quantity.");
  }

  const cart = Array.isArray(req.session.cart) ? req.session.cart.map((item) => ({ productId: item.productId, quantity: item.quantity })) : [];
  const existingItem = cart.find((item) => String(item.productId) === String(productId));
  const updatedQuantity = (existingItem?.quantity || 0) + quantity;
  const maximumQuantity = Math.min(getProductLimit(product), product.stock);
  if (updatedQuantity > maximumQuantity) {
    return res.redirect(`/cart?error=${encodeURIComponent(`Maximum quantity for ${product.name} is ${maximumQuantity}.`)}`);
  }

  if (existingItem) {
    existingItem.quantity = updatedQuantity;
  } else {
    cart.push({ productId, quantity });
  }
  req.session.cart = cart;
  await persistCustomerCart(req);
  return res.redirect(withNotice(getReturnPath(req.body.returnTo, "/cart"), `${product.name} added to your cart.`));
});

router.post("/cart/update/:id", async (req, res) => {
  const productId = req.params.id;
  const quantity = Number(req.body.quantity);
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).send("Select a valid quantity.");
  }
  const product = await Product.findOne({ _id: productId, isDeleted: false }).lean();
  const maximumQuantity = product ? Math.min(getProductLimit(product), product.stock) : 0;
  if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > maximumQuantity) {
    return res.status(400).send("Select a valid quantity.");
  }

  const cart = Array.isArray(req.session.cart) ? [...req.session.cart] : [];
  const item = cart.find((cartItem) => String(cartItem.productId) === String(productId));
  if (!item) return res.status(404).send("Cart item not found.");
  item.quantity = quantity;
  req.session.cart = cart;
  await persistCustomerCart(req);
  return res.redirect("/cart");
});

router.post("/cart/remove/:id", async (req, res) => {
  const productId = req.params.id;
  req.session.cart = (Array.isArray(req.session.cart) ? req.session.cart : []).filter(
    (item) => String(item.productId) !== String(productId),
  );
  await persistCustomerCart(req);
  return res.redirect("/cart");
});

router.get("/wishlist", async (req, res) => {
  const wishlistIds = getWishlistIds(req).filter(validId);
  const products = await Product.find({ _id: { $in: wishlistIds }, isDeleted: false })
    .populate({ path: "category", match: { isDeleted: false }, select: "name" })
    .lean();
  const wishlist = products.filter((product) => product.category).map((product) => ({
    ...product,
    id: product._id,
    category: product.category.name,
    image: product.images?.[0] || "/images/placeholder.jpg",
    isWishlisted: true,
  }));
  res.render("wishlist", { wishlist });
});

router.post("/wishlist/toggle/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Product not found.");
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).select("_id").lean();
  if (!product) return res.status(404).send("Product not found.");
  const wishlist = getWishlistIds(req).filter((id) => validId(id));
  const productId = String(product._id);
  const existingIndex = wishlist.indexOf(productId);
  if (existingIndex >= 0) wishlist.splice(existingIndex, 1);
  else {
    if (wishlist.length >= 100) return res.status(400).send("Your wishlist can contain up to 100 products.");
    wishlist.push(productId);
  }
  req.session.wishlist = wishlist;
  if (req.session.user?.role === "user") {
    req.session.wishlistLoaded = true;
    await User.updateOne({ _id: req.session.user.id }, { $set: { wishlist } });
  }
  return res.redirect(withNotice(getReturnPath(req.body.returnTo, "/"), existingIndex >= 0 ? "Removed from your wishlist." : "Added to your wishlist."));
});

const normalizeAddress = (body) => ({
  label: String(body.label || "Home").trim().slice(0, 40),
  recipient: String(body.recipient || "").trim().slice(0, 80),
  phone: String(body.phone || "").trim().slice(0, 24),
  line1: String(body.line1 || "").trim().slice(0, 120),
  line2: String(body.line2 || "").trim().slice(0, 120),
  city: String(body.city || "").trim().slice(0, 80),
  region: String(body.region || "").trim().slice(0, 80),
  postalCode: String(body.postalCode || "").trim().slice(0, 20),
  country: String(body.country || "").trim().slice(0, 80),
  isDefault: body.isDefault === "on",
});

const validateAddress = (address) =>
  address.recipient.length >= 2 &&
  address.phone.length >= 7 &&
  address.line1.length >= 4 &&
  address.city.length >= 2 &&
  address.postalCode.length >= 3 &&
  address.country.length >= 2;

const ensureSingleDefaultAddress = (user, addressId) => {
  user.addresses.forEach((address) => {
    address.isDefault = addressId ? String(address._id) === String(addressId) : false;
  });
};

router.get("/profile", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id).select("-password");
  if (!user) return res.status(404).send("User account not found.");
  const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean();
  const defaultAddress = user.addresses.find((address) => address.isDefault) || user.addresses[0] || null;
  res.render("profile", {
    user,
    orders,
    defaultAddress,
    message: req.query.message || "",
  });
});

router.get("/profile/edit", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id).select("-password");
  if (!user) return res.status(404).send("User account not found.");
  const addressDraft = user.addresses.find((address) => address.isDefault) || user.addresses[0] || {};
  res.render("edit-profile", { user, addressDraft, error: null });
});

router.post("/profile/edit", ensureCustomer, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  if (name.length < 2 || name.length > 80 || (phone && !/^[+()\d\s.-]{7,24}$/.test(phone))) {
    const user = await User.findById(req.session.user.id).select("-password");
    return res.status(400).render("edit-profile", {
      user,
      addressDraft: req.body,
      error: "Enter a valid name and phone number.",
    });
  }
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  const addressFields = ["recipient", "phone", "line1", "line2", "city", "region", "postalCode"];
  const hasAddressInput = addressFields.some((field) => String(req.body[`address${field[0].toUpperCase()}${field.slice(1)}`] || "").trim());
  if (hasAddressInput) {
    const address = normalizeAddress({
      label: req.body.addressLabel,
      recipient: req.body.addressRecipient,
      phone: req.body.addressPhone,
      line1: req.body.addressLine1,
      line2: req.body.addressLine2,
      city: req.body.addressCity,
      region: req.body.addressRegion,
      postalCode: req.body.addressPostalCode,
      country: req.body.addressCountry,
    });
    if (!validateAddress(address)) {
      return res.status(400).render("edit-profile", {
        user,
        addressDraft: req.body,
        error: "Complete the required fields for the address, or leave the address section blank.",
      });
    }
    const savedAddress = user.addresses.find((item) => item.isDefault) || user.addresses[0];
    if (savedAddress) savedAddress.set({ ...address, isDefault: true });
    else user.addresses.push({ ...address, isDefault: true });
    ensureSingleDefaultAddress(user, savedAddress?._id || user.addresses[user.addresses.length - 1]._id);
  }
  user.name = name;
  user.phone = phone;
  await user.save();
  req.session.user.name = user.name;
  return res.redirect("/profile?message=Profile%20updated");
});

router.post("/profile/addresses", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  if (user.addresses.length >= 20) return res.status(400).send("You can save up to 20 addresses.");
  const address = normalizeAddress(req.body);
  if (!validateAddress(address)) return res.status(400).send("Enter all required address and contact details.");
  if (address.isDefault || user.addresses.length === 0) address.isDefault = true;
  const addressDoc = user.addresses.create(address);
  if (address.isDefault || user.addresses.length === 0) ensureSingleDefaultAddress(user, addressDoc._id);
  user.addresses.push(addressDoc);
  await user.save();
  return res.redirect("/profile?message=Address%20added");
});

router.post("/profile/addresses/:id", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  const address = user.addresses.id(req.params.id);
  if (!address) return res.status(404).send("Address not found.");
  const updated = normalizeAddress(req.body);
  if (!validateAddress(updated)) return res.status(400).send("Enter all required address and contact details.");
  address.set(updated);
  if (updated.isDefault) ensureSingleDefaultAddress(user, address._id);
  await user.save();
  return res.redirect("/profile?message=Address%20updated");
});

router.post("/profile/addresses/:id/delete", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  const address = user.addresses.id(req.params.id);
  if (!address) return res.status(404).send("Address not found.");
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
  return res.redirect("/profile?message=Address%20removed");
});

router.post("/profile/addresses/:id/default", ensureCustomer, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  if (!user.addresses.id(req.params.id)) return res.status(404).send("Address not found.");
  ensureSingleDefaultAddress(user, req.params.id);
  await user.save();
  return res.redirect("/profile?message=Default%20address%20updated");
});

router.get("/orders", ensureCustomer, async (req, res) => {
  const orders = await Order.find({ user: req.session.user.id }).sort({ createdAt: -1 }).lean();
  res.render("orders", { orders });
});

router.get("/orders/:id", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id }).lean();
  if (!order) return res.status(404).send("Order not found.");
  const deliveredDate = order.deliveredAt || order.updatedAt || order.createdAt;
  const returnEligible = order.status === "delivered" &&
    Date.now() - new Date(deliveredDate).getTime() <= 7 * 24 * 60 * 60 * 1000;
  res.render("order-details", {
    order,
    error: req.query.error || "",
    message: req.query.message || "",
    returnEligible,
  });
});

router.get("/orders/:id/invoice.pdf", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id }).lean();
  if (!order) return res.status(404).send("Order not found.");
  res.type("application/pdf").attachment(`invoice-${order.orderNumber}.pdf`);
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);
  doc.fontSize(22).text("VaBuy Invoice").moveDown();
  doc.fontSize(11).text(`Invoice / Order: ${order.orderNumber}`)
    .text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`)
    .text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`).moveDown();
  doc.fontSize(13).text("Bill to").fontSize(11)
    .text(order.shippingAddress.recipient).text(order.shippingAddress.line1)
    .text([order.shippingAddress.line2, order.shippingAddress.city, order.shippingAddress.region, order.shippingAddress.postalCode].filter(Boolean).join(", "))
    .text(order.shippingAddress.country).moveDown();
  doc.fontSize(13).text("Items").moveDown(0.5).fontSize(10);
  order.items.forEach((item) => doc.text(`${item.name}  x ${item.quantity}  —  INR ${(item.unitPrice * item.quantity).toFixed(2)}`));
  doc.moveDown().text(`Subtotal: INR ${order.subtotal.toFixed(2)}`)
    .text(`Shipping: INR ${order.shipping.toFixed(2)}`).text(`Tax: INR ${order.tax.toFixed(2)}`)
    .font("Helvetica-Bold").text(`Total: INR ${order.total.toFixed(2)}`);
  doc.end();
});

router.post("/orders/:id/cancel", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const cancellationReason = String(req.body.reason || "Cancelled by customer").trim().slice(0, 500);
  const currentOrder = await Order.findOne({ _id: req.params.id, user: req.session.user.id, status: { $in: ["pending", "confirmed"] } }).select("status").lean();
  if (!currentOrder) return res.status(409).send("Orders can only be cancelled before they ship.");
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.session.user.id, status: currentOrder.status },
    {
      status: "cancellation_requested",
      cancellationPreviousStatus: currentOrder.status,
      cancellationReason,
    },
    { new: true },
  );
  if (!order) return res.status(409).send("Orders can only be cancelled before they ship.");
  return res.redirect(`/orders/${order._id}?message=Cancellation%20request%20sent%20for%20review`);
});

router.post("/orders/:id/return", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({ _id: req.params.id, user: req.session.user.id, status: "delivered" });
  if (!order) return res.status(409).send("Only delivered orders can be returned.");
  const deliveredDate = order.deliveredAt || order.updatedAt || order.createdAt;
  if (Date.now() - new Date(deliveredDate).getTime() > 7 * 24 * 60 * 60 * 1000) {
    return res.status(409).send("The seven-day return window has expired.");
  }
  const returnReason = String(req.body.reason || "").trim().slice(0, 500);
  if (returnReason.length < 5) return res.status(400).send("Tell us why you are requesting a return.");
  const updatedOrder = await Order.findOneAndUpdate(
    { _id: order._id, user: req.session.user.id, status: "delivered" },
    { status: "return_requested", returnRequestedAt: new Date(), returnReason },
    { new: true },
  );
  if (!updatedOrder) return res.status(409).send("This order is already being updated.");
  return res.redirect(`/orders/${order._id}?message=Return%20request%20sent%20for%20review`);
});

router.get("/wallet", ensureCustomer, async (req, res) => {
  await reconcilePendingRefunds(req.session.user.id);
  const transactions = await WalletTransaction.find({ user: req.session.user.id })
    .populate("order", "orderNumber")
    .sort({ createdAt: -1 })
    .lean();
  const balance = Number(transactions.reduce((total, entry) => total + entry.amount, 0).toFixed(2));
  return res.render("wallet", { transactions, balance });
});

router.get("/payments/razorpay/start/:id", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.session.user.id,
    paymentMethod: "razorpay",
    paymentStatus: { $in: ["pending", "failed"] },
    status: "pending",
  });
  if (!order) return res.status(409).send("This order is not awaiting Razorpay payment.");
  if (order.paymentStatus === "failed") { order.paymentStatus = "pending"; await order.save(); }
  try {
    let razorpayOrder;
    if (order.paymentProviderOrderId) {
      razorpayOrder = {
        id: order.paymentProviderOrderId,
        amount: Math.round(order.total * 100),
      };
    } else {
      razorpayOrder = await createRazorpayOrder({
        amount: order.total,
        receipt: order.orderNumber,
        orderId: order._id,
      });
      order.paymentProviderOrderId = razorpayOrder.id;
      await order.save();
    }
    return res.render("razorpay-checkout", {
      order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder,
    });
  } catch (error) {
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", paymentStatus: "pending" },
      {
        paymentStatus: "pending",
        cancellationReason: "Unable to initialize Razorpay payment",
      },
      { new: true },
    );
    console.error("Razorpay order creation failed:", error);
    return res.redirect(`/orders/${order._id}?error=${encodeURIComponent("Unable to start Razorpay payment. Please try again.")}`);
  }
});

router.post("/payments/razorpay/cancel/:id", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const existingOrder = await Order.findOne({
    _id: req.params.id,
    user: req.session.user.id,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    status: "pending",
  });
  if (!existingOrder) return res.status(409).send("Order not found or already paid.");
  if (existingOrder.paymentProviderOrderId) {
    try {
      const paymentList = await getRazorpayOrderPayments(existingOrder.paymentProviderOrderId);
      const capturedPayment = paymentList.items?.find((payment) =>
        payment.order_id === existingOrder.paymentProviderOrderId &&
        payment.status === "captured" &&
        payment.currency === "INR" &&
        payment.amount === Math.round(existingOrder.total * 100),
      );
      if (capturedPayment) {
        const updated = await Order.findOneAndUpdate(
          { _id: existingOrder._id, paymentStatus: "pending", status: "pending" },
          { paymentStatus: "paid", paymentId: capturedPayment.id },
          { new: true },
        );
        if (!updated) {
          const current = await Order.findById(existingOrder._id).select("paymentStatus paymentId");
          if (current?.paymentStatus !== "paid" || current.paymentId !== capturedPayment.id) {
            return res.status(409).send("This order is no longer awaiting payment.");
          }
        }
        await clearCustomerCart(req);
        return res.redirect(`/orders/${existingOrder._id}?message=Payment%20successful`);
      }
    } catch (error) {
      // Keep the order pending so the customer can retry if Razorpay cannot be reached.
      console.error("Razorpay cancellation status check failed:", error);
    }
  }
  const order = await Order.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.session.user.id,
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      status: "pending",
    },
    {
      paymentStatus: "pending",
      cancellationReason: "Razorpay payment cancelled",
    },
    { new: true },
  );
  if (!order) return res.status(409).send("Order not found or already paid.");
  restoreOrderToCart(req, order);
  await persistCustomerCart(req);
  return res.redirect(`/orders/${order._id}?error=Razorpay%20payment%20was%20cancelled`);
});

router.post("/payments/razorpay/verify", ensureCustomer, async (req, res) => {
  const orderId = String(req.body.localOrderId || "");
  if (!validId(orderId)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({ _id: orderId, user: req.session.user.id, paymentMethod: "razorpay" });
  if (!order) return res.status(404).send("Order not found.");
  const providerOrderId = String(req.body.razorpay_order_id || "");
  const paymentId = String(req.body.razorpay_payment_id || "");
  const signature = String(req.body.razorpay_signature || "");
  if (
    providerOrderId !== order.paymentProviderOrderId ||
    !verifyRazorpaySignature({ orderId: providerOrderId, paymentId, signature })
  ) {
    return res.redirect(`/orders/${order._id}?error=${encodeURIComponent("Payment could not be verified. Please try again.")}`);
  }
  let payment;
  try {
    payment = await getRazorpayPayment(paymentId);
  } catch (error) {
    console.error("Razorpay payment verification request failed:", error);
    return res.redirect(`/orders/${order._id}?error=${encodeURIComponent("Unable to verify payment right now. Your order is still pending; please try again.")}`);
  }
  if (
    payment.order_id !== providerOrderId ||
    payment.currency !== "INR" ||
    payment.amount !== Math.round(order.total * 100) ||
    payment.status !== "captured"
  ) {
    return res.redirect(`/orders/${order._id}?error=${encodeURIComponent("Payment has not been confirmed. You can retry from this order.")}`);
  }
  if (order.paymentStatus !== "paid") {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", paymentStatus: "pending", paymentProviderOrderId: providerOrderId },
      { paymentStatus: "paid", paymentId },
      { new: true },
    );
    if (!updated) {
      const current = await Order.findById(order._id).select("paymentStatus paymentId");
      if (current?.paymentStatus !== "paid" || current.paymentId !== paymentId) {
        return res.status(409).send("This order is no longer awaiting payment.");
      }
    }
  }
  await clearCustomerCart(req);
  return res.redirect(`/orders/${order._id}?message=Payment%20successful`);
});

router.get("/payments/paypal/start/:id", ensureCustomer, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.session.user.id,
    paymentMethod: "paypal",
    paymentStatus: { $in: ["pending", "failed"] },
    status: "pending",
  });
  if (!order) return res.status(409).send("This order is not awaiting PayPal payment.");
  if (order.paymentStatus === "failed") { order.paymentStatus = "pending"; await order.save(); }
  try {
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    let paypalOrder;
    if (order.paymentProviderOrderId && order.paymentApprovalUrl) {
      paypalOrder = { id: order.paymentProviderOrderId, approvalUrl: order.paymentApprovalUrl };
    } else {
      order.paymentCancelToken = crypto.randomBytes(32).toString("hex");
      paypalOrder = await createPayPalOrder({
        amount: order.total,
        orderNumber: order.orderNumber,
        orderId: order._id,
        cancelToken: order.paymentCancelToken,
        baseUrl,
      });
      order.paymentProviderOrderId = paypalOrder.id;
      order.paymentApprovalUrl = paypalOrder.approvalUrl;
      await order.save();
    }
    return res.redirect(paypalOrder.approvalUrl);
  } catch (error) {
    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", paymentStatus: "pending" },
      {
        paymentStatus: "pending",
        cancellationReason: "Unable to initialize PayPal payment",
      },
      { new: true },
    );
    console.error("PayPal order creation failed:", error);
    return res.redirect(`/orders/${order._id}?error=${encodeURIComponent("Unable to start PayPal payment. Please try again.")}`);
  }
});

router.get("/payments/paypal/capture", async (req, res) => {
  const providerOrderId = String(req.query.token || "");
  if (!providerOrderId) return res.status(400).send("PayPal payment token is missing.");
  const order = await Order.findOne({
    paymentProviderOrderId: providerOrderId,
    paymentMethod: "paypal",
  });
  if (!order) return res.status(404).send("Order not found.");
  if (order.paymentStatus !== "paid") {
    const capture = await capturePayPalOrder(providerOrderId);
    const captured = getPayPalCapturedAmount(capture);
    if (
      capture.status !== "COMPLETED" ||
      captured.orderId !== String(order._id) ||
      captured.currency !== "INR" ||
      !captured.captureId ||
      captured.amount !== Number(order.total.toFixed(2))
    ) {
      return res.status(400).send("PayPal payment could not be verified against this order.");
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending", paymentStatus: "pending" },
      { paymentStatus: "paid", paymentId: captured.captureId, paymentCancelToken: "" },
      { new: true },
    );
    if (!updated) {
      const current = await Order.findById(order._id).select("paymentStatus paymentId");
      if (current?.paymentStatus !== "paid" || current.paymentId !== captured.captureId) {
        return res.status(409).send("This order is no longer awaiting payment.");
      }
    }
  }
  if (req.session.user && String(req.session.user.id) === String(order.user)) {
    await clearCustomerCart(req);
  }
  return res.redirect(`/orders/${order._id}?message=Payment%20successful`);
});

router.get("/payments/paypal/cancel", async (req, res) => {
  const orderId = String(req.query.order || "");
  if (!validId(orderId)) return res.redirect("/checkout?error=PayPal%20payment%20was%20cancelled");
  const state = String(req.query.state || "");
  const pendingOrder = await Order.findOne({
    _id: orderId,
    paymentMethod: "paypal",
    paymentStatus: "pending",
    status: "pending",
  });
  if (!pendingOrder?.paymentCancelToken || state.length !== pendingOrder.paymentCancelToken.length ||
      Buffer.byteLength(state) !== Buffer.byteLength(pendingOrder.paymentCancelToken) ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(pendingOrder.paymentCancelToken))) {
    return res.status(403).send("Invalid PayPal cancellation request.");
  }
  if (pendingOrder.paymentProviderOrderId) {
    const providerOrder = await getPayPalOrder(pendingOrder.paymentProviderOrderId);
    if (providerOrder.status === "COMPLETED") {
      return res.redirect(`/payments/paypal/capture?token=${encodeURIComponent(pendingOrder.paymentProviderOrderId)}`);
    }
  }
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentMethod: "paypal",
      paymentStatus: "pending",
      status: "pending",
    },
    {
      paymentStatus: "pending",
      cancellationReason: "PayPal payment cancelled",
      paymentCancelToken: "",
    },
    { new: true },
  );
  if (!order) return res.status(404).send("Order not found or already paid.");
  if (req.session.user && String(req.session.user.id) === String(order.user)) {
    restoreOrderToCart(req, order);
    await persistCustomerCart(req);
  }
  return res.redirect(`/orders/${order._id}?error=PayPal%20payment%20was%20cancelled`);
});

router.get("/checkout", ensureCustomer, async (req, res) => {
  const cartItems = await getCartItems(req);
  if (!cartItems.length) return res.redirect("/cart");
  const referral = await getReferralPricing(req, cartItems);
  const user = await User.findById(req.session.user.id).select("name phone addresses").lean();
  if (!user) return res.status(404).send("User account not found.");
  const subtotal = Number(referral.subtotal.toFixed(2));
  const checkoutAddress = user.addresses.find((address) => address.isDefault) || user.addresses[0];
  const shipping = getDeliveryCharge(checkoutAddress?.postalCode || "");
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + shipping + tax).toFixed(2));
  return res.render("checkout", {
    cartItems,
    user,
    order: { subtotal, shipping, tax, total },
    codAllowed: total <= 1000,
    error: req.query.error || "",
    offerDiscount: cartItems.reduce((sum, item) => sum + item.offerDiscount * item.quantity, 0),
    couponDiscount: cartItems.reduce((sum, item) => sum + item.couponDiscount * item.quantity, 0),
    referralDiscount: referral.referralDiscount,
    paymentOptions: {
      razorpay: isRazorpayConfigured(),
      paypal: isPayPalConfigured(),
    },
  });
});

router.post("/checkout", ensureCustomer, async (req, res) => {
  const paymentMethod = String(req.body.paymentMethod || "cash_on_delivery");
  if (!["cash_on_delivery", "razorpay", "paypal"].includes(paymentMethod)) {
    return res.status(400).redirect("/checkout?error=Select%20a%20valid%20payment%20method");
  }
  if (paymentMethod === "razorpay" && !isRazorpayConfigured()) {
    return res.status(400).redirect("/checkout?error=Razorpay%20is%20not%20configured");
  }
  if (paymentMethod === "paypal" && !isPayPalConfigured()) {
    return res.status(400).redirect("/checkout?error=PayPal%20is%20not%20configured");
  }
  const user = await User.findById(req.session.user.id);
  if (!user) return res.status(404).send("User account not found.");
  const cartItems = await getCartItems(req);
  if (!cartItems.length) return res.redirect("/cart");
  const referral = await getReferralPricing(req, cartItems);

  let address;
  if (req.body.addressId && req.body.addressId !== "new") {
    address = user.addresses.id(req.body.addressId);
  } else {
    address = normalizeAddress(req.body);
    if (!validateAddress(address)) {
      return res.status(400).redirect("/checkout?error=Enter%20valid%20delivery%20details");
    }
    if (req.body.saveAddress === "on") {
      if (user.addresses.length >= 20) return res.status(400).redirect("/checkout?error=Address%20limit%20reached");
      if (address.isDefault || user.addresses.length === 0) address.isDefault = true;
      const saved = user.addresses.create(address);
      if (address.isDefault || user.addresses.length === 0) ensureSingleDefaultAddress(user, saved._id);
      user.addresses.push(saved);
      await user.save();
      address = saved;
    }
  }
  if (!address) return res.status(400).redirect("/checkout?error=Select%20or%20enter%20a%20delivery%20address");

  const deliveryCharge = getDeliveryCharge(address.postalCode);
  const checkoutSubtotal = Number(referral.subtotal.toFixed(2));
  const checkoutTotal = Number((checkoutSubtotal + deliveryCharge + checkoutSubtotal * 0.08).toFixed(2));
  if (paymentMethod === "cash_on_delivery" && checkoutTotal > 1000) {
    return res.status(400).redirect(`/checkout?error=${encodeURIComponent("Cash on delivery is unavailable for orders above ₹1,000. Choose an online payment method.")}`);
  }

  const reserved = [];
  let order;
  try {
    for (const item of cartItems) {
      const maxQuantity = Math.min(getProductLimit(item), item.stock);
      if (item.quantity > maxQuantity) {
        throw new Error(`${item.name} is limited to ${maxQuantity} per order and currently available stock.`);
      }
      const product = await Product.findOneAndUpdate(
        { _id: item._id, isDeleted: false, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, soldCount: item.quantity } },
        { new: true },
      );
      if (!product) throw new Error(`${item.name} is out of stock or no longer available in the requested quantity.`);
      reserved.push({ product: product._id, quantity: item.quantity });
    }

    const grossSubtotal = Number(cartItems.reduce((sum, item) => sum + item.basePrice * item.quantity, 0).toFixed(2));
    const offerDiscount = Number(cartItems.reduce((sum, item) => sum + item.offerDiscount * item.quantity, 0).toFixed(2));
    const couponDiscount = Number(cartItems.reduce((sum, item) => sum + item.couponDiscount * item.quantity, 0).toFixed(2));
    const referralDiscount = Number(referral.referralDiscount.toFixed(2));
    const subtotal = Number(referral.subtotal.toFixed(2));
    const shipping = deliveryCharge;
    const tax = Number((subtotal * 0.08).toFixed(2));
    const total = Number((subtotal + shipping + tax).toFixed(2));
    order = await Order.create({
      orderNumber: `SHP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
      user: user._id,
      customerName: user.name,
      customerEmail: user.email,
      items: cartItems.map((item) => ({
        product: item._id,
        name: item.name,
        brand: item.brand || "",
        image: item.image,
        quantity: item.quantity,
        unitPrice: item.price,
        baseUnitPrice: item.basePrice,
        productOfferDiscount: item.offerDiscount,
        couponDiscount: item.couponDiscount,
        referralDiscount: item.referralDiscount || 0,
        couponCode: item.couponCode || "",
        couponDiscountPercent: item.couponDiscountPercent,
      })),
      shippingAddress: {
        label: address.label || "Delivery",
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 || "",
        city: address.city,
        region: address.region || "",
        postalCode: address.postalCode,
        country: address.country,
      },
      subtotal,
      grossSubtotal,
      offerDiscount,
      couponDiscount,
      referralDiscount,
      referralCode: referral.referralCode,
      shipping,
      tax,
      total,
      paymentMethod,
      paymentStatus: "pending",
      status: "pending",
    });

    if (paymentMethod === "cash_on_delivery") {
      await clearCustomerCart(req);
      return res.redirect(`/orders/${order._id}`);
    }
    await clearCustomerCart(req);
    return res.redirect(`/payments/${paymentMethod}/start/${order._id}`);
  } catch (error) {
    if (order) {
      await Order.updateOne(
        { _id: order._id, status: "pending", paymentStatus: "pending" },
        {
          status: "cancelled",
          paymentStatus: "failed",
          cancelledAt: new Date(),
          cancellationReason: "Unable to initialize payment",
          walletRefundStatus: "not_required",
        },
      );
    }
    await restoreReservedInventory(reserved);
    console.error(`${paymentMethod} checkout failed:`, error);
    const message = error.code === 11000 ? "Unable to place your order. Please try again." : error.message || "Unable to place your order.";
    return res.status(409).redirect(`/checkout?error=${encodeURIComponent(message)}`);
  }
});

async function restoreReservedInventory(reservations) {
  for (const reservation of reservations) {
    await Product.updateOne(
      { _id: reservation.product },
      { $inc: { stock: reservation.quantity, soldCount: -reservation.quantity } },
    );
  }
}

async function restoreOrderInventory(order) {
  await restoreReservedInventory(order.items.map((item) => ({ product: item.product, quantity: item.quantity })));
}

module.exports = router;
