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
const env = require('../config/env');

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

  // Sample categories
  const cats = ['Beverages', 'Dairy', 'Snacks', 'Grains & Cereals', 'Personal Care', 'Cleaning'];
  for (const name of cats) {
    await Category.findOneAndUpdate({ name }, { name, status: 'active' }, { upsert: true });
  }
  console.log('Sample categories created');

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => { console.error(err); process.exit(1); });
