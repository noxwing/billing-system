const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verifies the JWT stored in the httpOnly cookie.
 * Attaches the authenticated, active user to req.user and res.locals.currentUser.
 * Redirects to login for page requests, returns 401 JSON for API requests.
 */
async function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;

    if (!token) {
      return handleUnauthenticated(req, res);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      res.clearCookie('token');
      return handleUnauthenticated(req, res);
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      res.clearCookie('token');
      return handleUnauthenticated(req, res);
    }

    req.user = user;
    res.locals.currentUser = user;
    return next();
  } catch (err) {
    logger.error('Auth middleware error:', err.message);
    return handleUnauthenticated(req, res);
  }
}

function handleUnauthenticated(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  return res.redirect('/auth/login');
}

/**
 * Optional auth - attaches user if token present/valid, never blocks the request.
 * Useful for the login page itself (redirect away if already logged in).
 */
async function attachUserIfPresent(req, res, next) {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) return next();

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
      res.locals.currentUser = user;
    }
    return next();
  } catch (err) {
    return next();
  }
}

module.exports = { authenticate, attachUserIfPresent };
