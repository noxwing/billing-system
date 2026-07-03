const moment = require('moment');
const Bill = require('../models/Bill');

/**
 * Generates a sequential, human-readable invoice number like INV-20260630-0001
 * Sequence resets daily, calculated by counting today's bills.
 */
async function generateInvoiceNo() {
  const datePart = moment().format('YYYYMMDD');
  const startOfDay = moment().startOf('day').toDate();
  const endOfDay = moment().endOf('day').toDate();

  const countToday = await Bill.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });

  const sequence = String(countToday + 1).padStart(4, '0');
  const invoiceNo = `INV-${datePart}-${sequence}`;

  // Safety check for rare race condition collisions
  const exists = await Bill.findOne({ invoiceNo });
  if (exists) {
    const fallbackSeq = String(countToday + 1 + Math.floor(Math.random() * 100)).padStart(4, '0');
    return `INV-${datePart}-${fallbackSeq}`;
  }

  return invoiceNo;
}

module.exports = generateInvoiceNo;
