const { createBill } = require('../services/billing.service');
const Bill = require('../models/Bill');
const StoreSettings = require('../models/StoreSettings');
const { PAGINATION } = require('../config/constants');

// POST /billing/create
async function processBill(req, res, next) {
  try {
    const { items, customerName, customerPhone, paymentMethod, paymentDetails } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const { bill } = await createBill({
      cashier: req.user,
      customerName,
      customerPhone,
      items,
      paymentMethod,
      paymentDetails: paymentDetails || {}
    });

    return res.json({ success: true, billId: bill._id, invoiceNo: bill.invoiceNo });
  } catch (err) {
    console.error('Error processing bill:', err);
    if (err.message && (err.message.includes('Insufficient stock') || err.message.includes('inactive') || err.message.includes('not found'))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
}

// GET /billing/:id/receipt
async function viewReceipt(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.redirect('/pos');

    const settings = await StoreSettings.getSettings();

    res.render('billing/receipt', {
      title: `Receipt - ${bill.invoiceNo}`,
      layout: false,
      bill,
      settings
    });
  } catch (err) { next(err); }
}

// GET /billing/:id/print/58mm
async function printReceipt58(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.redirect('/pos');
    const settings = await StoreSettings.getSettings();
    res.render('billing/print-58mm', { title: 'Print Receipt', layout: false, bill, settings });
  } catch (err) { next(err); }
}

// GET /billing/:id/print/80mm
async function printReceipt80(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.redirect('/pos');
    const settings = await StoreSettings.getSettings();
    res.render('billing/print-80mm', { title: 'Print Receipt', layout: false, bill, settings });
  } catch (err) { next(err); }
}

// GET /admin/billing
async function listBills(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    const filter = {};
    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { cashierName: { $regex: search, $options: 'i' } }
      ];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [bills, total] = await Promise.all([
      Bill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Bill.countDocuments(filter)
    ]);

    res.render('admin/billing/list', {
      title: 'Transaction History',
      bills,
      search,
      dateFrom,
      dateTo,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (err) { next(err); }
}

// GET /admin/billing/:id
async function viewBillDetail(req, res, next) {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.redirect('/admin/billing');
    const settings = await StoreSettings.getSettings();
    res.render('admin/billing/detail', { title: `Invoice ${bill.invoiceNo}`, bill, settings });
  } catch (err) { next(err); }
}

module.exports = {
  processBill, viewReceipt, printReceipt58, printReceipt80,
  listBills, viewBillDetail
};
