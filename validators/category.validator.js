const { body } = require('express-validator');

const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 60 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('status').optional().isIn(['active', 'inactive'])
];

module.exports = { categoryValidator };
