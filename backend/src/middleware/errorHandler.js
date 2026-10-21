const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  const payload = {
    error: {
      status,
      message
    }
  };

  // Validation errors carry structured field details (for example the list
  // of allowed enum values) that clients need in order to self-correct.
  if (err.details && typeof err.details === 'object') {
    payload.error.details = err.details;
  }

  res.status(status).json(payload);
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };
