const moment = require('moment');
const Bill = require('../models/Bill');
const User = require('../models/User');
const Product = require('../models/Product');
const { BILL_STATUS, ROLES } = require('../config/constants');

// GET /admin/reports
async function showReports(req, res) {
  res.render('admin/reports/index', { title: 'Reports' });
}

// GET /admin/reports/daily
async function dailyReport(req, res, next) {
  try {
    const date = req.query.date ? moment(req.query.date) : moment();
    const start = date.clone().startOf('day').toDate();
    const end = date.clone().endOf('day').toDate();

    const [bills, agg] = await Promise.all([
      Bill.find({ status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } })
        .populate('cashier', 'name')
        .sort({ createdAt: -1 }),
      Bill.aggregate([
        { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, tax: { $sum: '$taxTotal' }, discount: { $sum: '$discountTotal' } } }
      ])
    ]);

    res.render('admin/reports/daily', {
      title: 'Daily Report',
      bills,
      summary: agg[0] || { total: 0, count: 0, tax: 0, discount: 0 },
      reportDate: date.format('YYYY-MM-DD'),
      reportDateDisplay: date.format('DD MMMM YYYY')
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/monthly
async function monthlyReport(req, res, next) {
  try {
    const month = req.query.month ? moment(req.query.month, 'YYYY-MM') : moment();
    const start = month.clone().startOf('month').toDate();
    const end = month.clone().endOf('month').toDate();

    const dailyBreakdown = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const agg = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, tax: { $sum: '$taxTotal' }, discount: { $sum: '$discountTotal' } } }
    ]);

    res.render('admin/reports/monthly', {
      title: 'Monthly Report',
      dailyBreakdown,
      summary: agg[0] || { total: 0, count: 0, tax: 0, discount: 0 },
      reportMonth: month.format('YYYY-MM'),
      reportMonthDisplay: month.format('MMMM YYYY')
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/yearly
async function yearlyReport(req, res, next) {
  try {
    const year = req.query.year ? parseInt(req.query.year, 10) : moment().year();
    const start = moment().year(year).startOf('year').toDate();
    const end = moment().year(year).endOf('year').toDate();

    const monthlyBreakdown = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const agg = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, tax: { $sum: '$taxTotal' }, discount: { $sum: '$discountTotal' } } }
    ]);

    res.render('admin/reports/yearly', {
      title: 'Yearly Report',
      monthlyBreakdown,
      summary: agg[0] || { total: 0, count: 0, tax: 0, discount: 0 },
      reportYear: year,
      availableYears: [moment().year() - 2, moment().year() - 1, moment().year()]
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/cashier
async function cashierReport(req, res, next) {
  try {
    const month = req.query.month ? moment(req.query.month, 'YYYY-MM') : moment();
    const start = month.clone().startOf('month').toDate();
    const end = month.clone().endOf('month').toDate();

    const cashierStats = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$cashier',
          cashierName: { $first: '$cashierName' },
          totalRevenue: { $sum: '$grandTotal' },
          totalBills: { $sum: 1 },
          avgBillValue: { $avg: '$grandTotal' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.render('admin/reports/cashier', {
      title: 'Cashier Report',
      cashierStats,
      reportMonth: month.format('YYYY-MM'),
      reportMonthDisplay: month.format('MMMM YYYY')
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/products
async function productReport(req, res, next) {
  try {
    const month = req.query.month ? moment(req.query.month, 'YYYY-MM') : moment();
    const start = month.clone().startOf('month').toDate();
    const end = month.clone().endOf('month').toDate();

    const productStats = await Bill.aggregate([
      { $match: { status: BILL_STATUS.COMPLETED, createdAt: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: '$items.lineSubtotal' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 50 }
    ]);

    res.render('admin/reports/products', {
      title: 'Product Report',
      productStats,
      reportMonth: month.format('YYYY-MM'),
      reportMonthDisplay: month.format('MMMM YYYY')
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/inventory
async function inventoryReport(req, res, next) {
  try {
    const products = await Product.find()
      .populate('category', 'name')
      .sort({ name: 1 })
      .select('name sku barcode category stock unlimitedStock lowStockThreshold sellingPrice purchasePrice status');

    const totalValue = products.reduce((sum, p) => {
      return sum + (p.unlimitedStock ? 0 : p.stock * p.purchasePrice);
    }, 0);

    res.render('admin/reports/inventory', {
      title: 'Inventory Report',
      products,
      totalValue
    });
  } catch (err) { next(err); }
}

module.exports = {
  showReports, dailyReport, monthlyReport, yearlyReport,
  cashierReport, productReport, inventoryReport
};
