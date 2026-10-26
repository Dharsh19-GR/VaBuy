/**
 * Extra storefront catalog: categories and sample products added in bulk.
 *
 * Photos live under public/images/catalog/<category-slug>/ and are referenced
 * by the product slug so galleries stay predictable. See
 * public/images/catalog/IMAGE-CREDITS.txt for photo sources.
 */

const catalogCategories = [
  { name: "Stationery", slug: "stationery" },
  { name: "Household Decor", slug: "household-decor" },
  { name: "Kitchen Utensils", slug: "kitchen-utensils" },
  { name: "Music Instruments", slug: "music-instruments" },
  { name: "Clothing", slug: "clothing" },
  { name: "Wall Clocks", slug: "wall-clocks" },
  { name: "Mobile Phones", slug: "mobile-phones" },
  { name: "Home Furniture", slug: "home-furniture" },
  { name: "Arts", slug: "arts" },
  { name: "Wall Stickers", slug: "wall-stickers" },
];

const catalogProducts = [
  // ---------------------------------------------------------------- Stationery
  {
    categorySlug: "stationery",
    name: "A5 Leather Journal",
    slug: "a5-leather-journal",
    brand: "Ink & Grain",
    description:
      "A compact A5 journal wrapped in soft full-grain leather that ages beautifully with use. Inside, 240 pages of thick 100 gsm paper handle fountain pens, gel pens, and pencil sketches without ghosting. A ribbon marker and elastic closure keep your notes tidy on the move.",
    price: 699,
    compareAtPrice: 899,
    stock: 42,
    rating: 4.8,
    images: [
      "/images/catalog/stationery/a5-leather-journal-1.jpg",
      "/images/catalog/stationery/a5-leather-journal-2.jpg",
      "/images/catalog/stationery/a5-leather-journal-3.jpg",
    ],
    imageNote:
      "Reference stationery photos; exact leather tone and packaging may vary.",
    highlights: [
      "Soft full-grain leather cover",
      "240 pages of 100 gsm cream paper",
      "Ribbon marker and elastic closure",
    ],
    specifications: [
      { name: "Size", value: "A5 (148 × 210 mm)" },
      { name: "Pages", value: "240, ruled" },
      { name: "Paper", value: "100 gsm acid-free" },
      { name: "Binding", value: "Lay-flat stitched" },
    ],
    reviews: [
      {
        name: "Meera R.",
        rating: 5,
        title: "Lovely paper",
        text: "No bleed-through with my fountain pen and the leather feels great in hand.",
      },
    ],
  },
  {
    categorySlug: "stationery",
    name: "Classic Fountain Pen",
    slug: "classic-fountain-pen",
    brand: "Ink & Grain",
    description:
      "A balanced fountain pen with a smooth stainless-steel nib and a comfortable grip for long writing sessions. The cartridge-converter system works with standard international cartridges or your favourite bottled ink, making it an easy everyday pen for letters, journals, and notes.",
    price: 1299,
    compareAtPrice: 1599,
    stock: 26,
    rating: 4.7,
    images: [
      "/images/catalog/stationery/classic-fountain-pen-1.jpg",
      "/images/catalog/stationery/classic-fountain-pen-2.jpg",
      "/images/catalog/stationery/classic-fountain-pen-3.jpg",
    ],
    imageNote:
      "Reference stationery photos; exact nib size and packaging may vary.",
    highlights: [
      "Smooth stainless-steel medium nib",
      "Cartridge and converter compatible",
      "Includes one blue ink cartridge",
    ],
    specifications: [
      { name: "Nib", value: "Medium stainless steel" },
      { name: "Filling system", value: "Cartridge / converter" },
      { name: "Body", value: "Turned resin" },
      { name: "Weight", value: "22 g" },
    ],
    reviews: [
      {
        name: "Arjun P.",
        rating: 5,
        title: "Writes beautifully",
        text: "Starts every time and lays down a clean, consistent line.",
      },
    ],
  },

  // ----------------------------------------------------------- Household Decor
  {
    categorySlug: "household-decor",
    name: "Sculptural Ceramic Vase",
    slug: "sculptural-ceramic-vase",
    brand: "Clayhouse",
    description:
      "A hand-finished stoneware vase with a soft, organic silhouette that looks just as good empty as it does with a few stems. The matte glaze catches the light gently, and the weighted base keeps tall arrangements steady on shelves, consoles, and dining tables.",
    price: 1199,
    compareAtPrice: 1499,
    stock: 22,
    rating: 4.8,
    images: [
      "/images/catalog/household-decor/sculptural-ceramic-vase-1.jpg",
      "/images/catalog/household-decor/sculptural-ceramic-vase-2.jpg",
      "/images/catalog/household-decor/sculptural-ceramic-vase-3.jpg",
    ],
    imageNote:
      "Reference home decor photos; exact glaze shade may vary slightly.",
    highlights: [
      "Hand-finished stoneware",
      "Matte, food-safe glaze",
      "Weighted base for stability",
    ],
    specifications: [
      { name: "Material", value: "Glazed stoneware" },
      { name: "Height", value: "26 cm" },
      { name: "Opening", value: "8 cm" },
      { name: "Care", value: "Wipe clean, do not soak" },
    ],
    reviews: [
      {
        name: "Sneha K.",
        rating: 5,
        title: "Looks designer",
        text: "Beautiful shape and the colour is exactly like the photos.",
      },
    ],
  },
  {
    categorySlug: "household-decor",
    name: "Porcelain Candle Holder",
    slug: "porcelain-candle-holder",
    brand: "Clayhouse",
    description:
      "A small porcelain candle holder with a clean glazed finish and a deep cup that hides the candle base. It brings a warm, quiet glow to bedside tables, dinner settings, and bathroom shelves, and stacks neatly when you want to store it away.",
    price: 749,
    compareAtPrice: 949,
    stock: 35,
    rating: 4.6,
    images: [
      "/images/catalog/household-decor/porcelain-candle-holder-1.jpg",
      "/images/catalog/household-decor/porcelain-candle-holder-2.jpg",
      "/images/catalog/household-decor/porcelain-candle-holder-3.jpg",
    ],
    imageNote:
      "Reference home decor photos; candle not included.",
    highlights: [
      "Glazed porcelain finish",
      "Fits standard tealights",
      "Stackable storage",
    ],
    specifications: [
      { name: "Material", value: "Glazed porcelain" },
      { name: "Diameter", value: "9 cm" },
      { name: "Height", value: "5 cm" },
      { name: "Candle", value: "Standard tealight" },
    ],
    reviews: [
      {
        name: "Ishaan V.",
        rating: 4,
        title: "Simple and pretty",
        text: "Good weight and a clean finish. Looks lovely on the dinner table.",
      },
    ],
  },

  // ---------------------------------------------------------- Kitchen Utensils
  {
    categorySlug: "kitchen-utensils",
    name: "Wooden Kitchen Utensil Set",
    slug: "wooden-kitchen-utensil-set",
    brand: "Hearth & Oak",
    description:
      "A seven-piece set of hand-finished wooden utensils for everyday cooking. The smooth beech heads are gentle on non-stick pans, and the long handles keep your hands clear of hot pots. Includes a slotted turner, solid spoon, slotted spoon, ladle, fork, spatula, and a handy hanging loop.",
    price: 899,
    compareAtPrice: 1199,
    stock: 30,
    rating: 4.7,
    images: [
      "/images/catalog/kitchen-utensils/wooden-kitchen-utensil-set-1.jpg",
      "/images/catalog/kitchen-utensils/wooden-kitchen-utensil-set-2.jpg",
      "/images/catalog/kitchen-utensils/wooden-kitchen-utensil-set-3.jpg",
    ],
    imageNote:
      "Reference kitchen photos; wood grain and finish may vary naturally.",
    highlights: [
      "Seven-piece cooking set",
      "Plantation beech wood",
      "Non-stick and enamel safe",
    ],
    specifications: [
      { name: "Pieces", value: "7" },
      { name: "Material", value: "Beech wood" },
      { name: "Length", value: "30–34 cm" },
      { name: "Care", value: "Hand wash, oil occasionally" },
    ],
    reviews: [
      {
        name: "Nikhil B.",
        rating: 5,
        title: "Great everyday set",
        text: "Light in the hand and doesn't scratch my pans at all.",
      },
    ],
  },
  {
    categorySlug: "kitchen-utensils",
    name: "Cast Iron Skillet",
    slug: "cast-iron-skillet",
    brand: "Hearth & Oak",
    description:
      "A pre-seasoned cast iron skillet that sears, fries, bakes, and finishes meals beautifully. The thick iron body holds heat evenly and gets better with every use, moving from stovetop to oven to table without complaint. A helper handle makes lifting safer when it is full.",
    price: 1499,
    compareAtPrice: 1899,
    stock: 18,
    rating: 4.9,
    images: [
      "/images/catalog/kitchen-utensils/cast-iron-skillet-1.jpg",
      "/images/catalog/kitchen-utensils/cast-iron-skillet-2.jpg",
      "/images/catalog/kitchen-utensils/cast-iron-skillet-3.jpg",
    ],
    imageNote:
      "Reference kitchen photos; exact pan size and branding may vary.",
    highlights: [
      "Pre-seasoned and ready to use",
      "Oven-safe to 260 °C",
      "Works on gas, electric, and induction",
    ],
    specifications: [
      { name: "Material", value: "Cast iron" },
      { name: "Diameter", value: "26 cm" },
      { name: "Weight", value: "2.4 kg" },
      { name: "Care", value: "Hand wash and re-oil" },
    ],
    reviews: [
      {
        name: "Rahul S.",
        rating: 5,
        title: "Perfect sear",
        text: "Heavy in the best way. Steaks and dosas come out brilliant.",
      },
    ],
  },

  // --------------------------------------------------------- Music Instruments
  {
    categorySlug: "music-instruments",
    name: "Acoustic Guitar",
    slug: "acoustic-guitar",
    brand: "Northwood",
    description:
      "A full-size dreadnought acoustic guitar with a warm, balanced tone that suits strumming, fingerstyle, and singalongs. The solid spruce top opens up over time, while the slim neck and low action make it comfortable for newer players as well as seasoned hands.",
    price: 8999,
    compareAtPrice: 10999,
    stock: 12,
    rating: 4.7,
    images: [
      "/images/catalog/music-instruments/acoustic-guitar-1.jpg",
      "/images/catalog/music-instruments/acoustic-guitar-2.jpg",
      "/images/catalog/music-instruments/acoustic-guitar-3.jpg",
    ],
    imageNote:
      "Reference instrument photos; exact finish and model may vary.",
    highlights: [
      "Dreadnought body with spruce top",
      "Slim, comfortable neck profile",
      "Includes gig bag and picks",
    ],
    specifications: [
      { name: "Body", value: "Dreadnought" },
      { name: "Top", value: "Solid spruce" },
      { name: "Frets", value: "20" },
      { name: "Included", value: "Gig bag, strap, picks" },
    ],
    reviews: [
      {
        name: "Aditi M.",
        rating: 5,
        title: "Sounds great for the price",
        text: "Warm tone and it stayed in tune after the first week.",
      },
    ],
  },
  {
    categorySlug: "music-instruments",
    name: "Digital Piano",
    slug: "digital-piano",
    brand: "Northwood",
    description:
      "An 88-key digital piano with hammer-action keys and a rich, layered sound engine. It offers built-in lesson modes, metronome, and headphone output for quiet practice, plus a slim cabinet that fits neatly into a living room or study.",
    price: 24999,
    compareAtPrice: 29999,
    stock: 8,
    rating: 4.8,
    images: [
      "/images/catalog/music-instruments/digital-piano-1.jpg",
      "/images/catalog/music-instruments/digital-piano-2.jpg",
      "/images/catalog/music-instruments/digital-piano-3.jpg",
    ],
    imageNote:
      "Reference instrument photos; exact model and finish may vary.",
    highlights: [
      "88 hammer-action keys",
      "Built-in metronome and lesson mode",
      "Headphone output for silent practice",
    ],
    specifications: [
      { name: "Keys", value: "88, hammer action" },
      { name: "Voices", value: "12 instrument sounds" },
      { name: "Outputs", value: "Headphones, USB-MIDI" },
      { name: "Included", value: "Music rest, sustain pedal" },
    ],
    reviews: [
      {
        name: "Kavya N.",
        rating: 5,
        title: "Feels like a real piano",
        text: "The key weight is convincing and my daughter loves the lesson mode.",
      },
    ],
  },

  // ------------------------------------------------------------------ Clothing
  {
    categorySlug: "clothing",
    name: "Everyday Cotton T-Shirt",
    slug: "everyday-cotton-tshirt",
    brand: "Loom & Co.",
    description:
      "A soft, mid-weight cotton T-shirt cut for an easy everyday fit. The combed cotton feels smooth against the skin, holds its shape through washes, and works as a base layer or on its own with jeans and shorts.",
    price: 499,
    compareAtPrice: 699,
    stock: 60,
    rating: 4.5,
    images: [
      "/images/catalog/clothing/everyday-cotton-tshirt-1.jpg",
      "/images/catalog/clothing/everyday-cotton-tshirt-2.jpg",
      "/images/catalog/clothing/everyday-cotton-tshirt-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact shade may vary between screens.",
    highlights: [
      "180 gsm combed cotton",
      "Relaxed unisex fit",
      "Pre-shrunk and colourfast",
    ],
    specifications: [
      { name: "Fabric", value: "100% combed cotton" },
      { name: "Fit", value: "Relaxed unisex" },
      { name: "Weight", value: "180 gsm" },
      { name: "Care", value: "Machine wash cold" },
    ],
    reviews: [
      {
        name: "Rohan T.",
        rating: 4,
        title: "Good basic tee",
        text: "Soft, true to size, and hasn't lost shape after several washes.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Classic Denim Jacket",
    slug: "classic-denim-jacket",
    brand: "Loom & Co.",
    description:
      "A timeless denim jacket with a slightly relaxed cut that layers easily over tees and hoodies. The mid-wash cotton denim softens with wear, while metal buttons, chest pockets, and adjustable waist tabs keep the classic details intact.",
    price: 1999,
    compareAtPrice: 2499,
    stock: 24,
    rating: 4.7,
    images: [
      "/images/catalog/clothing/classic-denim-jacket-1.jpg",
      "/images/catalog/clothing/classic-denim-jacket-2.jpg",
      "/images/catalog/clothing/classic-denim-jacket-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact wash and fit may vary.",
    highlights: [
      "Mid-wash cotton denim",
      "Metal shank buttons",
      "Adjustable waist tabs",
    ],
    specifications: [
      { name: "Fabric", value: "100% cotton denim" },
      { name: "Fit", value: "Relaxed" },
      { name: "Pockets", value: "2 chest, 2 hand" },
      { name: "Care", value: "Machine wash cold, inside out" },
    ],
    reviews: [
      {
        name: "Tanvi D.",
        rating: 5,
        title: "Just the right weight",
        text: "Not too stiff and the wash looks better in person.",
      },
    ],
  },

  // --------------------------------------------------------------- Wall Clocks
  {
    categorySlug: "wall-clocks",
    name: "Minimal Quartz Wall Clock",
    slug: "minimal-quartz-wall-clock",
    brand: "Modtime",
    description:
      "A clean, quiet quartz wall clock that keeps a room looking calm. The simple dial and slim frame suit kitchens, offices, and living rooms, while the silent sweep movement means no ticking to distract you.",
    price: 899,
    compareAtPrice: 1199,
    stock: 28,
    rating: 4.6,
    images: [
      "/images/catalog/wall-clocks/minimal-quartz-wall-clock-1.jpg",
      "/images/catalog/wall-clocks/minimal-quartz-wall-clock-2.jpg",
      "/images/catalog/wall-clocks/minimal-quartz-wall-clock-3.jpg",
    ],
    imageNote:
      "Reference wall clock photos; exact dial markings may vary.",
    highlights: [
      "Silent sweep movement",
      "Easy-to-read dial",
      "Single AA battery",
    ],
    specifications: [
      { name: "Diameter", value: "30 cm" },
      { name: "Movement", value: "Silent quartz" },
      { name: "Power", value: "1 × AA battery" },
      { name: "Mounting", value: "Keyhole slot" },
    ],
    reviews: [
      {
        name: "Vikram A.",
        rating: 5,
        title: "Actually silent",
        text: "No ticking at all and it looks clean on a plain wall.",
      },
    ],
  },
  {
    categorySlug: "wall-clocks",
    name: "Decorative Wall Clock",
    slug: "decorative-wall-clock",
    brand: "Modtime",
    description:
      "A statement wall clock with a decorative face and a warm, traditional feel. The larger numerals and contrasting hands make it easy to read from across the room, and the sturdy frame gives it a substantial, finished look.",
    price: 1299,
    compareAtPrice: 1699,
    stock: 16,
    rating: 4.5,
    images: [
      "/images/catalog/wall-clocks/decorative-wall-clock-1.jpg",
      "/images/catalog/wall-clocks/decorative-wall-clock-2.jpg",
      "/images/catalog/wall-clocks/decorative-wall-clock-3.jpg",
    ],
    imageNote:
      "Reference wall clock photos; exact style may vary.",
    highlights: [
      "Decorative statement face",
      "Bold, readable numerals",
      "Sturdy frame with keyhole mount",
    ],
    specifications: [
      { name: "Diameter", value: "35 cm" },
      { name: "Movement", value: "Quartz" },
      { name: "Power", value: "1 × AA battery" },
      { name: "Finish", value: "Matte frame" },
    ],
    reviews: [
      {
        name: "Deepa L.",
        rating: 4,
        title: "Lovely focal point",
        text: "Fills the wall nicely and the face is easy to read from the sofa.",
      },
    ],
  },

  // --------------------------------------------------------------- Mobile Phones
  {
    categorySlug: "mobile-phones",
    name: "Everyday Smartphone",
    slug: "everyday-smartphone",
    brand: "Vayu",
    description:
      "A reliable everyday smartphone with a bright 6.5-inch display, a dual camera that handles daylight photos well, and all-day battery life. It covers the basics comfortably — calls, chat, maps, streaming, and mobile payments — without the flagship price.",
    price: 15999,
    compareAtPrice: 18999,
    stock: 20,
    rating: 4.4,
    images: [
      "/images/catalog/mobile-phones/everyday-smartphone-1.jpg",
      "/images/catalog/mobile-phones/everyday-smartphone-2.jpg",
      "/images/catalog/mobile-phones/everyday-smartphone-3.jpg",
    ],
    imageNote:
      "Reference phone photos; exact model, colour, and packaging may vary.",
    highlights: [
      "6.5-inch full-HD display",
      "50 MP dual rear camera",
      "5000 mAh battery with fast charge",
    ],
    specifications: [
      { name: "Display", value: "6.5 in, 1080 × 2400" },
      { name: "Storage", value: "128 GB, expandable" },
      { name: "Rear camera", value: "50 MP + 8 MP" },
      { name: "Battery", value: "5000 mAh" },
    ],
    reviews: [
      {
        name: "Sameer J.",
        rating: 4,
        title: "Solid value",
        text: "Battery easily lasts a full day and the screen is bright outdoors.",
      },
    ],
  },
  {
    categorySlug: "mobile-phones",
    name: "Foldable Smartphone",
    slug: "foldable-smartphone",
    brand: "Vayu",
    description:
      "A foldable smartphone that opens into a compact tablet-sized screen for reading, maps, and split-screen multitasking. The flexible display folds flat into a pocketable shape, and the reinforced hinge is rated for years of daily opening and closing.",
    price: 49999,
    compareAtPrice: 59999,
    stock: 7,
    rating: 4.6,
    images: [
      "/images/catalog/mobile-phones/foldable-smartphone-1.jpg",
      "/images/catalog/mobile-phones/foldable-smartphone-2.jpg",
      "/images/catalog/mobile-phones/foldable-smartphone-3.jpg",
    ],
    imageNote:
      "Reference phone photos; exact model, colour, and packaging may vary.",
    highlights: [
      "7.6-inch flexible inner display",
      "Reinforced folding hinge",
      "Triple camera system",
    ],
    specifications: [
      { name: "Inner display", value: "7.6 in AMOLED" },
      { name: "Cover display", value: "6.2 in" },
      { name: "Storage", value: "256 GB" },
      { name: "Battery", value: "4400 mAh" },
    ],
    reviews: [
      {
        name: "Ayesha F.",
        rating: 5,
        title: "Great for reading",
        text: "The big inner screen is brilliant for books and maps. Hinge feels solid.",
      },
    ],
  },

  // ------------------------------------------------------------- Home Furniture
  {
    categorySlug: "home-furniture",
    name: "Oak Lounge Armchair",
    slug: "oak-lounge-armchair",
    brand: "Grainhouse",
    description:
      "A relaxed lounge armchair with a bent oak frame and a deep, supportive seat. The removable cushion covers are easy to clean, and the curved silhouette pairs well with reading corners, bedrooms, and open living spaces.",
    price: 12999,
    compareAtPrice: 15999,
    stock: 9,
    rating: 4.8,
    images: [
      "/images/catalog/home-furniture/oak-lounge-armchair-1.jpg",
      "/images/catalog/home-furniture/oak-lounge-armchair-2.jpg",
      "/images/catalog/home-furniture/oak-lounge-armchair-3.jpg",
    ],
    imageNote:
      "Reference furniture photos; exact upholstery shade may vary.",
    highlights: [
      "Bent oak frame",
      "Removable, washable covers",
      "High-resilience foam seat",
    ],
    specifications: [
      { name: "Frame", value: "Layered oak veneer" },
      { name: "Upholstery", value: "Woven cotton blend" },
      { name: "Seat height", value: "42 cm" },
      { name: "Assembly", value: "Legs attach with included tool" },
    ],
    reviews: [
      {
        name: "Nandini C.",
        rating: 5,
        title: "My favourite chair",
        text: "Very comfortable for long reading sessions and easy to assemble.",
      },
    ],
  },
  {
    categorySlug: "home-furniture",
    name: "Glass Coffee Table",
    slug: "glass-coffee-table",
    brand: "Grainhouse",
    description:
      "A low coffee table with a tempered glass top and slim metal legs that keep a small living room feeling open. The clear surface is easy to wipe clean, and the rounded corners make it a safer choice in busy family spaces.",
    price: 7999,
    compareAtPrice: 9999,
    stock: 11,
    rating: 4.6,
    images: [
      "/images/catalog/home-furniture/glass-coffee-table-1.jpg",
      "/images/catalog/home-furniture/glass-coffee-table-2.jpg",
      "/images/catalog/home-furniture/glass-coffee-table-3.jpg",
    ],
    imageNote:
      "Reference furniture photos; exact table shape may vary.",
    highlights: [
      "8 mm tempered glass top",
      "Powder-coated steel legs",
      "Rounded safety corners",
    ],
    specifications: [
      { name: "Top", value: "8 mm tempered glass" },
      { name: "Frame", value: "Powder-coated steel" },
      { name: "Size", value: "90 × 50 × 40 cm" },
      { name: "Assembly", value: "Flat-pack, tools included" },
    ],
    reviews: [
      {
        name: "Harish G.",
        rating: 4,
        title: "Light and airy",
        text: "Makes the room feel bigger. Glass wipes clean in seconds.",
      },
    ],
  },

  // ---------------------------------------------------------------------- Arts
  {
    categorySlug: "arts",
    name: "Abstract Canvas Art",
    slug: "abstract-canvas-art",
    brand: "Studio Hues",
    description:
      "A vibrant abstract canvas that brings colour and movement to a plain wall. Printed on textured artist canvas and stretched over a solid wooden frame, it arrives ready to hang with the mounting hardware included.",
    price: 3499,
    compareAtPrice: 4499,
    stock: 14,
    rating: 4.7,
    images: [
      "/images/catalog/arts/abstract-canvas-art-1.jpg",
      "/images/catalog/arts/abstract-canvas-art-2.jpg",
      "/images/catalog/arts/abstract-canvas-art-3.jpg",
    ],
    imageNote:
      "Reference artwork photos; colours may differ slightly in print.",
    highlights: [
      "Textured artist canvas",
      "Solid wooden stretcher frame",
      "Ready to hang",
    ],
    specifications: [
      { name: "Medium", value: "Archival pigment on canvas" },
      { name: "Size", value: "60 × 80 cm" },
      { name: "Frame", value: "FSC-certified pine" },
      { name: "Included", value: "Hanging kit" },
    ],
    reviews: [
      {
        name: "Pooja S.",
        rating: 5,
        title: "Brightens the room",
        text: "The colours are rich and it came well packed with no dents.",
      },
    ],
  },
  {
    categorySlug: "arts",
    name: "Ceramic Sculpture",
    slug: "ceramic-sculpture",
    brand: "Studio Hues",
    description:
      "A small ceramic sculpture with an organic, hand-built form that adds a quiet focal point to a shelf or console. Each piece is glazed by hand, so subtle variations in tone make yours one of a kind.",
    price: 5999,
    compareAtPrice: 7499,
    stock: 6,
    rating: 4.8,
    images: [
      "/images/catalog/arts/ceramic-sculpture-1.jpg",
      "/images/catalog/arts/ceramic-sculpture-2.jpg",
      "/images/catalog/arts/ceramic-sculpture-3.jpg",
    ],
    imageNote:
      "Reference sculpture photos; each handmade piece varies slightly.",
    highlights: [
      "Hand-built stoneware",
      "Individual hand-applied glaze",
      "Felt base protects surfaces",
    ],
    specifications: [
      { name: "Material", value: "Stoneware" },
      { name: "Height", value: "24 cm" },
      { name: "Finish", value: "Satin glaze" },
      { name: "Weight", value: "1.6 kg" },
    ],
    reviews: [
      {
        name: "Ritu B.",
        rating: 5,
        title: "A real conversation piece",
        text: "Heavier and more detailed than I expected. Beautiful finish.",
      },
    ],
  },

  // -------------------------------------------------------------- Wall Stickers
  {
    categorySlug: "wall-stickers",
    name: "World Map Wall Decal",
    slug: "world-map-wall-decal",
    brand: "Wallstory",
    description:
      "A removable world map wall decal that turns a blank wall into a travel wall. The matte vinyl applies smoothly to painted walls, glass, and furniture, and peels away cleanly when you want to rearrange. Comes in three easy-to-place sections.",
    price: 599,
    compareAtPrice: 799,
    stock: 45,
    rating: 4.5,
    images: [
      "/images/catalog/wall-stickers/world-map-wall-decal-1.jpg",
      "/images/catalog/wall-stickers/world-map-wall-decal-2.jpg",
      "/images/catalog/wall-stickers/world-map-wall-decal-3.jpg",
    ],
    imageNote:
      "Reference wall sticker photos; exact size and layout may vary.",
    highlights: [
      "Removable matte vinyl",
      "Three easy-to-place sections",
      "Leaves no residue",
    ],
    specifications: [
      { name: "Material", value: "Matte PVC-free vinyl" },
      { name: "Assembled size", value: "120 × 70 cm" },
      { name: "Sections", value: "3" },
      { name: "Application", value: "Smooth, dry indoor walls" },
    ],
    reviews: [
      {
        name: "Maya J.",
        rating: 4,
        title: "Easy to apply",
        text: "Took about twenty minutes and looks great above the desk.",
      },
    ],
  },
  {
    categorySlug: "wall-stickers",
    name: "Quote Wall Sticker",
    slug: "quote-wall-sticker",
    brand: "Wallstory",
    description:
      "A simple quote wall sticker that adds a bit of character to a study, bedroom, or office nook. The precision-cut vinyl is easy to apply with the included squeegee, and the elegant lettering holds up well in everyday indoor conditions.",
    price: 399,
    compareAtPrice: 549,
    stock: 55,
    rating: 4.4,
    images: [
      "/images/catalog/wall-stickers/quote-wall-sticker-1.jpg",
      "/images/catalog/wall-stickers/quote-wall-sticker-2.jpg",
      "/images/catalog/wall-stickers/quote-wall-sticker-3.jpg",
    ],
    imageNote:
      "Reference wall sticker photos; available quote text may vary.",
    highlights: [
      "Precision-cut matte vinyl",
      "Squeegee and instructions included",
      "Removes without damage",
    ],
    specifications: [
      { name: "Material", value: "Matte removable vinyl" },
      { name: "Size", value: "60 × 30 cm" },
      { name: "Included", value: "Squeegee, instructions" },
      { name: "Application", value: "Smooth, dry indoor walls" },
    ],
    reviews: [
      {
        name: "Aniket D.",
        rating: 4,
        title: "Nice finishing touch",
        text: "Applied easily and the letters are crisp. Good value.",
      },
    ],
  },

  // ------------------------------------------------------------------ Footwear
  {
    categorySlug: "footwear",
    name: "Handcrafted Kolhapuri Chappals",
    slug: "handcrafted-kolhapuri-chappals",
    brand: "Kolhapure Crafts",
    description:
      "Traditional Kolhapuri chappals hand-stitched from soft leather with a braided toe strap and a cushioned insole. The open design keeps feet cool through long summer days, and the sturdy sole grips well on tiled floors and paved streets.",
    price: 1499,
    compareAtPrice: 1899,
    stock: 34,
    rating: 4.7,
    images: [
      "/images/catalog/footwear/handcrafted-kolhapuri-chappals-1.jpg",
      "/images/catalog/footwear/handcrafted-kolhapuri-chappals-2.jpg",
      "/images/catalog/footwear/handcrafted-kolhapuri-chappals-3.jpg",
    ],
    imageNote:
      "Reference footwear photos; exact leather tone and stitching may vary.",
    highlights: [
      "Hand-stitched leather upper",
      "Cushioned, flexible insole",
      "Traditional braided toe strap",
    ],
    specifications: [
      { name: "Upper", value: "Vegetable-tanned leather" },
      { name: "Sole", value: "Leather with rubber grip" },
      { name: "Sizes", value: "UK 5–11" },
      { name: "Care", value: "Wipe clean, keep dry" },
    ],
    reviews: [
      {
        name: "Sagar M.",
        rating: 5,
        title: "Genuine Kolhapuri feel",
        text: "Soft from the first wear and the stitching is properly done.",
      },
    ],
  },
  {
    categorySlug: "footwear",
    name: "Everyday Flip-Flops",
    slug: "everyday-flip-flops",
    brand: "Stride",
    description:
      "Lightweight everyday flip-flops with a soft EVA footbed that cushions each step. The textured sole keeps its grip on wet surfaces, making them an easy pair for the beach, the shower, or a quick trip to the market.",
    price: 399,
    compareAtPrice: 599,
    stock: 80,
    rating: 4.3,
    images: [
      "/images/catalog/footwear/everyday-flip-flops-1.jpg",
      "/images/catalog/footwear/everyday-flip-flops-2.jpg",
      "/images/catalog/footwear/everyday-flip-flops-3.jpg",
    ],
    imageNote:
      "Reference footwear photos; available colours may vary.",
    highlights: [
      "Soft EVA footbed",
      "Textured anti-slip sole",
      "Quick-drying and lightweight",
    ],
    specifications: [
      { name: "Material", value: "EVA foam" },
      { name: "Sole", value: "Textured rubber grip" },
      { name: "Sizes", value: "UK 4–11" },
      { name: "Care", value: "Rinse and air dry" },
    ],
    reviews: [
      {
        name: "Kiran P.",
        rating: 4,
        title: "Great for daily use",
        text: "Comfortable and light. I keep a pair by the door.",
      },
    ],
  },
  {
    categorySlug: "footwear",
    name: "Ladies' Summer Sandals",
    slug: "ladies-summer-sandals",
    brand: "Stride",
    description:
      "Easy-going summer sandals with adjustable straps and a low, supportive footbed. They pair well with dresses and jeans alike, and the cushioned sole stays comfortable through errands, lunches, and long walks.",
    price: 899,
    compareAtPrice: 1199,
    stock: 45,
    rating: 4.5,
    images: [
      "/images/catalog/footwear/ladies-summer-sandals-1.jpg",
      "/images/catalog/footwear/ladies-summer-sandals-2.jpg",
      "/images/catalog/footwear/ladies-summer-sandals-3.jpg",
    ],
    imageNote:
      "Reference footwear photos; exact colour and strap style may vary.",
    highlights: [
      "Adjustable buckle straps",
      "Cushioned low footbed",
      "Flexible non-slip outsole",
    ],
    specifications: [
      { name: "Upper", value: "Synthetic leather" },
      { name: "Sole", value: "TPR with grip pattern" },
      { name: "Sizes", value: "UK 3–8" },
      { name: "Heel", value: "2 cm" },
    ],
    reviews: [
      {
        name: "Shruti V.",
        rating: 5,
        title: "Comfortable all day",
        text: "No rubbing on the first wear and they look lovely with dresses.",
      },
    ],
  },
  {
    categorySlug: "footwear",
    name: "Block Heel Sandals",
    slug: "block-heel-sandals",
    brand: "Stride",
    description:
      "A pair of block heel sandals that adds height without the wobble. The wide heel spreads weight evenly, while the ankle strap and padded footbed keep them secure through weddings, dinners, and long evenings out.",
    price: 1899,
    compareAtPrice: 2399,
    stock: 22,
    rating: 4.6,
    images: [
      "/images/catalog/footwear/block-heel-sandals-1.jpg",
      "/images/catalog/footwear/block-heel-sandals-2.jpg",
      "/images/catalog/footwear/block-heel-sandals-3.jpg",
    ],
    imageNote:
      "Reference footwear photos; exact shade and heel height may vary.",
    highlights: [
      "Stable block heel",
      "Padded footbed",
      "Adjustable ankle strap",
    ],
    specifications: [
      { name: "Upper", value: "Patent synthetic" },
      { name: "Heel", value: "7 cm block" },
      { name: "Sizes", value: "UK 3–8" },
      { name: "Sole", value: "Non-slip rubber" },
    ],
    reviews: [
      {
        name: "Nikita B.",
        rating: 5,
        title: "Surprisingly easy to walk in",
        text: "Wore them to a wedding and my feet were fine at the end of the night.",
      },
    ],
  },

  // ------------------------------------------------------------------ Clothing
  {
    categorySlug: "clothing",
    name: "Kanjivaram Silk Saree",
    slug: "kanjivaram-silk-saree",
    brand: "Drape & Co.",
    description:
      "A rich Kanjivaram-style silk saree with a contrast border and traditional zari detailing. The fabric has a soft sheen and a satisfying weight that drapes beautifully, making it a considered choice for weddings, festivals, and family occasions.",
    price: 4999,
    compareAtPrice: 6499,
    stock: 14,
    rating: 4.9,
    images: [
      "/images/catalog/clothing/kanjivaram-silk-saree-1.jpg",
      "/images/catalog/clothing/kanjivaram-silk-saree-2.jpg",
      "/images/catalog/clothing/kanjivaram-silk-saree-3.jpg",
    ],
    imageNote:
      "Reference saree photos; exact colour, border, and weave may vary.",
    highlights: [
      "Silk blend with zari border",
      "Traditional contrast pallu",
      "Includes unstitched blouse piece",
    ],
    specifications: [
      { name: "Fabric", value: "Silk blend" },
      { name: "Length", value: "5.5 m saree" },
      { name: "Blouse", value: "0.8 m unstitched" },
      { name: "Care", value: "Dry clean only" },
    ],
    reviews: [
      {
        name: "Lakshmi R.",
        rating: 5,
        title: "Beautiful drape",
        text: "The border looks rich in person and the colour is exactly as shown.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Soft Cotton Saree",
    slug: "soft-cotton-saree",
    brand: "Drape & Co.",
    description:
      "An everyday cotton saree that feels light, breathable, and easy to drape. The fine weave keeps it comfortable through warm days, and the understated border makes it suitable for work, casual outings, and quiet celebrations.",
    price: 1299,
    compareAtPrice: 1699,
    stock: 38,
    rating: 4.6,
    images: [
      "/images/catalog/clothing/soft-cotton-saree-1.jpg",
      "/images/catalog/clothing/soft-cotton-saree-2.jpg",
      "/images/catalog/clothing/soft-cotton-saree-3.jpg",
    ],
    imageNote:
      "Reference saree photos; exact colour and border may vary.",
    highlights: [
      "Breathable cotton weave",
      "Lightweight and easy to drape",
      "Includes matching blouse piece",
    ],
    specifications: [
      { name: "Fabric", value: "100% cotton" },
      { name: "Length", value: "5.5 m saree" },
      { name: "Blouse", value: "0.8 m unstitched" },
      { name: "Care", value: "Hand wash separately" },
    ],
    reviews: [
      {
        name: "Bhavana S.",
        rating: 5,
        title: "Perfect office saree",
        text: "Soft, light, and the colour has stayed after two washes.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Anarkali Kurti",
    slug: "anarkali-kurti",
    brand: "Loom & Co.",
    description:
      "A flattering Anarkali-style kurti with a fitted bodice and a gently flared hem. The soft cotton blend moves comfortably, and the simple neckline works equally well with leggings, palazzos, or a dupatta.",
    price: 1299,
    compareAtPrice: 1699,
    stock: 32,
    rating: 4.7,
    images: [
      "/images/catalog/clothing/anarkali-kurti-1.jpg",
      "/images/catalog/clothing/anarkali-kurti-2.jpg",
      "/images/catalog/clothing/anarkali-kurti-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact shade and print may vary.",
    highlights: [
      "Flared Anarkali silhouette",
      "Soft cotton blend",
      "Side pockets",
    ],
    specifications: [
      { name: "Fabric", value: "Cotton blend" },
      { name: "Length", value: "Calf length" },
      { name: "Sizes", value: "S–XXL" },
      { name: "Care", value: "Machine wash cold" },
    ],
    reviews: [
      {
        name: "Divya K.",
        rating: 5,
        title: "Beautiful flare",
        text: "Fits well and the fabric is light enough for summer functions.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Cotton Kurta Set",
    slug: "cotton-kurta-set",
    brand: "Loom & Co.",
    description:
      "A ready-to-wear cotton kurta set with a straight-cut top and matching bottoms. The breathable fabric and relaxed fit make it a comfortable everyday option, while the clean detailing keeps it smart enough for work and casual events.",
    price: 999,
    compareAtPrice: 1399,
    stock: 40,
    rating: 4.5,
    images: [
      "/images/catalog/clothing/cotton-kurta-set-1.jpg",
      "/images/catalog/clothing/cotton-kurta-set-2.jpg",
      "/images/catalog/clothing/cotton-kurta-set-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact colour and detailing may vary.",
    highlights: [
      "Two-piece kurta and bottom set",
      "Breathable cotton fabric",
      "Relaxed straight fit",
    ],
    specifications: [
      { name: "Fabric", value: "100% cotton" },
      { name: "Pieces", value: "Kurta and trousers" },
      { name: "Sizes", value: "S–XXL" },
      { name: "Care", value: "Machine wash cold" },
    ],
    reviews: [
      {
        name: "Preeti N.",
        rating: 4,
        title: "Comfortable set",
        text: "Good for daily wear. The cotton is soft and not see-through.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Slim Fit Jeans",
    slug: "slim-fit-jeans",
    brand: "Loom & Co.",
    description:
      "Classic slim fit jeans cut from stretch denim that moves with you. A mid-rise waist and tapered leg give a clean silhouette, while the deep indigo wash works with everything from plain tees to oversized shirts.",
    price: 1799,
    compareAtPrice: 2299,
    stock: 36,
    rating: 4.6,
    images: [
      "/images/catalog/clothing/slim-fit-jeans-1.jpg",
      "/images/catalog/clothing/slim-fit-jeans-2.jpg",
      "/images/catalog/clothing/slim-fit-jeans-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact wash may vary between batches.",
    highlights: [
      "Stretch cotton denim",
      "Mid-rise, tapered leg",
      "Five-pocket styling",
    ],
    specifications: [
      { name: "Fabric", value: "98% cotton, 2% elastane" },
      { name: "Fit", value: "Slim, mid-rise" },
      { name: "Sizes", value: "28–40 waist" },
      { name: "Care", value: "Wash inside out, cold" },
    ],
    reviews: [
      {
        name: "Manav G.",
        rating: 5,
        title: "Perfect everyday pair",
        text: "Just enough stretch and the length was right without alterations.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Ripped Skinny Jeans",
    slug: "ripped-skinny-jeans",
    brand: "Loom & Co.",
    description:
      "Skinny jeans with subtle distressing for a relaxed, worn-in look. The high-stretch denim hugs the leg without feeling restrictive, and the faded blue wash pairs easily with sneakers, boots, and oversized tops.",
    price: 1499,
    compareAtPrice: 1999,
    stock: 28,
    rating: 4.4,
    images: [
      "/images/catalog/clothing/ripped-skinny-jeans-1.jpg",
      "/images/catalog/clothing/ripped-skinny-jeans-2.jpg",
      "/images/catalog/clothing/ripped-skinny-jeans-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact distressing and wash may vary.",
    highlights: [
      "High-stretch skinny fit",
      "Hand-finished distressing",
      "High-rise waist",
    ],
    specifications: [
      { name: "Fabric", value: "92% cotton, 6% polyester, 2% elastane" },
      { name: "Fit", value: "Skinny, high-rise" },
      { name: "Sizes", value: "26–36 waist" },
      { name: "Care", value: "Wash inside out, cold" },
    ],
    reviews: [
      {
        name: "Tanya M.",
        rating: 4,
        title: "Good stretch",
        text: "Comfortable and the rips are placed nicely, not too much.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Embroidered Dupatta",
    slug: "embroidered-dupatta",
    brand: "Drape & Co.",
    description:
      "A lightweight dupatta with fine embroidery that finishes off a kurta or saree without adding bulk. The soft cotton blend drapes neatly over the shoulder, and the delicate border gives it a polished, occasion-ready look.",
    price: 699,
    compareAtPrice: 949,
    stock: 50,
    rating: 4.5,
    images: [
      "/images/catalog/clothing/embroidered-dupatta-1.jpg",
      "/images/catalog/clothing/embroidered-dupatta-2.jpg",
      "/images/catalog/clothing/embroidered-dupatta-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact embroidery pattern may vary.",
    highlights: [
      "Fine thread embroidery",
      "Soft, lightweight cotton blend",
      "Finished border on all sides",
    ],
    specifications: [
      { name: "Fabric", value: "Cotton blend" },
      { name: "Size", value: "2.25 m × 0.9 m" },
      { name: "Finish", value: "Embroidered border" },
      { name: "Care", value: "Hand wash separately" },
    ],
    reviews: [
      {
        name: "Aarti J.",
        rating: 5,
        title: "Lovely detail",
        text: "The embroidery is neat and it made a plain kurta look festive.",
      },
    ],
  },
  {
    categorySlug: "clothing",
    name: "Denim Shorts",
    slug: "denim-shorts",
    brand: "Loom & Co.",
    description:
      "Everyday denim shorts with a comfortable mid-rise waist and a relaxed cut that hits mid-thigh. The sturdy cotton denim holds its shape through summer wear, and the classic five-pocket styling keeps them easy to pair with tees and shirts.",
    price: 1099,
    compareAtPrice: 1499,
    stock: 42,
    rating: 4.4,
    images: [
      "/images/catalog/clothing/denim-shorts-1.jpg",
      "/images/catalog/clothing/denim-shorts-2.jpg",
      "/images/catalog/clothing/denim-shorts-3.jpg",
    ],
    imageNote:
      "Reference clothing photos; exact wash and length may vary.",
    highlights: [
      "Mid-rise relaxed fit",
      "Sturdy cotton denim",
      "Classic five-pocket styling",
    ],
    specifications: [
      { name: "Fabric", value: "100% cotton denim" },
      { name: "Inseam", value: "12 cm" },
      { name: "Sizes", value: "26–36 waist" },
      { name: "Care", value: "Machine wash cold" },
    ],
    reviews: [
      {
        name: "Rhea D.",
        rating: 4,
        title: "Summer staple",
        text: "Good length and the denim feels substantial, not flimsy.",
      },
    ],
  },
];

module.exports = { catalogCategories, catalogProducts };
