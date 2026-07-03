const mongoose = require('mongoose');

const heldItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    barcode: { type: String },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 }
  },
  { _id: false }
);

const heldOrderSchema = new mongoose.Schema(
  {
    holdLabel: {
      type: String,
      trim: true,
      default: ''
    },
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    customerName: { type: String, trim: true, default: '' },
    customerPhone: { type: String, trim: true, default: '' },
    items: {
      type: [heldItemSchema],
      validate: [(arr) => arr.length > 0, 'Held order must have at least one item']
    }
  },
  { timestamps: true }
);

heldOrderSchema.index({ cashier: 1, createdAt: -1 });

module.exports = mongoose.model('HeldOrder', heldOrderSchema);
