const rateLimit = require('express-rate-limit');

// General API/page rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Strict limiter for login attempts to prevent brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: true
});

// Billing endpoint limiter (generous, since POS may submit many bills quickly)
const billingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many billing requests, please slow down.' }
});

module.exports = { generalLimiter, loginLimiter, billingLimiter };
