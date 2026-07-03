const Product = require('../models/Product');
const StockLog = require('../models/StockLog');
const { PAGINATION } = require('../config/constants');

// GET /admin/inventory
async function showInventory(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'all'; // all | low | out

    const query = {};
    if (filter === 'low') {
      query.unlimitedStock = false;
      query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
      query.stock = { $gt: 0 };
    } else if (filter === 'out') {
      query.unlimitedStock = false;
      query.stock = { $lte: 0 };
    }

    const [products, total] = await Promise.all([
      Product.find(query).populate('category', 'name').sort({ stock: 1 }).skip(skip).limit(limit),
      Product.countDocuments(query)
    ]);

    const [lowCount, outCount, totalCount] = await Promise.all([
      Product.countDocuments({ unlimitedStock: false, $expr: { $lte: ['$stock', '$lowStockThreshold'] }, stock: { $gt: 0 } }),
      Product.countDocuments({ unlimitedStock: false, stock: { $lte: 0 } }),
      Product.countDocuments()
    ]);

    res.render('admin/inventory/index', {
      title: 'Inventory Management',
      products,
      filter,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total,
      lowCount,
      outCount,
      totalCount
    });
  } catch (err) { next(err); }
}

// GET /admin/inventory/logs
async function showStockLogs(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      StockLog.find()
        .populate('product', 'name sku')
        .populate('performedBy', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockLog.countDocuments()
    ]);

    res.render('admin/inventory/logs', {
      title: 'Stock Logs',
      logs,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (err) { next(err); }
}

module.exports = { showInventory, showStockLogs };
