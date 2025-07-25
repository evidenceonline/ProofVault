/**
 * Enhanced Error Handler Middleware
 * 
 * Global error handling middleware for ProofVault Backend API with comprehensive
 * error categorization, monitoring, and standardized responses.
 */

const logger = require('../utils/logger');
const { 
  ProofVaultError, 
  ErrorFactory, 
  getErrorCategory, 
  getErrorSeverity,
  ErrorSeverity 
} = require('../types/errors');

// Error metrics for monitoring
const errorMetrics = {
  totalErrors: 0,
  errorsByCategory: new Map(),
  errorsBySeverity: new Map(),
  errorsByCode: new Map(),
  recentErrors: [] // Keep last 100 errors for analysis
};

// Rate limiting for error notifications (prevent spam)
const errorNotificationLimiter = new Map();

/**
 * Enhanced global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Convert to standardized error format
  let standardizedError;
  
  if (err instanceof ProofVaultError) {
    standardizedError = err;
  } else if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violations
    standardizedError = ErrorFactory.createFromDatabaseError(err);
  } else if (err.isAxiosError) {
    // Axios/HTTP errors
    standardizedError = ErrorFactory.createFromAxiosError(err);
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    // Multer file size error
    const { FileProcessingError } = require('../types/errors');
    standardizedError = new FileProcessingError('File size exceeds maximum limit', {
      maxSize: process.env.MAX_FILE_SIZE || '10MB',
      actualSize: err.field
    });
  } else {
    // Generic error - wrap in ProofVaultError
    standardizedError = new ProofVaultError(
      err.message || 'Internal server error',
      err.code || 'INTERNAL_ERROR',
      err.statusCode || 500,
      err.details || {}
    );
  }

  // Determine error category and severity
  const category = getErrorCategory(standardizedError);
  const severity = getErrorSeverity(standardizedError);
  
  // Update error metrics
  updateErrorMetrics(standardizedError, category, severity);
  
  // Create comprehensive error context
  const errorContext = {
    errorId: generateErrorId(),
    error: {
      name: standardizedError.name,
      message: standardizedError.message,
      code: standardizedError.code,
      category,
      severity,
      retryable: standardizedError.retryable,
      statusCode: standardizedError.statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      requestId: req.id || 'unknown',
      userId: req.user?.id,
      userAddress: req.user?.address
    },
    timestamp: standardizedError.timestamp,
    details: standardizedError.details || {}
  };

  // Log error with appropriate level based on severity
  logError(standardizedError, errorContext, severity);
  
  // Send alert for critical errors
  if (severity === ErrorSeverity.CRITICAL) {
    sendCriticalErrorAlert(errorContext);
  }
  
  // Prepare response
  const response = {
    success: false,
    error: {
      message: standardizedError.message,
      code: standardizedError.code,
      category,
      timestamp: standardizedError.timestamp,
      requestId: errorContext.request.requestId,
      errorId: errorContext.errorId
    }
  };
  
  // Add details if available (but sanitize sensitive information)
  if (standardizedError.details && Object.keys(standardizedError.details).length > 0) {
    response.error.details = sanitizeErrorDetails(standardizedError.details);
  }
  
  // Add retry information for retryable errors
  if (standardizedError.retryable) {
    response.error.retryable = true;
    if (standardizedError.details?.retryAfter) {
      response.error.retryAfter = standardizedError.details.retryAfter;
    }
  }
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = standardizedError.stack;
    response.error.originalError = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }
  
  // Set appropriate headers
  if (standardizedError.code === 'RATE_LIMIT_EXCEEDED' && standardizedError.details?.retryAfter) {
    res.set('Retry-After', standardizedError.details.retryAfter);
  }
  
  if (standardizedError.retryable) {
    res.set('X-Retryable', 'true');
  }
  
  // Send error response
  res.status(standardizedError.statusCode).json(response);
}

/**
 * Update error metrics for monitoring
 */
function updateErrorMetrics(error, category, severity) {
  errorMetrics.totalErrors++;
  
  // Update category count
  const categoryCount = errorMetrics.errorsByCategory.get(category) || 0;
  errorMetrics.errorsByCategory.set(category, categoryCount + 1);
  
  // Update severity count
  const severityCount = errorMetrics.errorsBySeverity.get(severity) || 0;
  errorMetrics.errorsBySeverity.set(severity, severityCount + 1);
  
  // Update error code count
  const codeCount = errorMetrics.errorsByCode.get(error.code) || 0;
  errorMetrics.errorsByCode.set(error.code, codeCount + 1);
  
  // Add to recent errors (keep last 100)
  errorMetrics.recentErrors.unshift({
    timestamp: error.timestamp,
    code: error.code,
    category,
    severity,
    message: error.message
  });
  
  if (errorMetrics.recentErrors.length > 100) {
    errorMetrics.recentErrors = errorMetrics.recentErrors.slice(0, 100);
  }
}

/**
 * Log error with appropriate level
 */
function logError(error, context, severity) {
  const logData = {
    ...context,
    performance: {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };
  
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('CRITICAL ERROR', logData);
      break;
    case ErrorSeverity.HIGH:
      logger.error('High severity error', logData);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn('Medium severity error', logData);
      break;
    case ErrorSeverity.LOW:
    default:
      logger.info('Low severity error', logData);
      break;
  }
}

/**
 * Send alert for critical errors (implement based on your alerting system)
 */
function sendCriticalErrorAlert(errorContext) {
  const alertKey = `${errorContext.error.code}_${errorContext.request.url}`;
  const now = Date.now();
  const lastAlert = errorNotificationLimiter.get(alertKey);
  
  // Rate limit: only send alert once per 5 minutes for same error type
  if (lastAlert && (now - lastAlert) < 300000) {
    return;
  }
  
  errorNotificationLimiter.set(alertKey, now);
  
  // TODO: Implement your alerting system here
  // Examples: Slack, PagerDuty, Email, SMS, etc.
  logger.error('CRITICAL ERROR ALERT', {
    ...errorContext,
    alert: 'This is a critical error that requires immediate attention'
  });
  
  // Clean up old rate limit entries (prevent memory leak)
  for (const [key, timestamp] of errorNotificationLimiter.entries()) {
    if (now - timestamp > 300000) {
      errorNotificationLimiter.delete(key);
    }
  }
}

/**
 * Sanitize error details to prevent sensitive information leakage
 */
function sanitizeErrorDetails(details) {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  const sanitized = { ...details };
  
  function sanitizeObject(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  }
  
  sanitizeObject(sanitized);
  return sanitized;
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Get error metrics for monitoring dashboard
 */
function getErrorMetrics() {
  return {
    ...errorMetrics,
    errorsByCategory: Object.fromEntries(errorMetrics.errorsByCategory),
    errorsBySeverity: Object.fromEntries(errorMetrics.errorsBySeverity),
    errorsByCode: Object.fromEntries(errorMetrics.errorsByCode)
  };
}

/**
 * Reset error metrics (useful for testing)
 */
function resetErrorMetrics() {
  errorMetrics.totalErrors = 0;
  errorMetrics.errorsByCategory.clear();
  errorMetrics.errorsBySeverity.clear();
  errorMetrics.errorsByCode.clear();
  errorMetrics.recentErrors = [];
}

module.exports = {
  errorHandler,
  getErrorMetrics,
  resetErrorMetrics
};