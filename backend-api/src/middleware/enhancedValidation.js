/**
 * Enhanced Validation Middleware
 * 
 * Comprehensive validation utilities and middleware for ProofVault Backend API
 * with advanced sanitization, rate limiting, and security features.
 */

const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const logger = require('../utils/logger');
const { ValidationError, SecurityError } = require('../types/errors');

// Import existing validation functions
const {
  isValidHash,
  isValidAddress,
  isValidUUID,
  isValidURL,
  isValidISO8601,
  isValidBase64
} = require('./validation');

/**
 * Enhanced validation results handler with detailed error mapping
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const validationDetails = {
      fieldErrors: {},
      generalErrors: [],
      totalErrors: errorArray.length
    };
    
    // Organize errors by field for better client handling
    errorArray.forEach(error => {
      if (error.path) {
        if (!validationDetails.fieldErrors[error.path]) {
          validationDetails.fieldErrors[error.path] = [];
        }
        validationDetails.fieldErrors[error.path].push({
          message: error.msg,
          value: error.value,
          type: error.type || 'validation'
        });
      } else {
        validationDetails.generalErrors.push({
          message: error.msg,
          type: error.type || 'validation'
        });
      }
    });
    
    logger.warn('Validation errors:', {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      errors: validationDetails,
      body: sanitizeRequestData(req.body),
      query: sanitizeRequestData(req.query)
    });

    const validationError = new ValidationError('Request validation failed', validationDetails);
    return next(validationError);
  }

  next();
}

/**
 * Advanced string sanitization with security features
 */
function sanitizeString(value, options = {}) {
  if (typeof value !== 'string') {
    return '';
  }
  
  const {
    maxLength = 1000,
    allowHtml = false,
    stripWhitespace = true,
    normalizeUnicode = true,
    preventXSS = true
  } = options;
  
  let sanitized = value;
  
  // Normalize Unicode
  if (normalizeUnicode) {
    sanitized = sanitized.normalize('NFC');
  }
  
  // Strip or preserve whitespace
  if (stripWhitespace) {
    sanitized = sanitized.trim();
  }
  
  // XSS prevention
  if (preventXSS && !allowHtml) {
    // Remove potentially dangerous characters and patterns
    sanitized = sanitized.replace(/[<>\"'&]/g, (match) => {
      const entityMap = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entityMap[match];
    });
    
    // Remove javascript: and other dangerous protocols
    sanitized = sanitized.replace(/(javascript|vbscript|data|file):/gi, '');
    
    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  }
  
  // Apply length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize request data recursively
 */
function sanitizeRequestData(data, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]'; // Prevent deep recursion attacks
  
  if (typeof data === 'string') {
    return sanitizeString(data, { maxLength: 10000 });
  }
  
  if (Array.isArray(data)) {
    return data.slice(0, 100).map(item => sanitizeRequestData(item, depth + 1));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    const keys = Object.keys(data).slice(0, 50); // Limit object keys
    
    for (const key of keys) {
      const sanitizedKey = sanitizeString(key, { maxLength: 100 });
      sanitized[sanitizedKey] = sanitizeRequestData(data[key], depth + 1);
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * Enhanced metadata validation with security and structure checks
 */
function validateMetadata(metadata, options = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { isValid: false, error: 'Metadata must be a valid object' };
  }

  const {
    maxKeys = 50,
    maxKeyLength = 100,
    maxValueLength = 1000,
    maxNestedDepth = 3,
    allowedTypes = ['string', 'number', 'boolean'],
    requiredKeys = [],
    forbiddenKeys = ['__proto__', 'constructor', 'prototype']
  } = options;

  const keys = Object.keys(metadata);
  
  if (keys.length > maxKeys) {
    return { isValid: false, error: `Metadata cannot have more than ${maxKeys} keys` };
  }
  
  // Check required keys
  for (const requiredKey of requiredKeys) {
    if (!keys.includes(requiredKey)) {
      return { isValid: false, error: `Missing required metadata key: ${requiredKey}` };
    }
  }

  // Validate each key-value pair
  for (const key of keys) {
    // Check forbidden keys (security)
    if (forbiddenKeys.includes(key)) {
      return { isValid: false, error: `Forbidden metadata key: ${key}` };
    }
    
    // Validate key length
    if (key.length > maxKeyLength) {
      return { isValid: false, error: `Metadata key too long: ${key.substring(0, 50)}...` };
    }
    
    // Validate key format (no special characters that could cause issues)
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) {
      return { isValid: false, error: `Invalid metadata key format: ${key}` };
    }

    const value = metadata[key];
    const valueType = typeof value;
    
    // Check allowed types
    if (!allowedTypes.includes(valueType) && value !== null) {
      return { isValid: false, error: `Invalid type for metadata key '${key}': ${valueType}` };
    }
    
    // Validate string values
    if (valueType === 'string') {
      if (value.length > maxValueLength) {
        return { isValid: false, error: `Metadata value too long for key '${key}'` };
      }
      
      // Check for potentially dangerous strings
      if (value.includes('<script') || value.includes('javascript:') || value.includes('vbscript:')) {
        return { isValid: false, error: `Potentially dangerous content in metadata key '${key}'` };
      }
    }
    
    // Validate number values
    if (valueType === 'number') {
      if (!Number.isFinite(value)) {
        return { isValid: false, error: `Invalid number value for metadata key '${key}'` };
      }
    }
  }

  return { isValid: true, sanitized: sanitizeMetadata(metadata) };
}

/**
 * Sanitize metadata object
 */
function sanitizeMetadata(metadata) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const sanitizedKey = sanitizeString(key, { maxLength: 100, preventXSS: true });
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value, { maxLength: 1000, preventXSS: true });
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
}

/**
 * Enhanced custom validator factory with async support
 */
function createCustomValidator(validatorFn, errorMessage, options = {}) {
  const { async = false, sanitize = true } = options;
  
  if (async) {
    return async (value, { req, location, path }) => {
      try {
        const isValid = await validatorFn(value, { req, location, path });
        if (!isValid) {
          throw new Error(errorMessage);
        }
        return true;
      } catch (error) {
        throw new Error(error.message || errorMessage);
      }
    };
  }
  
  return (value, { req, location, path }) => {
    try {
      let processedValue = value;
      
      // Sanitize if requested and value is string
      if (sanitize && typeof value === 'string') {
        processedValue = sanitizeString(value);
      }
      
      const isValid = validatorFn(processedValue, { req, location, path });
      if (!isValid) {
        throw new Error(errorMessage);
      }
      return true;
    } catch (error) {
      throw new Error(error.message || errorMessage);
    }
  };
}

/**
 * Advanced file validation
 */
function validateFileUpload(file, options = {}) {
  const {
    allowedMimes = ['application/pdf'],
    maxSize = 10 * 1024 * 1024, // 10MB
    minSize = 100, // 100 bytes
    allowedExtensions = ['.pdf'],
    requireSignature = false
  } = options;
  
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds maximum limit of ${Math.round(maxSize / 1024 / 1024)}MB`);
  }
  
  if (file.size < minSize) {
    errors.push(`File size below minimum limit of ${minSize} bytes`);
  }
  
  // Check MIME type
  if (!allowedMimes.includes(file.mimetype)) {
    errors.push(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`);
  }
  
  // Check file extension
  const fileExtension = file.originalname.toLowerCase().match(/\.[^.]+$/);
  if (!fileExtension || !allowedExtensions.includes(fileExtension[0])) {
    errors.push(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`);
  }
  
  // Check for potentially dangerous filenames
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    errors.push('Invalid filename: contains dangerous characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedFilename: sanitizeFilename(file.originalname)
  };
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^[._]+|[._]+$/g, '') // Remove leading/trailing dots and underscores
    .substring(0, 255); // Limit length
}

/**
 * Rate limiting middleware factory
 */
function createRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // requests per window
    message = 'Too many requests from this IP',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    keyGenerator,
    skipSuccessfulRequests,
    skipFailedRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const error = new ValidationError(message, {
        retryAfter: Math.ceil(windowMs / 1000),
        limit: max,
        window: windowMs
      });
      error.statusCode = 429;
      throw error;
    }
  });
}

/**
 * Security validation middleware
 */
function validateSecurity(req, res, next) {
  const suspiciousPatterns = [
    /\b(eval|exec|system|shell_exec|passthru)\s*\(/i,
    /<script[^>]*>.*?<\/script>/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /on\w+\s*=/i,
    /\.\.\//g,
    /\bSELECT\b.*\bFROM\b/i,
    /\bUNION\b.*\bSELECT\b/i,
    /\bINSERT\b.*\bINTO\b/i,
    /\bDELETE\b.*\bFROM\b/i,
    /\bUPDATE\b.*\bSET\b/i
  ];
  
  const checkValue = (value, key = 'unknown') => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          logger.warn('Security violation detected:', {
            key,
            value: value.substring(0, 100),
            pattern: pattern.toString(),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url
          });
          
          throw new SecurityError('Potentially malicious content detected', {
            field: key,
            reason: 'Suspicious pattern matched'
          });
        }
      }
    }
  };
  
  const checkObject = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        checkValue(value, fullKey);
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value, fullKey);
      }
    }
  };
  
  try {
    // Check query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      checkObject(req.query, 'query');
    }
    
    // Check request body
    if (req.body && Object.keys(req.body).length > 0) {
      checkObject(req.body, 'body');
    }
    
    // Check headers for suspicious content
    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || '';
    
    checkValue(userAgent, 'userAgent');
    checkValue(referer, 'referer');
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Request size limiting middleware
 */
function limitRequestSize(options = {}) {
  const { maxBodySize = '10mb', maxQueryParams = 50, maxHeaders = 100 } = options;
  
  return (req, res, next) => {
    try {
      // Check query parameter count
      if (req.query && Object.keys(req.query).length > maxQueryParams) {
        throw new ValidationError(`Too many query parameters. Maximum allowed: ${maxQueryParams}`);
      }
      
      // Check header count
      if (req.headers && Object.keys(req.headers).length > maxHeaders) {
        throw new ValidationError(`Too many headers. Maximum allowed: ${maxHeaders}`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  handleValidationErrors,
  sanitizeString,
  sanitizeRequestData,
  validateMetadata,
  sanitizeMetadata,
  createCustomValidator,
  validateFileUpload,
  sanitizeFilename,
  createRateLimit,
  validateSecurity,
  limitRequestSize,
  
  // Re-export existing validators
  isValidHash,
  isValidAddress,
  isValidUUID,
  isValidURL,
  isValidISO8601,
  isValidBase64
};