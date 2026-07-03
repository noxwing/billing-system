const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const env = require('../config/env');
const logger = require('../utils/logger');

// GET /auth/login
function showLoginPage(req, res) {
  if (req.user) {
    return res.redirect(req.user.role === 'admin' ? '/admin/dashboard' : '/pos');
  }

  const errors = (req.session && req.session.validationErrors) || [];
  const oldInput = (req.session && req.session.oldInput) || {};

  if (req.session) {
    delete req.session.validationErrors;
    delete req.session.oldInput;
  }

  return res.render('auth/login', {
    title: 'Login',
    layout: false,
    errors,
    oldInput,
    loginError: req.query.error || null
  });
}

// POST /auth/login
async function login(req, res) {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }

    if (!user.isActive) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Your account has been deactivated. Contact admin.'));
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.redirect('/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }

    const token = signToken({ id: user._id, role: user.role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      maxAge: env.cookieMaxAge
    });

    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${user.username} (${user.role})`);

    return res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/pos');
  } catch (err) {
    logger.error('Login error:', err.message);
    return res.redirect('/auth/login?error=' + encodeURIComponent('An error occurred. Please try again.'));
  }
}

// POST /auth/logout
function logout(req, res) {
  res.clearCookie('token');
  return res.redirect('/auth/login');
}

// GET /auth/change-password
function showChangePasswordPage(req, res) {
  const errors = (req.session && req.session.validationErrors) || [];
  if (req.session) delete req.session.validationErrors;

  return res.render('auth/change-password', {
    title: 'Change Password',
    errors
  });
}

// POST /auth/change-password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      req.session.validationErrors = [{ field: 'currentPassword', message: 'Current password is incorrect' }];
      return res.redirect('/auth/change-password');
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    res.clearCookie('token');
    return res.redirect('/auth/login?error=' + encodeURIComponent('Password changed. Please log in again.'));
  } catch (err) {
    logger.error('Change password error:', err.message);
    return res.redirect('/auth/change-password');
  }
}

module.exports = {
  showLoginPage,
  login,
  logout,
  showChangePasswordPage,
  changePassword
};
