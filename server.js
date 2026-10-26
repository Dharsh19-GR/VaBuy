require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const connectDB = require("./config/db");
const User = require("./models/user");
const {
  catalogCategories,
  catalogProducts,
} = require("./data/store-catalog");

const app = express();
const port = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, "uploads", "products");
fs.mkdirSync(uploadsDir, { recursive: true });

const escapeHtml = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

const renderSiteHeader = (user, cartCount, isAdminPage) => {
  const displayName = escapeHtml(user?.name);
  const adminLinks =
    user?.role === "admin"
      ? [
          ["/admin", "Dashboard"],
          ["/admin/products", "Products"],
          ["/admin/categories", "Categories"],
          ["/admin/users", "Users"],
          ["/admin/orders", "Orders"],
          ["/admin/inventory", "Inventory"],
          ["/admin/offers", "Offers"],
          ["/admin/reports/sales", "Sales reports"],
          ["/", "View store"],
        ]
      : [["/", "View store"]];

  const navigation = isAdminPage
    ? adminLinks
        .map(([href, label]) => `<a href="${href}">${label}</a>`)
        .join("")
    : ['<a href="/">Shop</a>', '<a href="/#products">Discover</a>'].join("");
  const actions = isAdminPage
    ? user?.role === "admin"
      ? '<form class="site-logout" action="/admin/logout" method="post"><button type="submit">Sign out</button></form>'
      : '<a class="site-primary-link" href="/admin/login">Admin sign in</a>'
    : user
      ? `${user.role === "admin" ? '<a href="/admin">Admin</a>' : `<a class="profile-nav-link" href="/profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg><span>${displayName ? `Hi, ${displayName}` : "My Profile"}</span></a><a class="icon-nav-link wallet-nav-link" href="/wallet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h16M16 13h4"/><circle cx="16" cy="13" r=".5"/></svg><span>My Wallet</span></a>`}<form class="site-logout" action="/logout" method="post"><button type="submit">Sign out</button></form>`
      : '<a class="site-primary-link" href="/login">Sign in</a><a href="/register">Create account</a>';

  return `<header class="site-header"><div class="site-header-inner"><a class="site-brand" href="/" aria-label="VaBuy home"><span class="site-brand-mark" aria-hidden="true">V</span><span>VaBuy</span><svg class="site-brand-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg></a><nav class="site-nav" aria-label="${isAdminPage ? "Admin" : "Main"} navigation">${navigation}</nav><div class="site-actions"><a class="icon-nav-link cart-nav-link" href="/cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/></svg><span>My Cart${!isAdminPage ? ` (${cartCount})` : ""}</span></a>${isAdminPage ? "" : '<a class="icon-nav-link wishlist-nav-link" href="/wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg><span>Wishlist</span></a>'}${actions}</div></div></header>`;
};

const ensureAdminUser = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@shoply.local")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: "VaBuy Admin",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      isBlocked: false,
    });
    console.log(`Admin account created for ${adminEmail}`);
  } else {
    existingAdmin.role = "admin";
    await existingAdmin.save();
    console.log(`Admin account available for ${adminEmail}`);
  }
};

const seedCatalog = async () => {
  const categoryDefs = [
    "Bags",
    "Audio",
    "Footwear",
    "Home",
    "Accessories",
    "Beauty",
  ];
  const existingCategories = await Category.find({}).lean();
  if (!existingCategories.length) {
    const createdCategories = await Promise.all(
      categoryDefs.map((name) =>
        Category.create({
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
          isDeleted: false,
        }),
      ),
    );

    const categoryMap = Object.fromEntries(
      createdCategories.map((category) => [category.name, category._id]),
    );

    const sampleProducts = [
      {
        name: "Minimal Leather Backpack",
        slug: "minimal-leather-backpack",
        description:
          "A durable everyday backpack with padded storage for your essentials and laptop.",
        category: categoryMap.Bags,
        price: 79.99,
        stock: 14,
        rating: 4.8,
        images: [
          "/images/products/backpack-photo-1.jpg",
          "/images/products/backpack-photo-2.jpg",
          "/images/products/backpack-photo-3.jpg",
        ],
        imageNote: "Reference product photos; exact brand and model may vary.",
        isDeleted: false,
      },
      {
        name: "Wireless Headphones",
        slug: "wireless-headphones",
        description:
          "Comfortable wireless headphones for listening at home or on the go.",
        category: categoryMap.Audio,
        price: 129,
        stock: 18,
        rating: 4.6,
        images: [
          "/images/products/headphones-photo-1.jpg",
          "/images/products/headphones-photo-2.jpg",
          "/images/products/headphones-photo-3.jpg",
        ],
        imageNote: "Reference product photos; exact brand and model may vary.",
        isDeleted: false,
      },
      {
        name: "Everyday Sneakers",
        slug: "everyday-sneakers",
        description:
          "Versatile everyday sneakers designed for lasting comfort.",
        category: categoryMap.Footwear,
        price: 1999.99,
        stock: 12,
        rating: 4.7,
        images: [
          "/images/products/sneakers-photo-1.jpg",
          "/images/products/sneakers-photo-2.jpg",
          "/images/products/sneakers-photo-3.jpg",
        ],
        imageNote: "Reference product photos; exact brand and model may vary.",
        isDeleted: false,
      },
      {
        name: "Ceramic Desk Lamp",
        slug: "ceramic-desk-lamp",
        description:
          "A simple ceramic desk lamp that brings warm light to your workspace.",
        category: categoryMap.Home,
        price: 422,
        stock: 9,
        rating: 4.5,
        images: [
          "/images/products/bedside-lamp-photo-1.jpg",
          "/images/products/bedside-lamp-photo-2.jpg",
          "/images/products/bedside-lamp-photo-3.jpg",
        ],
        imageNote: "Reference lamp photos; exact product model may vary.",
        isDeleted: false,
      },
    ];

    await Product.insertMany(sampleProducts);
    console.log("Seed catalog data created");
  }

  // Keep the sample accessories available for existing databases too.
  const accessories = await Category.findOneAndUpdate(
    { slug: "accessories" },
    {
      $setOnInsert: {
        name: "Accessories",
        slug: "accessories",
        isDeleted: false,
      },
    },
    { upsert: true, new: true },
  );
  const accessoryProducts = [
    {
      name: "Everyday Leather Card Holder",
      slug: "everyday-leather-card-holder",
      description:
        "A slim card holder that keeps your daily essentials close without adding bulk.",
      price: 259.99,
      compareAtPrice: 32,
      stock: 24,
      rating: 4.8,
      images: [
        "/images/accessories/card-holder.jpg",
        "/images/accessories/card-holder-photo-2.jpg",
        "/images/accessories/card-holder-photo-3.jpg",
      ],
      highlights: [
        "Compact six-card layout",
        "Soft pebbled finish",
        "Fits easily in a pocket",
      ],
      specifications: [
        { name: "Material", value: "Vegan leather" },
        { name: "Capacity", value: "Up to 6 cards" },
      ],
    },
    {
      name: "Classic Everyday Sunglasses",
      slug: "classic-everyday-sunglasses",
      description:
        "Lightweight everyday sunglasses with a timeless rounded frame and UV400 lenses.",
      price: 39.5,
      compareAtPrice: 49,
      stock: 16,
      rating: 4.7,
      images: [
        "/images/accessories/sunglasses.jpg",
        "/images/accessories/sunglasses-photo-2.jpg",
        "/images/accessories/sunglasses-photo-3.jpg",
      ],
      highlights: [
        "UV400 lens protection",
        "Lightweight frame",
        "Includes a soft storage pouch",
      ],
      specifications: [
        { name: "Frame", value: "Recycled acetate" },
        { name: "Lens", value: "UV400, category 3" },
      ],
    },
    {
      name: "Minimalist Everyday Watch",
      slug: "minimalist-everyday-watch",
      description:
        "A clean, easy-to-read watch with a brushed steel case and a comfortable strap.",
      price: 5899.99,
      compareAtPrice: 72,
      stock: 11,
      rating: 4.6,
      images: [
        "/images/accessories/everyday-watch.jpg",
        "/images/accessories/watch-photo-2.jpg",
        "/images/accessories/watch-photo-3.jpg",
      ],
      highlights: [
        "Japanese quartz movement",
        "Water resistant to 3 ATM",
        "Adjustable strap",
      ],
      specifications: [
        { name: "Case", value: "38 mm stainless steel" },
        { name: "Movement", value: "Quartz" },
      ],
    },
  ].map((product) => ({
    ...product,
    category: accessories._id,
    isDeleted: false,
  }));
  for (const product of accessoryProducts) {
    await Product.updateOne(
      { slug: product.slug },
      { $setOnInsert: product },
      { upsert: true },
    );
  }
  for (const [slug, image] of [
    ["everyday-leather-card-holder", "/images/accessories/card-holder.jpg"],
    ["classic-everyday-sunglasses", "/images/accessories/sunglasses.jpg"],
    ["minimalist-everyday-watch", "/images/accessories/everyday-watch.jpg"],
  ]) {
    await Product.updateOne(
      { slug, images: { $regex: "\\.svg$" } },
      { $set: { images: [image] } },
    );
  }

  // Keep the beauty category and sample products available for existing databases too.
  const beauty = await Category.findOneAndUpdate(
    { slug: "beauty" },
    {
      $setOnInsert: {
        name: "Beauty",
        slug: "beauty",
        isDeleted: false,
      },
    },
    { upsert: true, new: true },
  );

  const beautyProducts = [
    {
      name: "Vitamin C Glow Serum",
      slug: "vitamin-c-glow-serum",
      brand: "Glow Theory",
      description:
        "A lightweight brightening serum with vitamin C, niacinamide, and hyaluronic acid. It helps even out skin tone, boost hydration, and leave your complexion looking fresh and radiant.",
      price: 899,
      compareAtPrice: 1199,
      couponCode: "GLOW10",
      couponDiscountPercent: 10,
      stock: 32,
      rating: 4.8,
      images: [
        "/images/beauty/vitamin-c-serum-1.jpg",
        "/images/beauty/vitamin-c-serum-2.jpg",
        "/images/beauty/vitamin-c-serum-3.jpg",
      ],
      imageNote:
        "Reference beauty product photos; exact brand and packaging may vary.",
      highlights: [
        "10% vitamin C complex",
        "Hyaluronic acid and niacinamide",
        "Fragrance-free daily formula",
      ],
      specifications: [
        { name: "Size", value: "30 ml" },
        { name: "Skin type", value: "All skin types" },
        {
          name: "Key ingredients",
          value: "Vitamin C, niacinamide, hyaluronic acid",
        },
      ],
      reviews: [
        {
          name: "Ananya S.",
          rating: 5,
          title: "Glow in a bottle",
          text: "Sinks in quickly and my skin looks brighter after a few weeks.",
        },
      ],
    },
    {
      name: "Hydrating Daily Moisturizer",
      slug: "hydrating-daily-moisturizer",
      brand: "Pure Ritual",
      description:
        "A silky daily moisturizer with ceramides and squalane that cushions dry skin and locks in moisture without leaving a greasy finish.",
      price: 649,
      compareAtPrice: 849,
      stock: 40,
      rating: 4.7,
      images: [
        "/images/beauty/hydrating-moisturizer-1.jpg",
        "/images/beauty/hydrating-moisturizer-2.jpg",
        "/images/beauty/hydrating-moisturizer-3.jpg",
      ],
      imageNote:
        "Reference beauty product photos; exact brand and packaging may vary.",
      highlights: [
        "72-hour hydration",
        "Lightweight, non-greasy finish",
        "Fragrance-free and dermatologist tested",
      ],
      specifications: [
        { name: "Size", value: "50 ml" },
        { name: "Skin type", value: "Normal to dry" },
        {
          name: "Key ingredients",
          value: "Ceramides, squalane, glycerin",
        },
      ],
      reviews: [
        {
          name: "Priya M.",
          rating: 5,
          title: "Perfect everyday cream",
          text: "Rich enough for dry patches but it absorbs without feeling heavy.",
        },
      ],
    },
    {
      name: "Velvet Matte Lipstick — Rosewood",
      slug: "velvet-matte-lipstick-rosewood",
      brand: "Velvet & Co.",
      description:
        "A creamy, full-coverage lipstick in a wearable rosewood shade. The soft matte finish feels comfortable and keeps its colour through the day.",
      price: 499,
      compareAtPrice: 699,
      stock: 26,
      rating: 4.6,
      images: [
        "/images/beauty/velvet-matte-lipstick-1.jpg",
        "/images/beauty/velvet-matte-lipstick-2.jpg",
        "/images/beauty/velvet-matte-lipstick-3.jpg",
      ],
      imageNote:
        "Reference beauty product photos; exact brand and packaging may vary.",
      highlights: [
        "Rich, one-swipe colour",
        "Comfortable velvet matte finish",
        "Enriched with shea butter and vitamin E",
      ],
      specifications: [
        { name: "Shade", value: "Rosewood" },
        { name: "Finish", value: "Velvet matte" },
        { name: "Weight", value: "3.5 g" },
      ],
      reviews: [
        {
          name: "Nisha K.",
          rating: 5,
          title: "Beautiful everyday shade",
          text: "Comfortable on the lips and the colour lasts through lunch.",
        },
      ],
    },
    {
      name: "Botanical Eau de Parfum",
      slug: "botanical-eau-de-parfum",
      brand: "Botanica",
      description:
        "A fresh woody-floral fragrance with bergamot, jasmine, and cedarwood. Light enough for everyday wear, with a warm finish that lingers.",
      price: 1499,
      compareAtPrice: 1899,
      stock: 18,
      rating: 4.9,
      images: [
        "/images/beauty/botanical-eau-de-parfum-1.jpg",
        "/images/beauty/botanical-eau-de-parfum-2.jpg",
        "/images/beauty/botanical-eau-de-parfum-3.jpg",
      ],
      imageNote:
        "Reference beauty product photos; exact brand and packaging may vary.",
      highlights: [
        "Bergamot, jasmine, and cedarwood",
        "Long-lasting eau de parfum",
        "Recyclable glass bottle",
      ],
      specifications: [
        { name: "Size", value: "50 ml" },
        { name: "Fragrance family", value: "Woody floral" },
        { name: "Notes", value: "Bergamot, jasmine, cedarwood" },
      ],
      reviews: [
        {
          name: "Riya D.",
          rating: 5,
          title: "My new signature scent",
          text: "Fresh at first and softly woody later. I get compliments every time.",
        },
      ],
    },
  ].map((product) => ({
    ...product,
    category: beauty._id,
    isDeleted: false,
  }));

  for (const product of beautyProducts) {
    await Product.updateOne(
      { slug: product.slug },
      { $setOnInsert: product },
      { upsert: true },
    );
  }

  // Bulk-added categories and sample products (stationery, decor, furniture, etc.).
  const catalogCategoryIds = new Map();
  for (const category of catalogCategories) {
    let saved = await Category.findOne({
      $or: [{ slug: category.slug }, { name: category.name }],
    });
    if (saved) {
      if (saved.isDeleted) {
        saved.isDeleted = false;
        await saved.save();
      }
    } else {
      saved = await Category.create({ ...category, isDeleted: false });
    }
    catalogCategoryIds.set(category.slug, saved._id);
  }

  for (const product of catalogProducts) {
    const { categorySlug, ...details } = product;
    let categoryId = catalogCategoryIds.get(categorySlug);
    if (!categoryId) {
      const existingCategory = await Category.findOne({ slug: categorySlug });
      if (!existingCategory) continue;
      categoryId = existingCategory._id;
    }
    await Product.updateOne(
      { slug: details.slug },
      {
        $setOnInsert: {
          ...details,
          category: categoryId,
          isDeleted: false,
        },
      },
      { upsert: true },
    );
  }

  const productDetails = {
    "minimal-leather-backpack": {
      compareAtPrice: 99.99,
      couponCode: "PACK10",
      couponDiscountPercent: 10,
      highlights: [
        "Padded laptop compartment",
        "Water-resistant recycled fabric",
        "Adjustable ergonomic straps",
      ],
      specifications: [
        { name: "Capacity", value: "22 litres" },
        { name: "Material", value: "Recycled polyester and vegan leather" },
        { name: "Laptop fit", value: "Up to 15 inches" },
      ],
      reviews: [
        {
          name: "Jamie R.",
          rating: 5,
          title: "Great everyday bag",
          text: "Comfortable, sturdy, and just the right size.",
        },
      ],
    },
    "wireless-headphones": {
      compareAtPrice: 159,
      couponCode: "SOUND15",
      couponDiscountPercent: 15,
      highlights: [
        "Active noise cancellation",
        "Up to 30 hours of playback",
        "Soft over-ear cushions",
      ],
      specifications: [
        { name: "Connection", value: "Bluetooth 5.3" },
        { name: "Battery", value: "Up to 30 hours" },
        { name: "Charging", value: "USB-C fast charge" },
      ],
      reviews: [
        {
          name: "Meera V N.",
          rating: 5,
          title: "Excellent sound",
          text: "Clear audio and comfortable for long listening sessions.",
        },
      ],
    },
    "everyday-sneakers": {
      compareAtPrice: 79.99,
      couponCode: "STEP10",
      couponDiscountPercent: 10,
      highlights: [
        "Cushioned all-day support",
        "Breathable knit upper",
        "Lightweight flexible sole",
      ],
      specifications: [
        { name: "Upper", value: "Breathable knit" },
        { name: "Sole", value: "Lightweight rubber" },
        { name: "Fit", value: "True to size" },
      ],
      reviews: [
        {
          name: "Dharsh G R.",
          rating: 5,
          title: "Comfortable fit",
          text: "Lightweight and comfortable for daily walks.",
        },
      ],
    },
    "ceramic-desk-lamp": {
      compareAtPrice: 52,
      couponCode: "HOME5",
      couponDiscountPercent: 5,
      highlights: [
        "Warm adjustable light",
        "Hand-finished ceramic base",
        "Compact desk-friendly design",
      ],
      specifications: [
        { name: "Bulb", value: "E27, max 9W LED" },
        { name: "Material", value: "Ceramic and linen" },
        { name: "Cord", value: "1.8 metres" },
      ],
      reviews: [
        {
          name: "Dharsh G R.",
          rating: 4,
          title: "Lovely desk light",
          text: "Warm light and a sturdy base; looks great on my desk.",
        },
      ],
    },
  };

  for (const [slug, details] of Object.entries(productDetails)) {
    const product = await Product.findOne({ slug, isDeleted: false });
    if (!product || product.sampleContentInitialized) continue;
    let changed = false;
    for (const [field, value] of Object.entries(details)) {
      const currentValue = product[field];
      const isEmptyArray =
        Array.isArray(value) &&
        (!Array.isArray(currentValue) || currentValue.length === 0);
      const isEmptyString =
        typeof value === "string" && !String(currentValue || "").trim();
      if (
        currentValue === null ||
        currentValue === undefined ||
        currentValue === 0 ||
        isEmptyArray ||
        isEmptyString
      ) {
        product[field] = value;
        changed = true;
      }
    }
    product.sampleContentInitialized = true;
    changed = true;
    if (changed) await product.save();
  }

  const deskLamp = await Product.findOne({
    slug: "ceramic-desk-lamp",
    isDeleted: false,
  });
  const defaultLampImages = [
    "/images/lamp-1.svg",
    "/images/lamp-2.svg",
    "/images/lamp-3.svg",
  ];
  if (
    deskLamp &&
    deskLamp.images.length === defaultLampImages.length &&
    deskLamp.images.every((image, index) => image === defaultLampImages[index])
  ) {
    await Product.updateOne(
      { _id: deskLamp._id, images: deskLamp.images },
      {
        $set: {
          images: [
            "/images/products/bedside-lamp-photo-1.jpg",
            "/images/products/bedside-lamp-photo-2.jpg",
            "/images/products/bedside-lamp-photo-3.jpg",
          ],
          imageNote:
            deskLamp.imageNote ||
            "Reference lamp photos; exact product model may vary.",
        },
      },
    );
  }

  const wirelessHeadphones = await Product.findOne({
    slug: "wireless-headphones",
    isDeleted: false,
  });
  const defaultHeadphoneImages = [
    "/images/headphones-1.svg",
    "/images/headphones-2.svg",
    "/images/headphones-3.svg",
  ];
  if (
    wirelessHeadphones &&
    [
      defaultHeadphoneImages,
      ["/images/headphones-1.svg", "/images/headphones-2.svg"],
    ].some(
      (defaultImages) =>
        wirelessHeadphones.images.length === defaultImages.length &&
        wirelessHeadphones.images.every(
          (image, index) => image === defaultImages[index],
        ),
    )
  ) {
    await Product.updateOne(
      { _id: wirelessHeadphones._id, images: wirelessHeadphones.images },
      {
        $set: {
          images: [
            "/images/products/headphones-photo-1.jpg",
            "/images/products/headphones-photo-2.jpg",
            "/images/products/headphones-photo-3.jpg",
          ],
          imageNote:
            "Reference product photos; exact brand and model may vary.",
        },
      },
    );
  }

  const backpack = await Product.findOne({
    slug: "minimal-leather-backpack",
    isDeleted: false,
  });
  const defaultBackpackImages = [
    "/images/backpack-1.svg",
    "/images/backpack-2.svg",
    "/images/backpack-3.svg",
  ];
  if (
    backpack &&
    backpack.images.length === defaultBackpackImages.length &&
    backpack.images.every(
      (image, index) => image === defaultBackpackImages[index],
    )
  ) {
    await Product.updateOne(
      { _id: backpack._id, images: backpack.images },
      {
        $set: {
          images: [
            "/images/products/backpack-photo-1.jpg",
            "/images/products/backpack-photo-2.jpg",
            "/images/products/backpack-photo-3.jpg",
          ],
          imageNote:
            "Reference product photos; exact brand and model may vary.",
        },
      },
    );
  }

  const sneakers = await Product.findOne({
    slug: "everyday-sneakers",
    isDeleted: false,
  });
  const defaultSneakerImages = [
    "/images/sneakers-1.svg",
    "/images/sneakers-2.svg",
    "/images/sneakers-3.svg",
  ];
  if (
    sneakers &&
    sneakers.images.length === defaultSneakerImages.length &&
    sneakers.images.every(
      (image, index) => image === defaultSneakerImages[index],
    )
  ) {
    await Product.updateOne(
      { _id: sneakers._id, images: sneakers.images },
      {
        $set: {
          images: [
            "/images/products/sneakers-photo-1.jpg",
            "/images/products/sneakers-photo-2.jpg",
            "/images/products/sneakers-photo-3.jpg",
          ],
          imageNote: "Reference product photos; exact brand and model may vary.",
        },
      },
    );
  }

  const sampleGalleries = {
    "canvas-tote-bag": [
      "/images/products/canvas-tote-photo-1.jpg",
      "/images/products/canvas-tote-photo-2.jpg",
      "/images/products/canvas-tote-photo-3.jpg",
    ],
    "portable-bluetooth-speaker": [
      "/images/products/bluetooth-speaker-photo-1.jpg",
      "/images/products/bluetooth-speaker-photo-2.jpg",
      "/images/products/bluetooth-speaker-photo-3.jpg",
    ],
    "trail-running-shoes": [
      "/images/products/trail-shoes-photo-1.jpg",
      "/images/products/trail-shoes-photo-2.jpg",
      "/images/products/trail-shoes-photo-3.jpg",
    ],
    "bedside-table-lamp": [
      "/images/products/bedside-lamp-photo-1.jpg",
      "/images/products/bedside-lamp-photo-2.jpg",
      "/images/products/bedside-lamp-photo-3.jpg",
    ],
    "minimal-leather-backpack": [
      "/images/products/backpack-photo-1.jpg",
      "/images/products/backpack-photo-2.jpg",
      "/images/products/backpack-photo-3.jpg",
    ],
    "everyday-sneakers": [
      "/images/products/sneakers-photo-1.jpg",
      "/images/products/sneakers-photo-2.jpg",
      "/images/products/sneakers-photo-3.jpg",
    ],
    "everyday-leather-card-holder": [
      "/images/accessories/card-holder.jpg",
      "/images/accessories/card-holder-photo-2.jpg",
      "/images/accessories/card-holder-photo-3.jpg",
    ],
    "classic-everyday-sunglasses": [
      "/images/accessories/sunglasses.jpg",
      "/images/accessories/sunglasses-photo-2.jpg",
      "/images/accessories/sunglasses-photo-3.jpg",
    ],
    "minimalist-everyday-watch": [
      "/images/accessories/everyday-watch.jpg",
      "/images/accessories/watch-photo-2.jpg",
      "/images/accessories/watch-photo-3.jpg",
    ],
  };
  for (const [slug, images] of Object.entries(sampleGalleries)) {
    const product = await Product.findOne({ slug, isDeleted: false });
    if (!product || product.images[0] !== images[0]) continue;
    const alreadyUpToDate =
      product.images.length === images.length &&
      product.images.every((image, index) => image === images[index]);
    if (alreadyUpToDate) continue;
    await Product.updateOne(
      { _id: product._id, images: product.images },
      { $set: { images } },
    );
  }
};

const storeRoutes = require("./routes/store");
const adminRoutes = require("./routes/admin");
const Category = require("./models/Category");
const Product = require("./models/Product");
const {
  login,
  verifyOTP,
  resendOTP,
  register,
  requestPasswordReset,
  verifyPasswordResetOTP,
  showResetPassword,
  resetPassword,
  beginOAuth,
  finishOAuth,
} = require("./controllers/auth.controller");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "shoply-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use((req, res, next) => {
  const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
  res.locals.cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  const originalRender = res.render.bind(res);

  res.render = (view, options, callback) => {
    const renderCallback = (error, html) => {
      if (error) {
        return callback ? callback(error) : next(error);
      }

      if (!html.includes('href="/styles.css"')) {
        html = html.replace(
          "</head>",
          '<link rel="stylesheet" href="/styles.css"><script defer src="/app.js"></script></head>',
        );
      }

      const isAdminPage = req.originalUrl.split("?")[0].startsWith("/admin");
      if (!isAdminPage || !html.includes('class="sidebar"')) {
        const siteHeader = renderSiteHeader(
          req.session.user || null,
          res.locals.cartCount || 0,
          isAdminPage,
        );
        if (/<header\b[^>]*>[\s\S]*?<\/header>/i.test(html)) {
          html = html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i, siteHeader);
        } else {
          html = html.replace(
            /<body\b[^>]*>/i,
            (bodyTag) => `${bodyTag}${siteHeader}`,
          );
        }
      }

      if (req.session.welcomePopup) {
        const welcomeMessage =
          req.session.welcomePopup === "admin"
            ? "Welcome Admin 🙏"
            : "Welcome sweetie 😘";
        req.session.welcomePopup = false;
        html = html.replace(
          /<\/body>/i,
          `<div class="welcome-popup" role="status" aria-live="polite"><span>${welcomeMessage}</span><button type="button" aria-label="Dismiss welcome message">×</button></div></body>`,
        );
      }

      if (callback) {
        return callback(null, html);
      }

      return res.send(html);
    };

    if (typeof options === "function") {
      return originalRender(view, renderCallback);
    }

    return originalRender(view, options, renderCallback);
  };

  next();
});

app.post("/register", register);
app.post("/login", login);
app.post("/verify-otp", verifyOTP);
app.post("/auth/verify-otp", verifyOTP);
app.post("/resend-otp", resendOTP);
app.get("/auth/google", beginOAuth("google"));
app.get("/auth/google/callback", finishOAuth("google"));
app.get("/auth/facebook", beginOAuth("facebook"));
app.get("/auth/facebook/callback", finishOAuth("facebook"));
app.post("/forgot-password", requestPasswordReset);
app.post("/reset-password/verify-otp", verifyPasswordResetOTP);
app.get("/reset-password", showResetPassword);
app.post("/reset-password", resetPassword);

app.use("/", storeRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return next(error);
  const status = error.name === "MulterError" ? 400 : error.status || 500;
  return res
    .status(status)
    .send(status < 500 ? error.message : "Internal server error.");
});

const startServer = async () => {
  await connectDB();
  await ensureAdminUser();
  await seedCatalog();
  app.listen(port, () => {
    console.log(`VaBuy server running at http://localhost:${port}`);
  });
};

startServer().catch((error) => {
  console.error("Application startup failed:", error);
  process.exitCode = 1;
});
