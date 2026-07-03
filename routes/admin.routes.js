const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');
const validate = require('../middleware/validate.middleware');

const dashboardCtrl = require('../controllers/dashboard.controller');
const staffCtrl = require('../controllers/staff.controller');
const categoryCtrl = require('../controllers/category.controller');
const productCtrl = require('../controllers/product.controller');
const inventoryCtrl = require('../controllers/inventory.controller');
const reportCtrl = require('../controllers/report.controller');
const settingsCtrl = require('../controllers/settings.controller');
const billingCtrl = require('../controllers/billing.controller');

const { createStaffValidator, updateStaffValidator, resetPasswordValidator } = require('../validators/staff.validator');
const { categoryValidator } = require('../validators/category.validator');
const { createProductValidator, updateProductValidator } = require('../validators/product.validator');

// All admin routes require auth + admin role
router.use(authenticate, isAdmin);

// Dashboard
router.get('/dashboard', dashboardCtrl.showDashboard);

// Staff
router.get('/staff', staffCtrl.listStaff);
router.get('/staff/new', staffCtrl.showCreateForm);
router.post('/staff', createStaffValidator, validate, staffCtrl.createStaff);
router.get('/staff/:id/edit', staffCtrl.showEditForm);
router.post('/staff/:id', updateStaffValidator, validate, staffCtrl.updateStaff);
router.post('/staff/:id/toggle-status', staffCtrl.toggleStatus);
router.get('/staff/:id/reset-password', staffCtrl.showResetPasswordForm);
router.post('/staff/:id/reset-password', resetPasswordValidator, validate, staffCtrl.resetPassword);
router.post('/staff/:id/delete', staffCtrl.deleteStaff);

// Categories
router.get('/categories', categoryCtrl.listCategories);
router.get('/categories/new', categoryCtrl.showCreateForm);
router.post('/categories', categoryValidator, validate, categoryCtrl.createCategory);
router.get('/categories/:id/edit', categoryCtrl.showEditForm);
router.post('/categories/:id', categoryValidator, validate, categoryCtrl.updateCategory);
router.post('/categories/:id/delete', categoryCtrl.deleteCategory);

// Products
router.get('/products', productCtrl.listProducts);
router.get('/products/new', productCtrl.showCreateForm);
router.post('/products', createProductValidator, validate, productCtrl.createProduct);
router.get('/products/:id', productCtrl.showProduct);
router.get('/products/:id/edit', productCtrl.showEditForm);
router.post('/products/:id', updateProductValidator, validate, productCtrl.updateProduct);
router.post('/products/:id/delete', productCtrl.deleteProduct);
router.post('/products/:id/restock', productCtrl.restockProduct);

// Inventory
router.get('/inventory', inventoryCtrl.showInventory);
router.get('/inventory/logs', inventoryCtrl.showStockLogs);

// Billing / Transactions
router.get('/billing', billingCtrl.listBills);
router.get('/billing/:id', billingCtrl.viewBillDetail);

// Reports
router.get('/reports', reportCtrl.showReports);
router.get('/reports/daily', reportCtrl.dailyReport);
router.get('/reports/monthly', reportCtrl.monthlyReport);
router.get('/reports/yearly', reportCtrl.yearlyReport);
router.get('/reports/cashier', reportCtrl.cashierReport);
router.get('/reports/products', reportCtrl.productReport);
router.get('/reports/inventory', reportCtrl.inventoryReport);

// Settings
router.get('/settings', settingsCtrl.showSettings);
router.post('/settings', settingsCtrl.updateSettings);

module.exports = router;
