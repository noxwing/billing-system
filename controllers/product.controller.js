const Product = require('../models/Product');
const Category = require('../models/Category');
const StockLog = require('../models/StockLog');
const { PAGINATION, STOCK_LOG_TYPES } = require('../config/constants');
const { PRODUCT_UNITS } = require('../utils/units');

// GET /admin/products
async function listProducts(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';
    const categoryFilter = req.query.category || '';
    const statusFilter = req.query.status || '';

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    if (categoryFilter) filter.category = categoryFilter;
    if (statusFilter) filter.status = statusFilter;

    const [products, total, categories] = await Promise.all([
      Product.find(filter).populate('category', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
      Category.find({ status: 'active' }).sort({ name: 1 })
    ]);

    res.render('admin/products/list', {
      title: 'Product Management',
      products,
      categories,
      search,
      categoryFilter,
      statusFilter,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (err) {
    next(err);
  }
}

// GET /admin/products/new
async function showCreateForm(req, res, next) {
  try {
    const categories = await Category.find({ status: 'active' }).sort({ name: 1 });
    const errors = (req.session && req.session.validationErrors) || [];
    const oldInput = (req.session && req.session.oldInput) || {};
    if (req.session) { delete req.session.validationErrors; delete req.session.oldInput; }

    res.render('admin/products/form', {
      title: 'Add Product',
      product: oldInput,
      categories,
      errors,
      isEdit: false,
      unitOptions: PRODUCT_UNITS
    });
  } catch (err) { next(err); }
}

// POST /admin/products
async function createProduct(req, res, next) {
  try {
    const { name, barcode, sku, category, purchasePrice, sellingPrice, taxPercent, unit,
      stock, unlimitedStock, lowStockThreshold, status, description } = req.body;

    const product = await Product.create({
      name: name.trim(),
      barcode: barcode.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      purchasePrice: parseFloat(purchasePrice),
      sellingPrice: parseFloat(sellingPrice),
      taxPercent: parseFloat(taxPercent) || 0,
      unit: unit || 'pcs',
      stock: parseFloat(stock) || 0,
      unlimitedStock: unlimitedStock === 'on' || unlimitedStock === 'true',
      lowStockThreshold: parseFloat(lowStockThreshold) || 5,
      status: status || 'active',
      description: description ? description.trim() : '',
      createdBy: req.user._id
    });

    if (product.stock > 0 && !product.unlimitedStock) {
      await StockLog.create({
        product: product._id,
        productName: product.name,
        type: STOCK_LOG_TYPES.RESTOCK,
        qtyChange: product.stock,
        stockAfter: product.stock,
        reason: 'Initial stock',
        performedBy: req.user._id
      });
    }

    res.redirect('/admin/products');
  } catch (err) { next(err); }
}

// GET /admin/products/:id
async function showProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name');
    if (!product) return res.redirect('/admin/products');

    const stockLogs = await StockLog.find({ product: product._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('performedBy', 'name');

    res.render('admin/products/detail', { title: product.name, product, stockLogs });
  } catch (err) { next(err); }
}

// GET /admin/products/:id/edit
async function showEditForm(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/admin/products');

    const categories = await Category.find({ status: 'active' }).sort({ name: 1 });
    const errors = (req.session && req.session.validationErrors) || [];
    if (req.session) delete req.session.validationErrors;

    res.render('admin/products/form', {
      title: 'Edit Product',
      product,
      categories,
      errors,
      isEdit: true,
      unitOptions: PRODUCT_UNITS
    });
  } catch (err) { next(err); }
}

// POST /admin/products/:id
async function updateProduct(req, res, next) {
  try {
    const { name, barcode, sku, category, purchasePrice, sellingPrice, taxPercent, unit,
      stock, unlimitedStock, lowStockThreshold, status, description } = req.body;

    const existing = await Product.findById(req.params.id);
    if (!existing) return res.redirect('/admin/products');

    const newStock = parseFloat(stock) || 0;
    const stockDiff = newStock - existing.stock;

    existing.name = name.trim();
    existing.barcode = barcode.trim();
    existing.sku = sku.trim().toUpperCase();
    existing.category = category;
    existing.purchasePrice = parseFloat(purchasePrice);
    existing.sellingPrice = parseFloat(sellingPrice);
    existing.taxPercent = parseFloat(taxPercent) || 0;
    existing.unit = unit || 'pcs';
    existing.stock = newStock;
    existing.unlimitedStock = unlimitedStock === 'on' || unlimitedStock === 'true';
    existing.lowStockThreshold = parseFloat(lowStockThreshold) || 5;
    existing.status = status || 'active';
    existing.description = description ? description.trim() : '';
    await existing.save();

    if (stockDiff !== 0 && !existing.unlimitedStock) {
      await StockLog.create({
        product: existing._id,
        productName: existing.name,
        type: stockDiff > 0 ? STOCK_LOG_TYPES.RESTOCK : STOCK_LOG_TYPES.ADJUSTMENT,
        qtyChange: stockDiff,
        stockAfter: newStock,
        reason: 'Manual stock adjustment via admin',
        performedBy: req.user._id
      });
    }

    res.redirect('/admin/products');
  } catch (err) { next(err); }
}

// POST /admin/products/:id/delete
async function deleteProduct(req, res, next) {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/products');
  } catch (err) { next(err); }
}

// POST /admin/products/:id/restock
async function restockProduct(req, res, next) {
  try {
    const { quantity, reason } = req.body;
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return res.redirect(`/admin/products/${req.params.id}`);

    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/admin/products');

    if (!product.unlimitedStock) {
      product.stock += qty;
      await product.save();

      await StockLog.create({
        product: product._id,
        productName: product.name,
        type: STOCK_LOG_TYPES.RESTOCK,
        qtyChange: qty,
        stockAfter: product.stock,
        reason: reason || 'Manual restock',
        performedBy: req.user._id
      });
    }

    res.redirect(`/admin/products/${req.params.id}`);
  } catch (err) { next(err); }
}

module.exports = {
  listProducts, showCreateForm, createProduct, showProduct,
  showEditForm, updateProduct, deleteProduct, restockProduct
};
