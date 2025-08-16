const { v4: uuidv4 } = require('uuid');

// Custom error class for API errors
class APIError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Development error response
const sendErrorDev = (err, req, res) => {
  const errorId = uuidv4();
  
  console.error(`Error ID: ${errorId}`, {
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    }
  });

  res.status(err.statusCode || 500).json({
    success: false,
    status: 'error',
    error: {
      id: errorId,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      isOperational: err.isOperational
    },
    request: {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    }
  });
};

// Production error response
const sendErrorProd = (err, req, res) => {
  const errorId = uuidv4();
  
  // Log error details for debugging
  console.error(`Error ID: ${errorId}`, {
    message: err.message,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    request: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      success: false,
      status: 'error',
      message: err.message,
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  } else {
    // Programming or other unknown error: don't leak error details
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Something went wrong on our end. Please try again later.',
      errorId: errorId,
      timestamp: new Date().toISOString()
    });
  }
};

// Handle specific error types
const handleDatabaseError = (err) => {
  let message = 'Database operation failed';
  let statusCode = 500;

  // PostgreSQL specific error codes
  if (err.code === '23505') {
    message = 'Duplicate entry. This record already exists.';
    statusCode = 409;
  } else if (err.code === '23503') {
    message = 'Referenced record does not exist.';
    statusCode = 400;
  } else if (err.code === '23502') {
    message = 'Required field is missing.';
    statusCode = 400;
  } else if (err.code === '42P01') {
    message = 'Database table does not exist.';
    statusCode = 500;
  }

  return new APIError(message, statusCode);
};

const handleValidationError = (err) => {
  const message = `Invalid input data: ${err.message}`;
  return new APIError(message, 400);
};

const handleMulterError = (err) => {
  let message = 'File upload failed';
  let statusCode = 400;

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File size exceeds the maximum limit of 50MB';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    message = 'Too many files uploaded';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Unexpected file field';
  } else if (err.code === 'INVALID_FILE_TYPE') {
    message = 'Invalid file type. Only PDF files are allowed.';
  }

  return new APIError(message, statusCode);
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = handleValidationError(error);
  } else if (err.code && err.code.startsWith('23')) {
    error = handleDatabaseError(error);
  } else if (err.name === 'MulterError' || err.code === 'INVALID_FILE_TYPE') {
    error = handleMulterError(error);
  } else if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new APIError(message, 400);
  } else if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token';
    error = new APIError(message, 401);
  } else if (err.name === 'TokenExpiredError') {
    const message = 'Authentication token has expired';
    error = new APIError(message, 401);
  }

  // Ensure error has proper structure
  if (!error.statusCode) {
    error.statusCode = 500;
  }
  if (!error.isOperational) {
    error.isOperational = false;
  }

  // Send error response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

// Handle 404 errors
const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  const error = new APIError(message, 404);
  next(error);
};

// Handle unhandled promise rejections
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Close server & exit process
    process.exit(1);
  });
};

// Handle uncaught exceptions
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
    process.exit(1);
  });
};

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
};