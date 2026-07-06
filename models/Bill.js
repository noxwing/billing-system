const mongoose = require('mongoose');
const { PAYMENT_METHODS, BILL_STATUS } = require('../config/constants');

const billItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: { type: String, required: true },
    barcode: { type: String },
    sku: { type: String },
    unit: { type: String, default: 'pcs' },
    qty: { type: Number, required: true, min: 0.001 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 }, // flat amount per line
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    lineSubtotal: { type: Number, required: true, min: 0 } // (unitPrice*qty - discount) + taxAmount
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      required: true,
      unique: true
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    cashierName: { type: String, required: true },
    customerName: { type: String, trim: true, default: '' },
    customerPhone: { type: String, trim: true, default: '' },
    items: {
      type: [billItemSchema],
      validate: [(arr) => arr.length > 0, 'Bill must have at least one item']
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true
    },
    paymentDetails: {
      cashReceived: { type: Number, default: 0 },
      upiAmount: { type: Number, default: 0 },
      cardAmount: { type: Number, default: 0 },
      balance: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: Object.values(BILL_STATUS),
      default: BILL_STATUS.COMPLETED
    }
  },
  { timestamps: true }
);

billSchema.index({ createdAt: -1 });
billSchema.index({ cashier: 1, createdAt: -1 });
billSchema.index({ status: 1 });

module.exports = mongoose.model('Bill', billSchema);
