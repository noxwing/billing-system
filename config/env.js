require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  sessionSecret: process.env.SESSION_SECRET,
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 8 * 60 * 60 * 1000,
  isProduction: process.env.NODE_ENV === 'production',
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@12345',
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
  }
};
