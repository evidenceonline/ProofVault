/**
 * Logging Middleware
 * 
 * Custom request logging and tracking middleware for ProofVault Backend API.
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Request logging and tracking middleware
 */
function loggingMiddleware(req, res, next) {
  // Generate unique request ID
  req.id = uuidv4();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Track request start time
  req.startTime = Date.now();

  // Extract useful request information
  const requestInfo = {
    id: req.id,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    extensionVersion: req.get('X-Extension-Version'),
    userAddress: req.get('X-User-Address')
  };

  // Log request start (debug level to avoid spam)
  logger.debug('Request started', requestInfo);

  // Override res.json to capture response data
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - req.startTime;
    
    // Log response information
    const responseInfo = {
      id: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      contentLength: JSON.stringify(data).length
    };

    // Log at different levels based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseInfo);
    } else {
      logger.info('Request completed successfully', responseInfo);
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  // Override res.send to capture non-JSON responses
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    
    const responseInfo = {
      id: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      contentLength: data ? data.length : 0
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseInfo);
    } else {
      logger.info('Request completed successfully', responseInfo);
    }

    return originalSend.call(this, data);
  };

  // Handle request errors
  res.on('error', (error) => {
    logger.error('Response error', {
      id: req.id,
      method: req.method,
      url: req.url,
      error: error.message,
      stack: error.stack
    });
  });

  next();
}

/**
 * Audit logging middleware for sensitive operations
 */
function auditLogMiddleware(action, resourceType) {
  return (req, res, next) => {
    const auditInfo = {
      requestId: req.id,
      action,
      resourceType,
      actorIp: req.ip,
      actorUserAgent: req.get('User-Agent'),
      actorAddress: req.get('X-User-Address'),
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
    };

    // Override response methods to capture the outcome
    const originalJson = res.json;
    res.json = function(data) {
      auditInfo.statusCode = res.statusCode;
      auditInfo.success = res.statusCode < 400;
      auditInfo.responseTime = Date.now() - req.startTime;

      // Log audit trail
      logger.info('Audit log', auditInfo);

      // TODO: Store in audit_logs table
      
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Performance monitoring middleware
 */
function performanceMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  
  // Override response methods to measure performance
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Log slow requests
    if (responseTime > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        id: req.id,
        method: req.method,
        url: req.url,
        responseTime,
        statusCode: res.statusCode
      });
    }

    // Track performance metrics
    if (process.env.ENABLE_METRICS === 'true') {
      // TODO: Send metrics to monitoring system
      logger.debug('Performance metric', {
        endpoint: `${req.method} ${req.path}`,
        responseTime,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }

    return originalJson.call(this, data);
  };

  next();
}

module.exports = {
  loggingMiddleware,
  auditLogMiddleware,
  performanceMiddleware
};