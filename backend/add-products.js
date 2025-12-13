/**
 * Bulk Product Import Script
 * 
 * Usage:
 *   node add-products.js          - Add products from array below
 *   node add-products.js list     - List all products in database
 *   node add-products.js clear    - Delete ALL products (use with caution!)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

// ============ ADD YOUR PRODUCTS HERE ============
const products = [
  { product_id: "001", name: "Anjal Medium / Seer Fish Medium", price_per_kg: 1090 },
  { product_id: "002", name: "Adava / Suddum", price_per_kg: 590 },
  { product_id: "003", name: "Bat Fish / Madal Fish", price_per_kg: 590 },
  { product_id: "004", name: "B Bhetki / Sea Bass", price_per_kg: 649 },
  { product_id: "005", name: "Black Pomfret", price_per_kg: 1150 },
  { product_id: "007", name: "Butter Fish", price_per_kg: 550 },
  { product_id: "009", name: "Anjal Small / Seer Small", price_per_kg: 799 },
  { product_id: "010", name: "Blue Crab", price_per_kg: 990 },
  { product_id: "011", name: "Anjal Slice / Seer Slice", price_per_kg: 1450 },
  { product_id: "012", name: "Crab Small", price_per_kg: 650 },
  { product_id: "013", name: "Karimeen", price_per_kg: 550 },
  { product_id: "014", name: "King Fish / Modha", price_per_kg: 990 },
  { product_id: "015", name: "King Fish Slice / Modha", price_per_kg: 1190 },
  { product_id: "016", name: "Koddai / Kalluru", price_per_kg: 590 },
  { product_id: "017", name: "Horse Mackerel", price_per_kg: 550 },
  { product_id: "018", name: "Lady Fish / Kane", price_per_kg: 950 },
  { product_id: "020", name: "Mackerel / Bangada", price_per_kg: 299 },
  { product_id: "022", name: "Madava / Mullet", price_per_kg: 550 },
  { product_id: "023", name: "Marwai / Shell", price_per_kg: 150 },
  { product_id: "025", name: "Muru Meen / Hamour", price_per_kg: 550 },
  { product_id: "026", name: "Netholi / Anchovi", price_per_kg: 590 },
  { product_id: "027", name: "Para / Travalli", price_per_kg: 750 },
  { product_id: "028", name: "Paiya / Palachi", price_per_kg: 550 },
  { product_id: "029", name: "Pink Perch / Shankara", price_per_kg: 650 },
  { product_id: "030", name: "Prawns", price_per_kg: 450 },
  { product_id: "031", name: "Sea Prawns", price_per_kg: 890 },
  { product_id: "032", name: "Tiger Prawns", price_per_kg: 750 },
  { product_id: "033", name: "Red Snapper", price_per_kg: 790 },
  { product_id: "034", name: "Sardine / Mathy", price_per_kg: 370 },
  { product_id: "036", name: "Indian Salmon / Rawas", price_per_kg: 1090 },
  { product_id: "037", name: "Indian Salmon Slice / Rawas Slice", price_per_kg: 1290 },
  { product_id: "039", name: "Shark / Sora", price_per_kg: 790 },
  { product_id: "041", name: "Sheela", price_per_kg: 750 },
  { product_id: "042", name: "Sheela Slice", price_per_kg: 1100 },
  { product_id: "043", name: "Silver Fish", price_per_kg: 390 },
  { product_id: "044", name: "Mandal / Sole Fish", price_per_kg: 550 },
  { product_id: "045", name: "Squid", price_per_kg: 550 },
  { product_id: "048", name: "Tuna", price_per_kg: 430 },
  { product_id: "049", name: "Tuna Slice", price_per_kg: 790 },
  { product_id: "050", name: "White Pomfret Medium", price_per_kg: 999 },
  { product_id: "051", name: "White Pomfret Small", price_per_kg: 999 },
  { product_id: "052", name: "White Snapper", price_per_kg: 790 },
  { product_id: "053", name: "B Aar Mach", price_per_kg: 400 },
  { product_id: "054", name: "Bele Mach", price_per_kg: 450 },
  { product_id: "055", name: "Catla", price_per_kg: 250 },
  { product_id: "056", name: "Rohu", price_per_kg: 190 },
  { product_id: "057", name: "Maral Fish / Kora", price_per_kg: 790 },
  { product_id: "058", name: "B Tengra Mach", price_per_kg: 550 },
  { product_id: "059", name: "Tilapia / Jeelabi", price_per_kg: 150 },
  { product_id: "060", name: "Roopchand", price_per_kg: 200 },
  { product_id: "061", name: "B Pabda", price_per_kg: 590 },
  { product_id: "062", name: "B Bata", price_per_kg: 490 },
  { product_id: "063", name: "B Desi Tengra", price_per_kg: 490 },
  { product_id: "064", name: "B Lotta / Bombay Duck", price_per_kg: 490 },
  { product_id: "065", name: "B Buval / Boal", price_per_kg: 530 },
  { product_id: "066", name: "B Chona / Kachki", price_per_kg: 750 },
  { product_id: "067", name: "B Charapuna", price_per_kg: 450 },
  { product_id: "068", name: "B Muralla", price_per_kg: 350 },
  { product_id: "069", name: "B Live Koi Mach", price_per_kg: 990 },
  { product_id: "070", name: "B Live Singhi & Magur Mach", price_per_kg: 990 },
  { product_id: "071", name: "B Kucho Chingri / Small Shrimps", price_per_kg: 390 },
  { product_id: "072", name: "B Parshe", price_per_kg: 490 },
  { product_id: "073", name: "Skinless Chicken", price_per_kg: 289 },
  { product_id: "074", name: "Chicken With Skin", price_per_kg: 270 },
  { product_id: "075", name: "Boneless Chicken", price_per_kg: 400 },
  { product_id: "076", name: "Chicken Mince / Kheema", price_per_kg: 450 },
  { product_id: "077", name: "Drumstick", price_per_kg: 370 },
  { product_id: "078", name: "Whole Leg", price_per_kg: 370 },
  { product_id: "079", name: "Chicken Lollipop", price_per_kg: 390 },
  { product_id: "080", name: "Chicken Wings", price_per_kg: 320 },
  { product_id: "081", name: "Chicken Soup Bone", price_per_kg: 110 },
  { product_id: "082", name: "Chicken Liver", price_per_kg: 170 },
  { product_id: "083", name: "Chicken Gizzard", price_per_kg: 200 },
  { product_id: "085", name: "Goat Curry Cut", price_per_kg: 799 },
  { product_id: "086", name: "Goat Back Leg / Ran", price_per_kg: 949 },
  { product_id: "091", name: "Goat Liver", price_per_kg: 720 },
  { product_id: "094", name: "Paya / Smoked Leg", price_per_kg: 80 },
  { product_id: "100", name: "B Hilsha", price_per_kg: 1699 },
  { product_id: "101", name: "B Topshey", price_per_kg: 770 },
  { product_id: "103", name: "B Golda / Scampi", price_per_kg: 790 },
  { product_id: "104", name: "Bomb Fish", price_per_kg: 530 },
  { product_id: "105", name: "B Putti Big", price_per_kg: 490 },
  { product_id: "106", name: "Bengali Lemon", price_per_kg: 20 },
  { product_id: "110", name: "Amudhi", price_per_kg: 490 },
  { product_id: "112", name: "Atlantic Salmon", price_per_kg: 2700 },
  { product_id: "115", name: "Basa / Pangus", price_per_kg: 150 },
  { product_id: "117", name: "B Catla Slice", price_per_kg: 650 },
  { product_id: "118", name: "B Rohu Slice", price_per_kg: 590 },
  { product_id: "119", name: "B Catla Big", price_per_kg: 480 },
  { product_id: "120", name: "B Rohu Big", price_per_kg: 450 },
  { product_id: "121", name: "Nati Eggs", price_per_kg: 750 },
  { product_id: "122", name: "B Kajuli", price_per_kg: 1250 },
  { product_id: "126", name: "Disco", price_per_kg: 490 },
  { product_id: "130", name: "B Putti Small", price_per_kg: 390 },
  { product_id: "132", name: "Big Lady Fish / Big Kane", price_per_kg: 990 }
];

// ================================================

async function addProducts() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in .env');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Check if product already exists
        const existing = await Product.findOne({ product_id: product.product_id });
        
        if (existing) {
          console.log(`⏭️  Skipped: ${product.name} (ID: ${product.product_id}) - already exists`);
          skipped++;
          continue;
        }

        // Create new product
        await Product.create({
          product_id: product.product_id,
          name: product.name,
          price_per_kg: product.price_per_kg,
          is_active: true
        });

        console.log(`✅ Added: ${product.name} (ID: ${product.product_id}) - ₹${product.price_per_kg}/kg`);
        added++;
      } catch (err) {
        console.error(`❌ Error adding ${product.name}: ${err.message}`);
        errors++;
      }
    }

    console.log('\n========== SUMMARY ==========');
    console.log(`✅ Added: ${added}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total in DB: ${await Product.countDocuments()}`);
    console.log('==============================\n');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Handle command line arguments
const command = process.argv[2];

async function listProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const allProducts = await Product.find().sort({ product_id: 1 });
    console.log(`\n📦 Products in database (${allProducts.length}):\n`);
    allProducts.forEach(p => {
      console.log(`  ID: ${p.product_id.padEnd(6)} | ${p.name.padEnd(25)} | ₹${p.price_per_kg}/kg`);
    });
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

async function clearProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await Product.countDocuments();
    await Product.deleteMany({});
    console.log(`🗑️  Deleted ${count} products`);
  } finally {
    await mongoose.disconnect();
  }
}

if (command === 'list') {
  listProducts();
} else if (command === 'clear') {
  clearProducts();
} else {
  addProducts();
}
