const User = require('../models/User');
const { PAGINATION } = require('../config/constants');

// GET /admin/staff
async function listStaff(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = PAGINATION.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [staff, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);

    res.render('admin/staff/list', {
      title: 'Staff Management',
      staff,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit) || 1,
      total
    });
  } catch (err) {
    next(err);
  }
}

// GET /admin/staff/new
function showCreateForm(req, res) {
  const errors = (req.session && req.session.validationErrors) || [];
  const oldInput = (req.session && req.session.oldInput) || {};
  if (req.session) {
    delete req.session.validationErrors;
    delete req.session.oldInput;
  }
  res.render('admin/staff/form', {
    title: 'Add Staff',
    staffMember: oldInput,
    errors,
    isEdit: false
  });
}

// POST /admin/staff
async function createStaff(req, res, next) {
  try {
    const { name, username, email, phone, password, role } = req.body;

    const passwordHash = await User.hashPassword(password);

    await User.create({
      name,
      username: username.toLowerCase().trim(),
      email: email || undefined,
      phone,
      passwordHash,
      role,
      createdBy: req.user._id
    });

    res.redirect('/admin/staff');
  } catch (err) {
    next(err);
  }
}

// GET /admin/staff/:id/edit
async function showEditForm(req, res, next) {
  try {
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) return res.redirect('/admin/staff');

    const errors = (req.session && req.session.validationErrors) || [];
    if (req.session) delete req.session.validationErrors;

    res.render('admin/staff/form', {
      title: 'Edit Staff',
      staffMember,
      errors,
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

// POST /admin/staff/:id
async function updateStaff(req, res, next) {
  try {
    const { name, email, phone, role } = req.body;

    // Prevent admin from demoting themselves to staff (lockout protection)
    if (req.params.id === String(req.user._id) && role !== 'admin') {
      req.session.validationErrors = [{ field: 'role', message: 'You cannot change your own role' }];
      return res.redirect(`/admin/staff/${req.params.id}/edit`);
    }

    await User.findByIdAndUpdate(req.params.id, { name, email: email || undefined, phone, role });
    res.redirect('/admin/staff');
  } catch (err) {
    next(err);
  }
}

// POST /admin/staff/:id/toggle-status
async function toggleStatus(req, res, next) {
  try {
    if (req.params.id === String(req.user._id)) {
      return res.redirect('/admin/staff');
    }
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) return res.redirect('/admin/staff');

    staffMember.isActive = !staffMember.isActive;
    await staffMember.save();

    res.redirect('/admin/staff');
  } catch (err) {
    next(err);
  }
}

// GET /admin/staff/:id/reset-password
async function showResetPasswordForm(req, res, next) {
  try {
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) return res.redirect('/admin/staff');

    const errors = (req.session && req.session.validationErrors) || [];
    if (req.session) delete req.session.validationErrors;

    res.render('admin/staff/reset-password', {
      title: 'Reset Password',
      staffMember,
      errors
    });
  } catch (err) {
    next(err);
  }
}

// POST /admin/staff/:id/reset-password
async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    const staffMember = await User.findById(req.params.id);
    if (!staffMember) return res.redirect('/admin/staff');

    staffMember.passwordHash = await User.hashPassword(newPassword);
    staffMember.passwordChangedAt = new Date();
    await staffMember.save();

    res.redirect('/admin/staff');
  } catch (err) {
    next(err);
  }
}

// POST /admin/staff/:id/delete
async function deleteStaff(req, res, next) {
  try {
    if (req.params.id === String(req.user._id)) {
      return res.redirect('/admin/staff');
    }
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/staff');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStaff,
  showCreateForm,
  createStaff,
  showEditForm,
  updateStaff,
  toggleStatus,
  showResetPasswordForm,
  resetPassword,
  deleteStaff
};
