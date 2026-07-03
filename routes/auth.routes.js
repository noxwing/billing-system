const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate, attachUserIfPresent } = require('../middleware/auth.middleware');
const { loginValidator, changePasswordValidator } = require('../validators/auth.validator');
const validate = require('../middleware/validate.middleware');
const { loginLimiter } = require('../middleware/rateLimiter.middleware');

router.get('/login', attachUserIfPresent, authController.showLoginPage);
router.post('/login', loginLimiter, loginValidator, validate, authController.login);
router.post('/logout', authenticate, authController.logout);

router.get('/change-password', authenticate, authController.showChangePasswordPage);
router.post(
  '/change-password',
  authenticate,
  changePasswordValidator,
  validate,
  authController.changePassword
);

module.exports = router;
