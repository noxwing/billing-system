const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const StockLog = require('../models/StockLog');
const generateInvoiceNo = require('../utils/generateInvoiceNo');
const { STOCK_LOG_TYPES, BILL_STATUS } = require('../config/constants');
const { isDecimalUnit, roundQty } = require('../utils/units');

/**
 * Validates cart items against DB, computes totals, and creates the bill atomically.
 * Returns { bill } on success, throws on any failure.
 */
async function createBill({ cashier, customerName, customerPhone, items, paymentMethod, paymentDetails }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(session);
    const productMap = {};
    products.forEach((p) => { productMap[p._id.toString()] = p; });

    const billItems = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      const product = productMap[item.productId];
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      if (product.status !== 'active') throw new Error(`Product "${product.name}" is inactive`);

      const unit = product.unit || 'pcs';
      let qty = roundQty(parseFloat(item.qty), unit);
      if (!qty || qty <= 0) throw new Error(`Invalid quantity for "${product.name}"`);
      if (!isDecimalUnit(unit) && !Number.isInteger(qty)) {
        throw new Error(`"${product.name}" is sold in whole ${unit}(s) only`);
      }
      if (!product.unlimitedStock && product.stock < qty) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock}`);
      }

      const unitPrice = product.sellingPrice;
      const discount = parseFloat(item.discount) || 0;
      const taxPercent = product.taxPercent || 0;
      const lineBase = unitPrice * qty - discount;
      const taxAmount = parseFloat((lineBase * taxPercent / 100).toFixed(2));
      const lineSubtotal = parseFloat((lineBase + taxAmount).toFixed(2));

      billItems.push({
        product: product._id,
        name: product.name,
        barcode: product.barcode,
        sku: product.sku,
        unit,
        qty,
        unitPrice,
        discount,
        taxPercent,
        taxAmount,
        lineSubtotal
      });

      subtotal += unitPrice * qty;
      discountTotal += discount;
      taxTotal += taxAmount;
    }

    const grandTotal = parseFloat((subtotal - discountTotal + taxTotal).toFixed(2));

    // Deduct stock
    const stockUpdateOps = [];
    const stockLogDocs = [];

    for (let i = 0; i < billItems.length; i++) {
      const item = billItems[i];
      const product = productMap[item.product.toString()];
      if (!product.unlimitedStock) {
        const newStock = product.stock - item.qty;
        stockUpdateOps.push({
          updateOne: {
            filter: { _id: product._id, stock: { $gte: item.qty } },
            update: { $inc: { stock: -item.qty } }
          }
        });
        stockLogDocs.push({
          product: product._id,
          productName: product.name,
          type: STOCK_LOG_TYPES.SALE,
          qtyChange: -item.qty,
          stockAfter: newStock,
          reason: 'Sale',
          performedBy: cashier._id
        });
      }
    }

    if (stockUpdateOps.length > 0) {
      const bulkResult = await Product.bulkWrite(stockUpdateOps, { session });
      if (bulkResult.modifiedCount !== stockUpdateOps.length) {
        throw new Error('Stock deduction failed: concurrent modification detected. Please retry.');
      }
    }

    const invoiceNo = await generateInvoiceNo();

    const [bill] = await Bill.create(
      [
        {
          invoiceNo,
          cashier: cashier._id,
          cashierName: cashier.name,
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          items: billItems,
          subtotal: parseFloat(subtotal.toFixed(2)),
          discountTotal: parseFloat(discountTotal.toFixed(2)),
          taxTotal: parseFloat(taxTotal.toFixed(2)),
          grandTotal,
          paymentMethod,
          paymentDetails: {
            cashReceived: parseFloat(paymentDetails.cashReceived) || 0,
            upiAmount: parseFloat(paymentDetails.upiAmount) || 0,
            cardAmount: parseFloat(paymentDetails.cardAmount) || 0,
            balance: parseFloat(paymentDetails.balance) || 0
          },
          status: BILL_STATUS.COMPLETED
        }
      ],
      { session }
    );

    if (stockLogDocs.length > 0) {
      stockLogDocs.forEach((log) => { log.relatedBill = bill._id; });
      await StockLog.insertMany(stockLogDocs, { session });
    }

    await session.commitTransaction();
    return { bill };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { createBill };
