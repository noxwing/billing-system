const HeldOrder = require('../models/HeldOrder');
const StoreSettings = require('../models/StoreSettings');
const { PRODUCT_UNITS } = require('../utils/units');

// GET /pos
async function showPOS(req, res, next) {
  try {
    const [settings, heldOrders] = await Promise.all([
      StoreSettings.getSettings(),
      HeldOrder.find({ cashier: req.user._id }).sort({ createdAt: -1 }).limit(10)
    ]);

    res.render('pos/index', {
      title: 'POS',
      layout: 'partials/pos-layout',
      settings,
      heldOrders,
      cashier: req.user,
      unitMeta: PRODUCT_UNITS
    });
  } catch (err) { next(err); }
}

// POST /pos/hold
async function holdOrder(req, res, next) {
  try {
    const { items, customerName, customerPhone, holdLabel } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: 'Cart is empty' });
    }

    // Remap items here to translate productId to product
    const formattedItems = items.map(item => ({
      product: item.productId || item.product, 
      name: item.name,
      barcode: item.barcode,
      unit: item.unit || 'pcs',
      qty: item.qty,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxPercent: item.taxPercent
    }));

    const held = await HeldOrder.create({
      cashier: req.user._id,
      holdLabel: holdLabel || '',
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      items: formattedItems
    });

    return res.json({ success: true, message: 'Order placed on hold', holdId: held._id });
  } catch (err) {
    next(err);
  }
}

// GET /pos/held/:id
async function resumeHeldOrder(req, res, next) {
  try {
    const held = await HeldOrder.findOne({ _id: req.params.id, cashier: req.user._id })
      .populate('items.product', 'name barcode sku sellingPrice taxPercent unit stock unlimitedStock status');

    if (!held) {
      return res.json({ success: false, message: 'Held order not found' });
    }

    return res.json({ success: true, heldOrder: held });
  } catch (err) {
    next(err);
  }
}

// DELETE /pos/held/:id
async function deleteHeldOrder(req, res, next) {
  try {
    await HeldOrder.findOneAndDelete({ _id: req.params.id, cashier: req.user._id });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// GET /pos/held
async function listHeldOrders(req, res, next) {
  try {
    const heldOrders = await HeldOrder.find({ cashier: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, heldOrders });
  } catch (err) {
    next(err);
  }
}

module.exports = { showPOS, holdOrder, resumeHeldOrder, deleteHeldOrder, listHeldOrders };
