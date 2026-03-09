const errorHandler = (err, req, res, _next) => {
  console.error('Error:', err.message);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: `Invalid value for ${err.path}`,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: 'Duplicate entry',
      message: `${field} already exists`,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
