require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");

const fixImages = async () => {
  await connectDB();
  
  const updates = [
    {
      slug: "minimal-leather-backpack",
      images: [
        "/images/products/backpack-photo-1.jpg",
        "/images/products/backpack-photo-2.jpg",
        "/images/products/backpack-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "wireless-headphones",
      images: [
        "/images/products/headphones-photo-1.jpg",
        "/images/products/headphones-photo-2.jpg",
        "/images/products/headphones-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "everyday-sneakers",
      images: [
        "/images/products/sneakers-photo-1.jpg",
        "/images/products/sneakers-photo-2.jpg",
        "/images/products/sneakers-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "ceramic-desk-lamp",
      images: [
        "/images/products/bedside-lamp-photo-1.jpg",
        "/images/products/bedside-lamp-photo-2.jpg",
        "/images/products/bedside-lamp-photo-3.jpg"
      ],
      imageNote: "Reference lamp photos; exact product model may vary."
    },
    {
      slug: "everyday-leather-card-holder",
      images: [
        "/images/accessories/card-holder.jpg",
        "/images/accessories/card-holder-photo-2.jpg",
        "/images/accessories/card-holder-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "classic-everyday-sunglasses",
      images: [
        "/images/accessories/sunglasses.jpg",
        "/images/accessories/sunglasses-photo-2.jpg",
        "/images/accessories/sunglasses-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "minimalist-everyday-watch",
      images: [
        "/images/accessories/everyday-watch.jpg",
        "/images/accessories/watch-photo-2.jpg",
        "/images/accessories/watch-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "canvas-tote-bag",
      images: [
        "/images/products/canvas-tote-photo-1.jpg",
        "/images/products/canvas-tote-photo-2.jpg",
        "/images/products/canvas-tote-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "portable-bluetooth-speaker",
      images: [
        "/images/products/bluetooth-speaker-photo-1.jpg",
        "/images/products/bluetooth-speaker-photo-2.jpg",
        "/images/products/bluetooth-speaker-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "trail-running-shoes",
      images: [
        "/images/products/trail-shoes-photo-1.jpg",
        "/images/products/trail-shoes-photo-2.jpg",
        "/images/products/trail-shoes-photo-3.jpg"
      ],
      imageNote: "Reference product photos; exact brand and model may vary."
    },
    {
      slug: "bedside-table-lamp",
      images: [
        "/images/products/bedside-lamp-photo-1.jpg",
        "/images/products/bedside-lamp-photo-2.jpg",
        "/images/products/bedside-lamp-photo-3.jpg"
      ],
      imageNote: "Reference lamp photos; exact product model may vary."
    }
  ];

  for (const update of updates) {
    try {
      const result = await Product.updateOne(
        { slug: update.slug, isDeleted: false },
        { $set: { images: update.images, imageNote: update.imageNote } }
      );
      console.log(`Updated ${update.slug}:`, result.modifiedCount > 0 ? 'success' : 'no change');
    } catch (error) {
      console.error(`Failed to update ${update.slug}:`, error.message);
    }
  }

  await mongoose.connection.close();
  console.log("Done");
};

fixImages().catch(console.error);
