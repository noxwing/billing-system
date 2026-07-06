const dns = require("node:dns");

dns.setServers([
  "1.1.1.1",
  "8.8.8.8"
]);

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const StoreSettings = require('../models/StoreSettings');
const Category = require('../models/Category');
const Product = require('../models/Product');
const env = require('../config/env');

// Infers a sensible sale unit from the trailing "(...)" hint in the catalog
// name, e.g. "Tomato (1 kg)" -> kg, "Banana (1 dozen)" -> dozen. Anything
// else (sealed packs/bottles/bunches) defaults to 'pcs' since it's bought
// as a whole unit, not divided up at the counter.
function inferUnit(name) {
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (!match) return 'pcs';
  const hint = match[1].toLowerCase();
  if (/\bkg\b/.test(hint)) return 'kg';
  if (/\bdozen\b/.test(hint)) return 'dozen';
  return 'pcs';
}

// ---------------------------------------------------------------------------
// Category -> Products catalog
// Each product tuple: [name, purchasePrice, sellingPrice]
// Prices are in INR and are approximate "relatable" retail figures for a
// mini supermarket. Feel free to tune them after seeding.
// ---------------------------------------------------------------------------
const CATALOG = {
  'Vegetables': [
    ['Tomato (1 kg)', 18, 28],
    ['Onion (1 kg)', 20, 30],
    ['Potato (1 kg)', 15, 24],
    ['Carrot (1 kg)', 22, 34],
    ['Cabbage (1 pc)', 15, 22],
    ['Cauliflower (1 pc)', 18, 28],
    ['Brinjal (1 kg)', 20, 30],
    ['Ladies Finger / Okra (1 kg)', 24, 36],
    ['French Beans (1 kg)', 30, 45],
    ['Green Peas (1 kg)', 40, 60],
    ['Cucumber (1 kg)', 16, 25],
    ['Beetroot (1 kg)', 22, 34],
    ['Radish (1 kg)', 15, 24],
    ['Spinach (1 bunch)', 10, 16],
    ['Coriander Leaves (1 bunch)', 8, 14],
    ['Mint Leaves (1 bunch)', 6, 12],
    ['Curry Leaves (100 g)', 5, 10],
    ['Green Chilli (250 g)', 10, 18],
    ['Capsicum (1 kg)', 30, 45],
    ['Garlic (250 g)', 25, 38],
    ['Ginger (250 g)', 20, 32],
    ['Drumstick (1 kg)', 35, 52],
    ['Bottle Gourd (1 pc)', 18, 28],
    ['Bitter Gourd (1 kg)', 25, 38],
    ['Ridge Gourd (1 kg)', 22, 34],
    ['Pumpkin (1 kg)', 16, 25],
    ['Sweet Potato (1 kg)', 24, 36],
    ['Yam (1 kg)', 26, 40],
    ['Raw Banana (1 kg)', 18, 28],
    ['Sweet Corn (2 pcs)', 20, 32]
  ],
  'Fruits': [
    ['Banana (1 dozen)', 30, 48],
    ['Apple (1 kg)', 110, 150],
    ['Orange (1 kg)', 60, 90],
    ['Mango (1 kg)', 70, 110],
    ['Grapes (1 kg)', 60, 95],
    ['Watermelon (1 pc)', 40, 65],
    ['Papaya (1 pc)', 30, 48],
    ['Pineapple (1 pc)', 40, 62],
    ['Pomegranate (1 kg)', 120, 170],
    ['Guava (1 kg)', 40, 62],
    ['Sapota / Chikoo (1 kg)', 45, 68],
    ['Muskmelon (1 pc)', 35, 55],
    ['Pear (1 kg)', 90, 130],
    ['Plum (1 kg)', 100, 145],
    ['Strawberry (200 g box)', 45, 70],
    ['Lychee (1 kg)', 130, 180],
    ['Custard Apple (1 kg)', 90, 130],
    ['Jackfruit (1 kg)', 40, 62],
    ['Coconut (1 pc)', 25, 38],
    ['Sweet Lime / Mosambi (1 kg)', 45, 68],
    ['Dragon Fruit (1 pc)', 60, 90],
    ['Dates (500 g)', 90, 130],
    ['Fig (250 g)', 55, 82],
    ['Avocado (1 pc)', 45, 70]
  ],
  'Groceries': [
    ['Toor Dal (1 kg)', 120, 150],
    ['Moong Dal (1 kg)', 110, 138],
    ['Chana Dal (1 kg)', 90, 115],
    ['Urad Dal (1 kg)', 130, 160],
    ['Masoor Dal (1 kg)', 95, 120],
    ['Rajma / Kidney Beans (1 kg)', 130, 165],
    ['Chickpeas / Kabuli Chana (1 kg)', 95, 120],
    ['Black Chickpeas (1 kg)', 90, 115],
    ['Green Gram Whole (1 kg)', 105, 132],
    ['Soybean Chunks (500 g)', 55, 75],
    ['Peanuts (500 g)', 55, 75],
    ['Cashew Nuts (250 g)', 210, 280],
    ['Almonds (250 g)', 190, 250],
    ['Raisins (250 g)', 65, 90],
    ['Salt (1 kg)', 18, 25],
    ['Sugar (1 kg)', 42, 52],
    ['Jaggery (1 kg)', 55, 72],
    ['Sunflower Cooking Oil (1 L)', 130, 158],
    ['Groundnut Cooking Oil (1 L)', 175, 210],
    ['Ghee (500 ml)', 260, 320],
    ['Vinegar (500 ml)', 30, 45]
  ],
  'Grains & Cereals': [
    ['Basmati Rice (1 kg)', 90, 120],
    ['Ponni Rice (1 kg)', 45, 58],
    ['Wheat Flour / Atta (1 kg)', 38, 48],
    ['Maida / Refined Flour (1 kg)', 34, 44],
    ['Rava / Semolina (1 kg)', 40, 52],
    ['Oats (1 kg)', 95, 125],
    ['Poha / Flattened Rice (500 g)', 32, 44],
    ['Ragi Flour (1 kg)', 55, 72],
    ['Bajra (1 kg)', 48, 62],
    ['Jowar (1 kg)', 50, 65],
    ['Idli Rava (1 kg)', 42, 55],
    ['Broken Wheat / Dalia (1 kg)', 40, 52],
    ['Muesli (500 g)', 140, 185],
    ['Corn Flakes (500 g)', 95, 130],
    ['Vermicelli (500 g)', 32, 44]
  ],
  'Beverages': [
    ['Tea Powder (500 g)', 150, 195],
    ['Coffee Powder (200 g)', 110, 145],
    ['Instant Coffee (100 g)', 190, 240],
    ['Green Tea (25 bags)', 100, 135],
    ['Soft Drink Cola (750 ml)', 32, 45],
    ['Lemon Soda (750 ml)', 32, 45],
    ['Orange Juice (1 L)', 90, 120],
    ['Apple Juice (1 L)', 95, 125],
    ['Mango Juice (1 L)', 85, 112],
    ['Mixed Fruit Juice (1 L)', 90, 118],
    ['Energy Drink (250 ml)', 85, 110],
    ['Mineral Water (1 L)', 15, 22],
    ['Soda Water (750 ml)', 20, 30],
    ['Buttermilk (200 ml)', 10, 15],
    ['Lassi (200 ml)', 18, 26],
    ['Coconut Water (200 ml)', 22, 32],
    ['Health Drink / Malt Beverage (500 g)', 180, 230],
    ['Iced Tea Powder Mix (400 g)', 120, 155],
    ['Tender Coconut (1 pc)', 30, 45]
  ],
  'Dairy': [
    ['Full Cream Milk (500 ml)', 27, 32],
    ['Toned Milk (500 ml)', 22, 27],
    ['Curd (400 g)', 25, 34],
    ['Paneer (200 g)', 65, 85],
    ['Butter (100 g)', 48, 60],
    ['Cheese Slices (10 pcs)', 90, 120],
    ['Cheese Block (200 g)', 110, 145],
    ['Dairy Ghee (500 ml)', 260, 320],
    ['Fresh Cream (200 ml)', 55, 72],
    ['Flavoured Yogurt (100 g)', 20, 28],
    ['Buttermilk Packet (500 ml)', 20, 28],
    ['Condensed Milk (400 g)', 90, 118],
    ['Milk Powder (500 g)', 190, 240],
    ['Ice Cream Tub (1 L)', 140, 185]
  ],
  'Bakery': [
    ['White Bread (400 g)', 30, 40],
    ['Brown Bread (400 g)', 35, 46],
    ['Multigrain Bread (400 g)', 42, 55],
    ['Bun (pack of 6)', 25, 35],
    ['Rusk (200 g)', 30, 42],
    ['Cake (400 g)', 120, 160],
    ['Pastry (1 pc)', 35, 50],
    ['Cookies (200 g)', 45, 62],
    ['Cream Biscuits (200 g)', 22, 32],
    ['Marie Biscuits (250 g)', 24, 34],
    ['Muffin (1 pc)', 30, 45],
    ['Croissant (1 pc)', 40, 58],
    ['Pav (pack of 6)', 22, 32]
  ],
  'Snacks': [
    ['Potato Chips (55 g)', 15, 20],
    ['Banana Chips (200 g)', 45, 62],
    ['Namkeen Mixture (200 g)', 40, 55],
    ['Murukku (200 g)', 42, 58],
    ['Sev (200 g)', 35, 48],
    ['Popcorn (70 g)', 20, 28],
    ['Masala Peanuts (150 g)', 30, 42],
    ['Nachos (150 g)', 55, 75],
    ['Kurkure (55 g)', 15, 20],
    ['Extruded Rings Snack (60 g)', 15, 20],
    ['Roasted Chana (200 g)', 25, 36],
    ['Chocolate Bar (1 pc)', 20, 28],
    ['Candy (1 pc)', 1, 2],
    ['Chewing Gum (1 pack)', 5, 8],
    ['Wafers (150 g)', 45, 62]
  ],
  'Personal Care': [
    ['Toothpaste (150 g)', 65, 85],
    ['Toothbrush (1 pc)', 20, 30],
    ['Bath Soap (100 g)', 30, 42],
    ['Shampoo (180 ml)', 110, 145],
    ['Conditioner (180 ml)', 115, 150],
    ['Hair Oil (200 ml)', 90, 120],
    ['Face Wash (100 g)', 95, 125],
    ['Body Lotion (200 ml)', 130, 170],
    ['Deodorant (150 ml)', 150, 195],
    ['Talcum Powder (200 g)', 85, 110],
    ['Razor (1 pc)', 40, 55],
    ['Shaving Cream (70 g)', 55, 72],
    ['Sanitary Pads (pack of 10)', 55, 75],
    ['Hand Wash (200 ml)', 65, 85],
    ['Lip Balm (1 pc)', 45, 62],
    ['Cotton Buds (100 pcs)', 35, 48],
    ['Comb (1 pc)', 15, 24],
    ['Nail Cutter (1 pc)', 25, 36]
  ],
  'Cleaning': [
    ['Detergent Powder (1 kg)', 90, 118],
    ['Detergent Liquid (1 L)', 140, 178],
    ['Dishwash Bar (200 g)', 18, 25],
    ['Dishwash Liquid (500 ml)', 75, 98],
    ['Floor Cleaner (1 L)', 95, 125],
    ['Toilet Cleaner (500 ml)', 75, 98],
    ['Glass Cleaner (500 ml)', 80, 105],
    ['Phenyl (1 L)', 55, 75],
    ['Bleach (500 ml)', 45, 62],
    ['Broom (1 pc)', 60, 82],
    ['Mop (1 pc)', 120, 160],
    ['Scrub Pad (pack of 3)', 20, 30],
    ['Garbage Bags (30 pcs)', 65, 88],
    ['Air Freshener (250 ml)', 110, 145],
    ['Naphthalene Balls (200 g)', 30, 42]
  ],
  'Spices & Condiments': [
    ['Turmeric Powder (200 g)', 35, 48],
    ['Red Chilli Powder (200 g)', 45, 62],
    ['Coriander Powder (200 g)', 35, 48],
    ['Cumin Seeds (100 g)', 45, 62],
    ['Mustard Seeds (100 g)', 20, 30],
    ['Garam Masala (100 g)', 55, 75],
    ['Black Pepper (100 g)', 90, 120],
    ['Cardamom (50 g)', 120, 160],
    ['Cloves (50 g)', 60, 82],
    ['Cinnamon (50 g)', 45, 62],
    ['Bay Leaf (50 g)', 25, 36],
    ['Fennel Seeds (100 g)', 30, 42],
    ['Fenugreek Seeds (100 g)', 22, 32],
    ['Asafoetida / Hing (50 g)', 65, 88],
    ['Tamarind (200 g)', 30, 42],
    ['Tomato Ketchup (500 g)', 75, 98],
    ['Soy Sauce (200 ml)', 55, 75],
    ['Chilli Sauce (200 ml)', 55, 75],
    ['Mayonnaise (250 g)', 85, 112],
    ['Mixed Pickle (400 g)', 65, 88]
  ],
  'Frozen Foods': [
    ['Frozen Green Peas (500 g)', 55, 75],
    ['Frozen Sweet Corn (500 g)', 60, 82],
    ['Frozen Paratha (5 pcs)', 70, 95],
    ['Frozen Samosa (10 pcs)', 90, 120],
    ['Frozen French Fries (500 g)', 85, 112],
    ['Frozen Chicken Nuggets (500 g)', 150, 195],
    ['Frozen Mixed Vegetables (500 g)', 65, 88],
    ['Ice Cream Tub - Frozen (700 ml)', 130, 170],
    ['Frozen Veg Momos (10 pcs)', 90, 120]
  ],
  'Meat, Poultry & Eggs': [
    ['Chicken Whole (1 kg)', 160, 200],
    ['Chicken Breast (500 g)', 130, 165],
    ['Mutton (1 kg)', 550, 650],
    ['Seer Fish (1 kg)', 450, 550],
    ['Sardine Fish (1 kg)', 160, 200],
    ['Prawns (500 g)', 260, 320],
    ['Eggs (Tray of 6)', 36, 48],
    ['Eggs (Tray of 12)', 70, 92],
    ['Eggs (Tray of 30)', 165, 210]
  ],
  'Baby Care': [
    ['Baby Diapers (pack of 20)', 320, 400],
    ['Baby Wipes (80 pcs)', 110, 145],
    ['Baby Food Cereal (300 g)', 190, 240],
    ['Baby Powder (200 g)', 130, 170],
    ['Baby Oil (200 ml)', 140, 180],
    ['Baby Shampoo (200 ml)', 150, 195],
    ['Feeding Bottle (1 pc)', 180, 230]
  ],
  'Household Essentials': [
    ['Matchbox (1 pc)', 1, 2],
    ['Candles (pack of 6)', 30, 45],
    ['Aluminium Foil (18 m)', 90, 120],
    ['Cling Wrap (30 m)', 75, 100],
    ['Tissue Paper (100 pulls)', 60, 82],
    ['Paper Napkins (100 pcs)', 45, 62],
    ['Disposable Plates (pack of 25)', 65, 88],
    ['Disposable Cups (pack of 25)', 55, 75],
    ['Batteries AA (pack of 4)', 60, 82],
    ['LED Bulb (9W)', 75, 100],
    ['Insect Repellent Liquid (45 ml)', 85, 112],
    ['Mosquito Coil (pack of 10)', 35, 48]
  ],
  'Stationery': [
    ['Notebook (200 pages)', 35, 48],
    ['Ball Pen (1 pc)', 8, 12],
    ['Pencil (1 pc)', 5, 8],
    ['Eraser (1 pc)', 4, 6],
    ['Sharpener (1 pc)', 5, 8],
    ['Geometry Box (1 pc)', 60, 82],
    ['A4 Paper Ream (500 sheets)', 260, 320],
    ['Stapler (1 pc)', 60, 82],
    ['Glue Stick (1 pc)', 20, 30],
    ['Marker Pen (1 pc)', 22, 32]
  ],
  'Pet Care': [
    ['Dog Food (1 kg)', 190, 240],
    ['Cat Food (1 kg)', 200, 250],
    ['Pet Shampoo (200 ml)', 150, 195],
    ['Pet Treats (200 g)', 110, 145],
    ['Bird Seed Mix (500 g)', 60, 82]
  ],
  'Health & Wellness': [
    ['Multivitamin Tablets (30 pcs)', 150, 195],
    ['Hand Sanitizer (200 ml)', 65, 88],
    ['Face Mask (pack of 5)', 30, 45],
    ['First Aid Bandages (pack)', 40, 58],
    ['Pain Relief Spray (100 ml)', 110, 145],
    ['Antiseptic Liquid (200 ml)', 65, 88],
    ['Digestive Tablets (10 pcs)', 25, 36],
    ['Protein Powder (500 g)', 650, 800]
  ]
};

// ---------------------------------------------------------------------------
// Helpers to deterministically generate unique barcode / SKU values
// ---------------------------------------------------------------------------
// Explicit, guaranteed-unique prefixes (word-initials collide, e.g.
// "Beverages" and "Bakery" both reduce to "B" — that caused the
// duplicate-SKU crash). Any category not listed here falls back to a
// slugified prefix with a uniqueness check against USED_PREFIXES.
const PREFIX_MAP = {
  'Vegetables': 'VEG',
  'Fruits': 'FRU',
  'Groceries': 'GRO',
  'Grains & Cereals': 'GRC',
  'Beverages': 'BEV',
  'Dairy': 'DAI',
  'Bakery': 'BAK',
  'Snacks': 'SNK',
  'Personal Care': 'PER',
  'Cleaning': 'CLN',
  'Spices & Condiments': 'SPC',
  'Frozen Foods': 'FRZ',
  'Meat, Poultry & Eggs': 'MPE',
  'Baby Care': 'BBY',
  'Household Essentials': 'HHE',
  'Stationery': 'STA',
  'Pet Care': 'PET',
  'Health & Wellness': 'HLW'
};

const USED_PREFIXES = new Set();

function categoryPrefix(name) {
  let base = PREFIX_MAP[name];

  if (!base) {
    base = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'GEN';
  }

  // Guard against any future collision (e.g. a new category added later
  // that happens to share a prefix) by appending a digit until unique.
  let candidate = base;
  let suffix = 1;
  while (USED_PREFIXES.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix++;
  }
  USED_PREFIXES.add(candidate);
  return candidate;
}

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  // Admin user
  const existing = await User.findOne({ username: env.defaultAdmin.username });
  if (!existing) {
    const passwordHash = await User.hashPassword(env.defaultAdmin.password);
    await User.create({
      name: 'Administrator',
      username: env.defaultAdmin.username,
      email: env.defaultAdmin.email,
      passwordHash,
      role: 'admin',
      isActive: true
    });
    console.log(`Admin created: ${env.defaultAdmin.username} / ${env.defaultAdmin.password}`);
  } else {
    console.log('Admin already exists');
  }

  // Store settings
  await StoreSettings.getSettings();
  console.log('Store settings initialised');

  // Categories
  const categoryNames = Object.keys(CATALOG);
  const categoryDocsByName = {};
  for (const name of categoryNames) {
    const doc = await Category.findOneAndUpdate(
      { name },
      { name, status: 'active' },
      { upsert: true, new: true }
    );
    categoryDocsByName[name] = doc;
  }
  console.log(`Categories created/updated: ${categoryNames.length}`);

  // Products
  let barcodeCounter = 8900000000001; // 13-digit EAN-style running counter
  let createdCount = 0;
  let skippedCount = 0;

  for (const categoryName of categoryNames) {
    const categoryDoc = categoryDocsByName[categoryName];
    const prefix = categoryPrefix(categoryName);
    const items = CATALOG[categoryName];

    for (let i = 0; i < items.length; i++) {
      const [name, purchasePrice, sellingPrice] = items[i];
      const sku = `${prefix}-${String(i + 1).padStart(3, '0')}`;
      const barcode = String(barcodeCounter++);

      const alreadyExists = await Product.findOne({
        name,
        category: categoryDoc._id
      });

      if (alreadyExists) {
        skippedCount++;
        continue;
      }

      await Product.create({
        name,
        barcode,
        sku,
        category: categoryDoc._id,
        purchasePrice,
        sellingPrice,
        taxPercent: 0,
        unit: inferUnit(name),
        stock: 0,
        unlimitedStock: true,
        lowStockThreshold: 5,
        status: 'active',
        description: ''
      });
      createdCount++;
    }
  }

  console.log(`Products created: ${createdCount}`);
  if (skippedCount) {
    console.log(`Products skipped (already existed): ${skippedCount}`);
  }

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => { console.error(err); process.exit(1); });