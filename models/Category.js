const mongoose = require('mongoose');
const { PRODUCT_STATUS } = require('../config/constants');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      maxlength: 60
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

categorySchema.index({ status: 1 });

module.exports = mongoose.model('Category', categorySchema);
