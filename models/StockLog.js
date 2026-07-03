const mongoose = require('mongoose');
const { STOCK_LOG_TYPES } = require('../config/constants');

const stockLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(STOCK_LOG_TYPES),
      required: true
    },
    qtyChange: {
      type: Number,
      required: true
    }, // negative for sale, positive for restock
    stockAfter: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    relatedBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

stockLogSchema.index({ product: 1, createdAt: -1 });
stockLogSchema.index({ type: 1 });

module.exports = mongoose.model('StockLog', stockLogSchema);
