const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticate } = require('../middleware/auth.middleware');
const { isStaffOrAdmin } = require('../middleware/role.middleware');

router.use(authenticate, isStaffOrAdmin);

// GET /api/products/search?q=<query>&barcode=<barcode>
router.get('/products/search', async (req, res, next) => {
  try {
    const { q, barcode } = req.query;

    if (!q && !barcode) {
      return res.json({ success: true, products: [] });
    }

    let filter = { status: 'active' };

    if (barcode) {
      // Exact barcode lookup for scanner
      const product = await Product.findOne({ ...filter, barcode: barcode.trim() })
        .populate('category', 'name')
        .select('name barcode sku sellingPrice taxPercent stock unlimitedStock category');

      if (!product) {
        return res.json({ success: false, message: 'Product not found', products: [] });
      }
      return res.json({ success: true, products: [product] });
    }

    // Text search by name, barcode, or SKU
    const products = await Product.find({
      ...filter,
      $or: [
        { name: { $regex: q.trim(), $options: 'i' } },
        { barcode: { $regex: q.trim(), $options: 'i' } },
        { sku: { $regex: q.trim(), $options: 'i' } }
      ]
    })
      .populate('category', 'name')
      .select('name barcode sku sellingPrice taxPercent stock unlimitedStock category')
      .limit(10);

    return res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .select('name barcode sku sellingPrice taxPercent stock unlimitedStock status category');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    return res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
