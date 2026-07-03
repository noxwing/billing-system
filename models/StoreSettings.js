const mongoose = require('mongoose');
const { PRINTER_SIZES } = require('../config/constants');

const storeSettingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      required: true,
      default: 'My Mini Supermarket',
      trim: true
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      default: ''
    },
    gstNumber: {
      type: String,
      trim: true,
      default: ''
    },
    currencySymbol: {
      type: String,
      default: '₹'
    },
    receiptFooterMessage: {
      type: String,
      trim: true,
      default: 'Thank you for shopping with us!'
    },
    printerSize: {
      type: String,
      enum: Object.values(PRINTER_SIZES),
      default: PRINTER_SIZES.MM80
    },
    autoPrint: {
      type: Boolean,
      default: true
    },
    lowStockThresholdDefault: {
      type: Number,
      default: 5
    }
  },
  { timestamps: true }
);

// Enforce singleton pattern via static getter
storeSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
