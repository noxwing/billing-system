const moment = require('moment');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const { BILL_STATUS } = require('../config/constants');

// GET /admin/dashboard
async function showDashboard(req, res, next) {
  try {
    const startOfToday = moment().startOf('day').toDate();
    const endOfToday = moment().endOf('day').toDate();
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();
    const startOfYear = moment().startOf('year').toDate();
    const endOfYear = moment().endOf('year').toDate();

    const matchCompleted = { status: BILL_STATUS.COMPLETED };

    const [todayAgg, monthAgg, yearAgg, todayTxnCount] = await Promise.all([
      Bill.aggregate([
        { $match: { ...matchCompleted, createdAt: { $gte: startOfToday, $lte: endOfToday } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { ...matchCompleted, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ]),
      Bill.aggregate([
        { $match: { ...matchCompleted, createdAt: { $gte: startOfYear, $lte: endOfYear } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
      ]),
      Bill.countDocuments({ ...matchCompleted, createdAt: { $gte: startOfToday, $lte: endOfToday } })
    ]);

    const topProducts = await Bill.aggregate([
      { $match: { ...matchCompleted, createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: '$items.lineSubtotal' }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 }
    ]);

    const lowStockProducts = await Product.find({
      unlimitedStock: false,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      stock: { $gt: 0 }
    })
      .limit(10)
      .select('name stock lowStockThreshold sku');

    const outOfStockProducts = await Product.find({
      unlimitedStock: false,
      stock: { $lte: 0 }
    })
      .limit(10)
      .select('name stock sku');

    const recentTransactions = await Bill.find(matchCompleted)
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNo grandTotal paymentMethod cashierName createdAt');

    // Last 7 days revenue graph data
    const sevenDaysAgo = moment().subtract(6, 'days').startOf('day').toDate();
    const dailyRevenue = await Bill.aggregate([
      { $match: { ...matchCompleted, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$grandTotal' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const revenueChartLabels = [];
    const revenueChartData = [];
    for (let i = 6; i >= 0; i--) {
      const day = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const found = dailyRevenue.find((d) => d._id === day);
      revenueChartLabels.push(moment(day).format('DD MMM'));
      revenueChartData.push(found ? found.total : 0);
    }

    res.render('admin/dashboard', {
      title: 'Dashboard',
      todaySales: todayAgg[0]?.total || 0,
      todayCount: todayTxnCount || 0,
      monthSales: monthAgg[0]?.total || 0,
      monthCount: monthAgg[0]?.count || 0,
      yearSales: yearAgg[0]?.total || 0,
      yearCount: yearAgg[0]?.count || 0,
      topProducts,
      lowStockProducts,
      outOfStockProducts,
      recentTransactions,
      revenueChartLabels,
      revenueChartData
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showDashboard };
