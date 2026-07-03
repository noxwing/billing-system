const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { isStaffOrAdmin } = require('../middleware/role.middleware');
const posCtrl = require('../controllers/pos.controller');

router.use(authenticate, isStaffOrAdmin);

router.get('/', posCtrl.showPOS);
router.post('/hold', posCtrl.holdOrder);
router.get('/held', posCtrl.listHeldOrders);
router.get('/held/:id', posCtrl.resumeHeldOrder);
router.delete('/held/:id', posCtrl.deleteHeldOrder);

module.exports = router;
