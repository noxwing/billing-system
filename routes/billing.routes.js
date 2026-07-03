const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isStaffOrAdmin } = require('../middleware/role.middleware');
const { billingLimiter } = require('../middleware/rateLimiter.middleware');
const billingCtrl = require('../controllers/billing.controller');

router.use(authenticate, isStaffOrAdmin);

router.post('/create', billingLimiter, billingCtrl.processBill);
router.get('/:id/receipt', billingCtrl.viewReceipt);
router.get('/:id/print/58mm', billingCtrl.printReceipt58);
router.get('/:id/print/80mm', billingCtrl.printReceipt80);

module.exports = router;
