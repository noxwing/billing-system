const StoreSettings = require('../models/StoreSettings');

// GET /admin/settings
async function showSettings(req, res, next) {
  try {
    const settings = await StoreSettings.getSettings();
    const errors = (req.session && req.session.validationErrors) || [];
    if (req.session) delete req.session.validationErrors;

    res.render('admin/settings/index', { title: 'Store Settings', settings, errors });
  } catch (err) { next(err); }
}

// POST /admin/settings
async function updateSettings(req, res, next) {
  try {
    const {
      storeName, address, phone, email, gstNumber, currencySymbol,
      receiptFooterMessage, printerSize, autoPrint, lowStockThresholdDefault
    } = req.body;

    const settings = await StoreSettings.getSettings();
    settings.storeName = storeName ? storeName.trim() : settings.storeName;
    settings.address = address ? address.trim() : '';
    settings.phone = phone ? phone.trim() : '';
    settings.email = email ? email.trim() : '';
    settings.gstNumber = gstNumber ? gstNumber.trim() : '';
    settings.currencySymbol = currencySymbol || '₹';
    settings.receiptFooterMessage = receiptFooterMessage ? receiptFooterMessage.trim() : settings.receiptFooterMessage;
    settings.printerSize = printerSize || '80mm';
    settings.autoPrint = autoPrint === 'on' || autoPrint === 'true';
    settings.lowStockThresholdDefault = parseInt(lowStockThresholdDefault, 10) || 5;
    await settings.save();

    res.redirect('/admin/settings');
  } catch (err) { next(err); }
}

module.exports = { showSettings, updateSettings };
