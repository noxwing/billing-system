const { ROLES } = require('../config/constants');

/**
 * Restricts access to specific roles.
 * Usage: authorize(ROLES.ADMIN)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
      }
      return res.status(403).render('errors/403', {
        title: 'Access Denied',
        layout: false
      });
    }

    return next();
  };
}

const isAdmin = authorize(ROLES.ADMIN);
const isStaffOrAdmin = authorize(ROLES.ADMIN, ROLES.STAFF);

module.exports = { authorize, isAdmin, isStaffOrAdmin };
