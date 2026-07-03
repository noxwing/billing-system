module.exports = {
  ROLES: {
    ADMIN: 'admin',
    STAFF: 'staff'
  },
  PAYMENT_METHODS: {
    CASH: 'cash',
    UPI: 'upi',
    CARD: 'card',
    MIXED: 'mixed'
  },
  BILL_STATUS: {
    COMPLETED: 'completed',
    REFUNDED: 'refunded',
    VOID: 'void'
  },
  STOCK_LOG_TYPES: {
    SALE: 'sale',
    RESTOCK: 'restock',
    ADJUSTMENT: 'adjustment',
    REFUND: 'refund'
  },
  PRODUCT_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  },
  PRINTER_SIZES: {
    MM58: '58mm',
    MM80: '80mm'
  },
  DEFAULT_LOW_STOCK_THRESHOLD: 5,
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  }
};
