const Category = require('../models/Category');
const Product = require('../models/Product');
const { PAGINATION } = require('../config/constants');

// GET /admin/categories
async function listCategories(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [categories, total] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Category.countDocuments(filter)
    ]);

    // Get product counts per category
    const categoryIds = categories.map((c) => c._id);
    const counts = await Product.aggregate([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

    const categoriesWithCounts = categories.map((c) => ({
      ...c.toObject(),
      productCount: countMap[c._id.toString()] || 0
    }));

    res.render('admin/categories/list', {
      title: 'Category Management',
      categories: categoriesWithCounts,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (err) {
    next(err);
  }
}

function showCreateForm(req, res) {
  const errors = (req.session && req.session.validationErrors) || [];
  const oldInput = (req.session && req.session.oldInput) || {};
  if (req.session) {
    delete req.session.validationErrors;
    delete req.session.oldInput;
  }
  res.render('admin/categories/form', {
    title: 'Add Category',
    category: oldInput,
    errors,
    isEdit: false
  });
}

async function createCategory(req, res, next) {
  try {
    const { name, description, status } = req.body;
    await Category.create({ name: name.trim(), description, status: status || 'active', createdBy: req.user._id });
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

async function showEditForm(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.redirect('/admin/categories');

    const errors = (req.session && req.session.validationErrors) || [];
    if (req.session) delete req.session.validationErrors;

    res.render('admin/categories/form', {
      title: 'Edit Category',
      category,
      errors,
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { name, description, status } = req.body;
    await Category.findByIdAndUpdate(req.params.id, { name: name.trim(), description, status });
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const inUse = await Product.countDocuments({ category: req.params.id });
    if (inUse > 0) {
      // Don't allow deleting categories that are in use - protect data integrity
      return res.redirect('/admin/categories');
    }
    await Category.findByIdAndDelete(req.params.id);
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  showCreateForm,
  createCategory,
  showEditForm,
  updateCategory,
  deleteCategory
};
