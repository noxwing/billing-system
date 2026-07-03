const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  try {
    mongoose.set('strictQuery', true);
    console.log(env.mongoUri);

    await mongoose.connect(env.mongoUri, {
      autoIndex: !env.isProduction // disable auto index building in production for performance
    });

    isConnected = true;
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
      isConnected = false;
    });

    return mongoose.connection;
  } catch (err) {
    console.error('[DB] MongoDB initial connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
