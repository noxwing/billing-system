const logger = require('../utils/logger');

function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }
  return res.status(404).render('errors/404', { title: 'Page Not Found', layout: false });
}

function errorHandler(err, req, res, next) {
  logger.error(err.stack || err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // CSRF error
  if (err.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    message = 'Invalid form submission token. Please refresh and try again.';
  }

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(statusCode).json({ success: false, message });
  }

  return res.status(statusCode).render('errors/500', {
    title: 'Something Went Wrong',
    message,
    layout: false
  });
}

module.exports = { notFoundHandler, errorHandler };
