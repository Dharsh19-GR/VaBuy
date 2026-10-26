const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const PDFDocument = require("pdfkit");
const User = require("../models/user");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Offer = require("../models/Offer");
const { creditOrderRefund } = require("../services/wallet");
const { parseDateRange, querySalesReport, createExcelReport, createPdfReport } = require("../services/sales-report");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads", "products");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { files: 10, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files are allowed.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

const ensureAdmin = (req, res, next) => {
  const user = req.session.user;
  if (!user || user.role !== "admin") {
    return res.redirect("/admin/login");
  }
  next();
};

const buildSlug = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const resolveCategoryId = async (categoryValue) => {
  if (!categoryValue) return null;
  if (mongoose.Types.ObjectId.isValid(categoryValue)) {
    const category = await Category.findOne({ _id: categoryValue, isDeleted: false }).select("_id");
    return category ? category._id : null;
  }

  const category = await Category.findOne({
    name: { $regex: new RegExp(`^${String(categoryValue).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    isDeleted: false,
  });

  return category ? category._id : null;
};

const saveImageFiles = async (files) => {
  if (!files || files.length < 3) {
    throw new Error("Upload at least 3 different images of the product.");
  }

  const saved = [];
  try {
    const normalizedImages = await Promise.all(files.map((file) =>
      sharp(file.buffer)
        .rotate()
        .resize(1000, 1000, { fit: "cover", position: "centre" })
        .png()
        .toBuffer(),
    ));
    const imageHashes = normalizedImages.map((image) => crypto.createHash("sha256").update(image).digest("hex"));
    if (new Set(imageHashes).size !== imageHashes.length) {
      throw new Error("Upload at least 3 different images of the product.");
    }

    for (const image of normalizedImages) {
      const fileName = `${crypto.randomUUID()}.jpg`;
      const outputPath = path.join(uploadDir, fileName);
      await sharp(image)
        .jpeg({ quality: 90 })
        .toFile(outputPath);
      saved.push(`/uploads/products/${fileName}`);
    }
  } catch (error) {
    await removeUploadedImages(saved);
    if (error.message.includes("different images")) throw error;
    throw new Error(`Unable to process product image: ${error.message}`);
  }

  if (saved.length < 3) {
    throw new Error("Upload at least 3 different images of the product.");
  }

  return saved;
};

const removeUploadedImages = async (imagePaths) => {
  await Promise.all(
    imagePaths
      .filter((imagePath) => imagePath.startsWith("/uploads/products/"))
      .map((imagePath) => fs.promises.unlink(path.join(uploadDir, path.basename(imagePath))).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      })),
  );
};

const makeUniqueSlug = async (name, currentProductId) => {
  const baseSlug = buildSlug(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await Product.exists({
      slug: candidate,
      ...(currentProductId ? { _id: { $ne: currentProductId } } : {}),
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

router.get("/login", (req, res) => res.render("admin/login", { error: "", email: "" }));
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).render("admin/login", {
      error: "Email and password are required.",
      email: normalizedEmail,
    });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.role !== "admin") {
      return res.status(401).render("admin/login", {
        error: "Invalid email or password.",
        email: normalizedEmail,
      });
    }

    if (user.isBlocked) {
      return res.status(403).render("admin/login", {
        error: "This admin account is blocked.",
        email: normalizedEmail,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).render("admin/login", {
        error: "Invalid email or password.",
        email: normalizedEmail,
      });
    }

    return req.session.regenerate((error) => {
      if (error) {
        console.error("Unable to start admin session:", error);
        return res.status(500).render("admin/login", {
          error: "Unable to start your session. Please try again.",
          email: normalizedEmail,
        });
      }
      req.session.user = {
        id: user._id,
        email: user.email,
        role: "admin",
        name: user.name,
      };
      req.session.welcomePopup = "admin";
      return req.session.save((saveError) => {
        if (saveError) {
          console.error("Unable to save admin session:", saveError);
          return res.status(500).render("admin/login", {
            error: "Unable to start your session. Please try again.",
            email: normalizedEmail,
          });
        }
        return res.redirect("/admin");
      });
    });
  } catch (error) {
    console.error("Admin login failed:", error);
    return res.status(500).render("admin/login", {
      error: "Unable to log in right now. Please try again.",
      email: normalizedEmail,
    });
  }
});

router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    return res.redirect("/admin/login");
  });
});

router.use(ensureAdmin);

const getOfferPayload = async (body) => {
  const type = String(body.type || "");
  const discountType = String(body.discountType || "");
  const value = Number(body.value);
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!["product", "category", "referral"].includes(type)) throw new Error("Select a valid offer type.");
  if (!["percentage", "fixed"].includes(discountType)) throw new Error("Select a valid discount type.");
  if (!Number.isFinite(value) || value <= 0 || (discountType === "percentage" && value > 100)) {
    throw new Error("Enter a valid discount value; percentages must be 1–100.");
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new Error("Choose a valid start and end date; the end must be after the start.");
  }
  const payload = {
    name: String(body.name || "").trim().slice(0, 100),
    type,
    discountType,
    value,
    startsAt,
    endsAt,
    isActive: body.isActive === "on",
  };
  if (!payload.name) throw new Error("Enter an offer name.");
  if (type === "product") {
    if (!mongoose.Types.ObjectId.isValid(body.product)) throw new Error("Select a valid product.");
    if (!await Product.exists({ _id: body.product, isDeleted: false })) throw new Error("Select an available product.");
    payload.product = body.product;
  } else if (type === "category") {
    if (!mongoose.Types.ObjectId.isValid(body.category)) throw new Error("Select a valid category.");
    if (!await Category.exists({ _id: body.category, isDeleted: false })) throw new Error("Select an available category.");
    payload.category = body.category;
  } else {
    payload.code = String(body.code || "").trim().toUpperCase().slice(0, 30);
    if (!/^[A-Z0-9_-]{3,30}$/.test(payload.code)) {
      throw new Error("Referral codes must be 3–30 letters, numbers, underscores or hyphens.");
    }
  }
  return payload;
};

router.get("/", async (req, res) => {
  const [productsCount, usersCount, categoriesCount] = await Promise.all([
    Product.countDocuments({ isDeleted: false }),
    User.countDocuments({ role: "user" }),
    Category.countDocuments({ isDeleted: false }),
  ]);

  const period = ["day", "week", "month", "year"].includes(req.query.period) ? req.query.period : "month";
  const range = parseDateRange({ period });
  const orders = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, paymentStatus: "paid" })
    .populate("items.product", "brand category")
    .populate("items.product.category", "name")
    .select("createdAt total status items").lean();
  const salesByDay = new Map();
  const rankings = { products: new Map(), categories: new Map(), brands: new Map() };
  let revenue = 0;
  for (const order of orders) {
    const excluded = ["cancelled", "returned"].includes(order.status);
    const amount = excluded ? 0 : Number(order.total || 0);
    revenue += amount;
    const day = new Date(order.createdAt).toISOString().slice(0, 10);
    salesByDay.set(day, (salesByDay.get(day) || 0) + amount);
    if (excluded) continue;
    for (const item of order.items || []) {
      const product = item.product || {};
      const units = Number(item.quantity || 0);
      const add = (map, name) => { if (name) map.set(name, (map.get(name) || 0) + units); };
      add(rankings.products, item.name);
      add(rankings.categories, product.category?.name);
      add(rankings.brands, product.brand || item.brand);
    }
  }
  const top = (map) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, units]) => ({ name, units }));
  res.render("admin/dashboard", {
    period,
    revenue: Number(revenue.toFixed(2)),
    chart: [...salesByDay].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value: Number(value.toFixed(2)) })),
    topProducts: top(rankings.products), topCategories: top(rankings.categories), topBrands: top(rankings.brands),
    metrics: [
      { label: "Customers", value: String(usersCount) },
      { label: "Products", value: String(productsCount) },
      { label: "Categories", value: String(categoriesCount) },
    ],
  });
});

router.get("/bestsellers/:type", async (req, res) => {
  const type = String(req.params.type || "");
  const configs = {
    products: { title: "Best selling products", key: (item) => String(item.product?._id || item.name), label: (item) => item.name },
    categories: { title: "Best selling categories", key: (_item, product) => String(product.category?._id || ""), label: (_item, product) => product.category?.name || "" },
    brands: { title: "Best selling brands", key: (item, product) => String(product.brand || item.brand || "").trim().toLowerCase(), label: (item, product) => String(product.brand || item.brand || "").trim() },
  };
  const config = configs[type];
  if (!config) return res.status(404).send("Sales ranking not found.");
  const period = ["day", "week", "month", "year"].includes(req.query.period) ? req.query.period : "month";
  const range = parseDateRange({ period });
  const orders = await Order.find({ createdAt: { $gte: range.from, $lte: range.to }, paymentStatus: "paid", status: { $nin: ["cancelled", "returned"] } })
    .populate("items.product", "name brand category")
    .populate("items.product.category", "name")
    .select("items").lean();
  const rowsByKey = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const product = item.product || {};
      const key = config.key(item, product);
      const name = config.label(item, product);
      if (!key || !name) continue;
      const row = rowsByKey.get(key) || { name, units: 0, revenue: 0, orderIds: new Set() };
      const quantity = Number(item.quantity || 0);
      row.units += quantity;
      row.revenue += Math.max(0, Number(item.unitPrice || 0) * quantity - Number(item.referralDiscount || 0));
      row.orderIds.add(String(order._id));
      rowsByKey.set(key, row);
    }
  }
  const rows = [...rowsByKey.values()].map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size, revenue: Number(row.revenue.toFixed(2)) }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  return res.render("admin/bestsellers", { title: config.title, type, period, rows });
});

router.get("/offers", async (req, res) => {
  const offers = await Offer.find({})
    .populate("product", "name")
    .populate("category", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.render("admin/offers", { offers, message: req.query.message || "", error: req.query.error || "" });
});

router.get("/offers/new", async (req, res) => {
  const [products, categories] = await Promise.all([
    Product.find({ isDeleted: false }).sort({ name: 1 }).select("name").lean(),
    Category.find({ isDeleted: false }).sort({ name: 1 }).select("name").lean(),
  ]);
  const type = ["product", "category", "referral"].includes(req.query.type) ? req.query.type : "product";
  res.render("admin/offer-form", { offer: { type, discountType: "percentage", value: 10, isActive: true }, products, categories, isEdit: false, error: "" });
});

router.get("/offers/:id/edit", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Offer not found.");
  const [offer, products, categories] = await Promise.all([
    Offer.findById(req.params.id).lean(),
    Product.find({ isDeleted: false }).sort({ name: 1 }).select("name").lean(),
    Category.find({ isDeleted: false }).sort({ name: 1 }).select("name").lean(),
  ]);
  if (!offer) return res.status(404).send("Offer not found.");
  res.render("admin/offer-form", { offer, products, categories, isEdit: true, error: "" });
});

router.post("/offers", async (req, res) => {
  try {
    const payload = await getOfferPayload(req.body);
    if (req.body.offerId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.offerId)) return res.status(404).send("Offer not found.");
      const offer = await Offer.findByIdAndUpdate(req.body.offerId, payload, { new: true, runValidators: true });
      if (!offer) return res.status(404).send("Offer not found.");
    } else {
      await Offer.create(payload);
    }
    return res.redirect("/admin/offers?message=Offer%20saved");
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).redirect(`/admin/offers?error=${encodeURIComponent("That referral code is already in use.")}`);
    }
    return res.status(400).redirect(`/admin/offers?error=${encodeURIComponent(error.message)}`);
  }
});

router.post("/offers/:id/toggle", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Offer not found.");
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).send("Offer not found.");
  offer.isActive = !offer.isActive;
  await offer.save();
  return res.redirect("/admin/offers");
});

router.post("/offers/:id/delete", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Offer not found.");
  const offer = await Offer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!offer) return res.status(404).send("Offer not found.");
  return res.redirect("/admin/offers?message=Offer%20disabled");
});

router.get("/reports/sales", async (req, res) => {
  let range;
  try {
    range = parseDateRange(req.query);
  } catch (error) {
    return res.status(400).render("admin/sales-report", {
      report: null,
      filters: { period: req.query.period || "week", groupBy: req.query.groupBy || "daily", start: req.query.start || "", end: req.query.end || "" },
      error: error.message,
    });
  }
  const groupBy = ["daily", "weekly", "yearly"].includes(req.query.groupBy) ? req.query.groupBy : "daily";
  const report = await querySalesReport(range, groupBy);
  res.render("admin/sales-report", {
    report,
    filters: { period: range.period, groupBy, start: req.query.start || "", end: req.query.end || "" },
    error: "",
  });
});

router.get("/reports/ledger.pdf", async (req, res) => {
  let range;
  try { range = parseDateRange(req.query); }
  catch (error) { return res.status(400).send(error.message); }
  const orders = await Order.find({ createdAt: { $gte: range.from, $lte: range.to } }).sort({ createdAt: 1 }).lean();
  res.type("application/pdf").attachment(`vabuy-ledger-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.pdf`);
  const doc = new PDFDocument({ margin: 42, size: "A4", layout: "landscape" });
  doc.pipe(res);
  doc.fontSize(20).text("VaBuy Ledger Book").moveDown(0.4).fontSize(10)
    .text(`${range.from.toLocaleDateString("en-IN")} to ${range.to.toLocaleDateString("en-IN")}`).moveDown();
  const x = [42, 132, 280, 415, 520, 635];
  const headers = ["Date", "Order / customer", "Description", "Debit (INR)", "Credit (INR)", "Balance (INR)"];
  const writeRow = (values, bold = false) => {
    if (doc.y > 520) doc.addPage();
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    values.forEach((value, index) => doc.text(String(value), x[index], y, { width: index === 2 ? 125 : 100, ellipsis: true, lineBreak: false }));
    doc.moveDown(1.5);
  };
  writeRow(headers, true);
  let balance = 0;
  for (const order of orders) {
    if (order.paymentStatus !== "paid") continue;
    const returned = ["cancelled", "returned"].includes(order.status);
    const amount = Number(order.total || 0);
    if (!returned) balance += amount;
    writeRow([new Date(order.createdAt).toLocaleDateString("en-IN"), `${order.orderNumber} / ${order.customerName}`, `Order payment (${order.paymentMethod})`, "0.00", returned ? "0.00" : amount.toFixed(2), balance.toFixed(2)]);
    if (returned) {
      balance -= amount;
      writeRow([new Date(order.updatedAt || order.createdAt).toLocaleDateString("en-IN"), order.orderNumber, "Refund / cancellation", amount.toFixed(2), "0.00", balance.toFixed(2)]);
    }
  }
  doc.end();
});

router.get("/reports/sales/export/:format", async (req, res) => {
  const format = String(req.params.format || "").toLowerCase();
  if (!["xlsx", "pdf"].includes(format)) return res.status(400).send("Choose an Excel or PDF export.");
  try {
    const range = parseDateRange(req.query);
    const groupBy = ["daily", "weekly", "yearly"].includes(req.query.groupBy) ? req.query.groupBy : "daily";
    const report = await querySalesReport(range, groupBy);
    const start = range.from.toISOString().slice(0, 10);
    const end = range.to.toISOString().slice(0, 10);
    if (format === "xlsx") {
      const buffer = await createExcelReport(report);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.attachment(`vabuy-sales-${start}-to-${end}.xlsx`);
      return res.send(buffer);
    }
    const buffer = await createPdfReport(report);
    res.type("application/pdf");
    res.attachment(`vabuy-sales-${start}-to-${end}.pdf`);
    return res.send(buffer);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

router.get("/products", async (req, res) => {
  const products = await Product.find({ isDeleted: false }).populate("category", "name").sort({ createdAt: -1 });
  res.render("admin/products", { products });
});

router.get("/products/new", async (req, res) => {
  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 });
  res.render("admin/product-form", { product: {}, categories, isEdit: false });
});

router.get("/products/:id/edit", async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).populate("category");
  if (!product) return res.status(404).send("Product not found.");
  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 });
  res.render("admin/product-form", { product, categories, isEdit: true });
});

router.post("/products", upload.array("images", 10), async (req, res) => {
  let newlySavedImages = [];
  try {
    const {
      name,
      brand,
      category,
      price,
      compareAtPrice,
      couponCode,
      couponDiscountPercent,
      stock,
      maxPerOrder,
      isFeatured,
      description,
      highlights,
      specifications,
      productId,
    } = req.body;
    const resolvedCategoryId = await resolveCategoryId(category);
    const specificationRows = String(specifications || "")
      .split(/\r?\n/)
      .map((line) => {
        const [specName, ...valueParts] = line.split(":");
        return { name: specName.trim(), value: valueParts.join(":").trim() };
      })
      .filter((specification) => specification.name && specification.value);
    const payload = {
      name: String(name || "").trim(),
      brand: String(brand || "").trim().slice(0, 80),
      description: String(description || "").trim(),
      price: Number(price),
      compareAtPrice: compareAtPrice === "" || compareAtPrice === undefined ? null : Number(compareAtPrice),
      couponCode: String(couponCode || "").trim().toUpperCase(),
      couponDiscountPercent: Number(couponDiscountPercent || 0),
      stock: Number(stock),
      maxPerOrder: Number(maxPerOrder || 5),
      isFeatured: isFeatured === "on",
      category: resolvedCategoryId,
      highlights: String(highlights || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12),
      specifications: specificationRows.slice(0, 20),
    };

    if (
      !payload.name ||
      !payload.category ||
      !Number.isFinite(payload.price) ||
      payload.price < 0 ||
      (payload.compareAtPrice !== null && (!Number.isFinite(payload.compareAtPrice) || payload.compareAtPrice < 0)) ||
      !Number.isFinite(payload.couponDiscountPercent) ||
      payload.couponDiscountPercent < 0 ||
      payload.couponDiscountPercent > 100 ||
      !Number.isSafeInteger(payload.stock) ||
      payload.stock < 0 ||
      !Number.isSafeInteger(payload.maxPerOrder) ||
      payload.maxPerOrder < 1 ||
      payload.maxPerOrder > 99
    ) {
      return res.status(400).send("Please provide valid product details.");
    }

    if (!productId) {
      const files = req.files || [];
      const images = await saveImageFiles(files);
      newlySavedImages = images;
      const product = new Product({
        ...payload,
        slug: await makeUniqueSlug(payload.name),
        images,
        rating: 0,
      });
      await product.save();
      newlySavedImages = [];
      return res.redirect("/admin/products");
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(404).send("Product not found.");
    }
    const existingProduct = await Product.findOne({ _id: productId, isDeleted: false });
    if (!existingProduct) return res.status(404).send("Product not found.");

    const oldImages = [...existingProduct.images];
    const images = req.files && req.files.length ? await saveImageFiles(req.files) : existingProduct.images;
    newlySavedImages = req.files && req.files.length ? images : [];
    if (!images || images.length < 3) {
      return res.status(400).send("A product must have at least 3 images.");
    }

    existingProduct.set({
      ...payload,
      slug: await makeUniqueSlug(payload.name, existingProduct._id),
      images,
    });
    await existingProduct.save();
    if (newlySavedImages.length) {
      await removeUploadedImages(oldImages);
      newlySavedImages = [];
    }
    return res.redirect("/admin/products");
  } catch (error) {
    await removeUploadedImages(newlySavedImages);
    console.error("Product save failed:", error);
    if (error.code === 11000) return res.status(409).send("A product with that slug already exists.");
    if (error.name === "ValidationError" || error.message.includes("image")) {
      return res.status(400).send(error.message || "Unable to save product.");
    }
    return res.status(500).send("Unable to save product.");
  }
});

router.post("/products/:id/delete", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Product not found.");
  await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
  return res.redirect("/admin/products");
});

router.get("/categories", async (req, res) => {
  const categories = await Category.find({ isDeleted: false }).sort({ name: 1 });
  res.render("admin/categories", { categories });
});

router.get("/categories/new", (req, res) => res.render("admin/category-form", { category: {}, isEdit: false }));

router.get("/categories/:id/edit", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Category not found.");
  const category = await Category.findOne({ _id: req.params.id, isDeleted: false });
  if (!category) return res.status(404).send("Category not found.");
  res.render("admin/category-form", { category, isEdit: true });
});

router.post("/categories", async (req, res) => {
  const { name, categoryId } = req.body;
  const cleanedName = String(name || "").trim();
  if (!cleanedName) return res.status(400).send("Category name is required.");

  const payload = {
    name: cleanedName,
    slug: buildSlug(cleanedName),
  };

  if (categoryId) {
    if (!mongoose.Types.ObjectId.isValid(categoryId)) return res.status(404).send("Category not found.");
    const category = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!category) return res.status(404).send("Category not found.");
    const duplicate = await Category.findOne({
      slug: payload.slug,
      isDeleted: false,
      _id: { $ne: category._id },
    });
    if (duplicate) return res.status(409).send("Category already exists.");
    category.set(payload);
    try {
      await category.save();
    } catch (error) {
      if (error.code === 11000) return res.status(409).send("Category already exists.");
      throw error;
    }
    return res.redirect("/admin/categories");
  }

  const existing = await Category.findOne({ slug: payload.slug, isDeleted: false });
  if (existing) return res.status(409).send("Category already exists.");

  const deletedCategory = await Category.findOne({ slug: payload.slug, isDeleted: true });
  if (deletedCategory) {
    deletedCategory.set({ ...payload, isDeleted: false });
    try {
      await deletedCategory.save();
    } catch (error) {
      if (error.code === 11000) return res.status(409).send("Category already exists.");
      throw error;
    }
    return res.redirect("/admin/categories");
  }

  try {
    await Category.create(payload);
  } catch (error) {
    if (error.code === 11000) return res.status(409).send("Category already exists.");
    throw error;
  }
  return res.redirect("/admin/categories");
});

router.post("/categories/:id/delete", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Category not found.");
  await Category.findByIdAndUpdate(req.params.id, { isDeleted: true });
  return res.redirect("/admin/categories");
});

router.get("/users", async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 });
  res.render("admin/users", { users });
});

router.post("/users/:id/toggle-status", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("User not found.");
  const user = await User.findById(req.params.id);
  if (!user || user.role === "admin") {
    return res.status(400).send("Invalid user selection.");
  }
  user.isBlocked = !user.isBlocked;
  await user.save();
  return res.redirect("/admin/users");
});

router.get("/orders", async (req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
  res.render("admin/orders", { orders });
});

router.get("/orders/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).send("Order not found.");
  res.render("admin/order-details", { order });
});

router.post("/orders/:id/status", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Order not found.");
  const allowedStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"];
  const status = String(req.body.status || "");
  if (!allowedStatuses.includes(status)) return res.status(400).send("Select a valid order status.");

  if (status === "cancelled") {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ["pending", "confirmed", "cancellation_requested"] } },
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "Cancelled by admin",
        cancellationPreviousStatus: "",
        walletRefundStatus: "pending",
      },
      { new: true },
    );
    if (!order) return res.status(409).send("Only pending, confirmed, or cancellation-requested orders can be cancelled.");
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } },
      );
    }
    await creditOrderRefund(order, order.cancellationReason);
    return res.redirect(`/admin/orders/${order._id}`);
  }

  if (status === "returned") {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "return_requested" },
      {
        status: "returned",
        returnedAt: new Date(),
        walletRefundStatus: "pending",
      },
      { new: true },
    );
    if (!order) return res.status(409).send("Only requested returns can be approved.");
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity, soldCount: -item.quantity } },
      );
    }
    await creditOrderRefund(order, "Approved return refund");
    return res.redirect(`/admin/orders/${order._id}`);
  }

  const currentOrder = await Order.findById(req.params.id).select("status paymentMethod paymentStatus").lean();
  if (!currentOrder) return res.status(404).send("Order not found.");
  const nextStatus = { pending: "confirmed", confirmed: "shipped", shipped: "delivered" }[currentOrder.status];
  if (status !== nextStatus) return res.status(409).send("Orders must move from placed to confirmed, shipped, then delivered.");
  if (currentOrder.paymentMethod !== "cash_on_delivery" && currentOrder.paymentStatus !== "paid") {
    return res.status(409).send("Online payment must be completed before confirming the order.");
  }
  const update = { status };
  if (status === "delivered") {
    update.deliveredAt = new Date();
    if (currentOrder.paymentMethod === "cash_on_delivery") update.paymentStatus = "paid";
  }
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: currentOrder.status, ...(currentOrder.paymentMethod !== "cash_on_delivery" ? { paymentStatus: "paid" } : {}) },
    update,
    { new: true, runValidators: true },
  );
  if (!order) return res.status(409).send("Order cannot be moved from its current status.");
  return res.redirect(`/admin/orders/${order._id}`);
});

router.post("/orders/:id/cancellation/reject", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Order not found.");
  const request = await Order.findOne({ _id: req.params.id, status: "cancellation_requested" }).select("cancellationPreviousStatus").lean();
  if (!request) return res.status(409).send("This order has no cancellation request awaiting review.");
  const previousStatus = ["pending", "confirmed"].includes(request.cancellationPreviousStatus) ? request.cancellationPreviousStatus : "pending";
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: "cancellation_requested" },
    { status: previousStatus, cancellationPreviousStatus: "", cancellationReason: "" },
    { new: true, runValidators: true },
  );
  if (!order) return res.status(409).send("This cancellation request has already been resolved.");
  return res.redirect(`/admin/orders/${order._id}`);
});

router.post("/orders/:id/return/reject", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Order not found.");
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, status: "return_requested" },
    { status: "delivered", returnRequestedAt: null, returnReason: "" },
    { new: true, runValidators: true },
  );
  if (!order) return res.status(409).send("This order has no return request awaiting review.");
  return res.redirect(`/admin/orders/${order._id}`);
});

router.get("/inventory", async (req, res) => {
  const products = await Product.find({ isDeleted: false }).sort({ stock: 1, name: 1 }).lean();
  res.render("admin/inventory", { products });
});

router.post("/inventory/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).send("Product not found.");
  const stock = Number(req.body.stock);
  if (!Number.isSafeInteger(stock) || stock < 0) return res.status(400).send("Stock must be a non-negative whole number.");
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { stock },
    { new: true, runValidators: true },
  );
  if (!product) return res.status(404).send("Product not found.");
  return res.redirect("/admin/inventory");
});

router.get("/settings", (req, res) => res.render("admin/settings"));
router.post("/settings", (req, res) => res.redirect("/admin/settings"));

module.exports = router;
