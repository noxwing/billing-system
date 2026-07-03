const { body } = require('express-validator');
const Product = require('../models/Product');

const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 120 }),
  body('barcode')
    .trim()
    .notEmpty().withMessage('Barcode is required')
    .custom(async (value) => {
      const existing = await Product.findOne({ barcode: value });
      if (existing) throw new Error('Barcode already exists');
      return true;
    }),
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required')
    .custom(async (value) => {
      const existing = await Product.findOne({ sku: value.toUpperCase() });
      if (existing) throw new Error('SKU already exists');
      return true;
    }),
  body('category').notEmpty().withMessage('Category is required').isMongoId().withMessage('Invalid category'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('taxPercent').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Tax must be between 0-100'),
  body('stock').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Stock must be a positive integer'),
  body('lowStockThreshold').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 500 })
];

const updateProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 120 }),
  body('barcode')
    .trim()
    .notEmpty().withMessage('Barcode is required')
    .custom(async (value, { req }) => {
      const existing = await Product.findOne({ barcode: value, _id: { $ne: req.params.id } });
      if (existing) throw new Error('Barcode already exists');
      return true;
    }),
  body('sku')
    .trim()
    .notEmpty().withMessage('SKU is required')
    .custom(async (value, { req }) => {
      const existing = await Product.findOne({ sku: value.toUpperCase(), _id: { $ne: req.params.id } });
      if (existing) throw new Error('SKU already exists');
      return true;
    }),
  body('category').notEmpty().withMessage('Category is required').isMongoId(),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('taxPercent').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }),
  body('stock').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('lowStockThreshold').optional({ checkFalsy: true }).isInt({ min: 0 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 500 })
];

module.exports = { createProductValidator, updateProductValidator };
