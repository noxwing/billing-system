const mongoose = require('mongoose');
const { PRODUCT_STATUS, DEFAULT_LOW_STOCK_THRESHOLD } = require('../config/constants');
const { UNIT_KEYS, DEFAULT_UNIT } = require('../utils/units');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 120
    },
    barcode: {
      type: String,
      required: [false, 'Barcode is required'],
      trim: true,
      unique: true
    },
    sku: {
      type: String,
      required: [false, 'SKU is required'],
      trim: true,
      unique: true,
      uppercase: true
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required']
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative']
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative']
    },
    taxPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    unit: {
      type: String,
      enum: UNIT_KEYS,
      default: DEFAULT_UNIT
    },
    stock: {
      type: Number,
      default: 0,
      min: 0
    },
    unlimitedStock: {
      type: Boolean,
      default: false
    },
    lowStockThreshold: {
      type: Number,
      default: DEFAULT_LOW_STOCK_THRESHOLD,
      min: 0
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

productSchema.index({ name: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ stock: 1 });

productSchema.virtual('isOutOfStock').get(function () {
  if (this.unlimitedStock) return false;
  return this.stock <= 0;
});

productSchema.virtual('isLowStock').get(function () {
  if (this.unlimitedStock) return false;
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
