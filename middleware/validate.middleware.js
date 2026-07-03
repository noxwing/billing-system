const { validationResult } = require('express-validator');

/**
 * Runs after express-validator chains. Collects errors and either
 * returns JSON (for API/AJAX requests) or redirects back with flash-style
 * errors stored in res.locals for the view to render.
 */
function validate(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const formattedErrors = errors.array().map((e) => ({
    field: e.path,
    message: e.msg
  }));

  if (req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept === 'application/json') {
    return res.status(422).json({ success: false, message: 'Validation failed', errors: formattedErrors });
  }

  req.session = req.session || {};
  req.session.validationErrors = formattedErrors;
  req.session.oldInput = req.body;

  return res.redirect('back');
}

module.exports = validate;
