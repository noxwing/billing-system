const { body } = require('express-validator');
const User = require('../models/User');

const createStaffValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('username')
    .trim()
    .toLowerCase()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 40 }).withMessage('Username must be 3-40 characters')
    .matches(/^[a-z0-9._]+$/).withMessage('Username can only contain lowercase letters, numbers, dots, underscores')
    .custom(async (value) => {
      const existing = await User.findOne({ username: value });
      if (existing) throw new Error('Username already taken');
      return true;
    }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('role').isIn(['admin', 'staff']).withMessage('Invalid role')
];

const updateStaffValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('role').isIn(['admin', 'staff']).withMessage('Invalid role')
];

const resetPasswordValidator = [
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
];

module.exports = { createStaffValidator, updateStaffValidator, resetPasswordValidator };
