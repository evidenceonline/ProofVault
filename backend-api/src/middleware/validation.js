/**
 * Validation Middleware
 * 
 * Common validation utilities and middleware for ProofVault Backend API.
 */

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Handle validation results middleware
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      url: req.url,
      method: req.method,
      errors: errors.array()
    });

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
      timestamp: new Date().toISOString()
    });
  }

  next();
}

/**
 * Validate hash format (SHA-256)
 */
function isValidHash(value) {
  return typeof value === 'string' && 
         value.length === 64 && 
         /^[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Validate Constellation Network address
 */
function isValidAddress(value) {
  return typeof value === 'string' && 
         value.length >= 40 && 
         /^[A-Za-z0-9]+$/.test(value);
}

/**
 * Validate UUID format
 */
function isValidUUID(value) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && uuidRegex.test(value);
}

/**
 * Validate URL format
 */
function isValidURL(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ISO8601 date format
 */
function isValidISO8601(value) {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return typeof value === 'string' && iso8601Regex.test(value) && !isNaN(Date.parse(value));
}

/**
 * Validate base64 encoded data
 */
function isValidBase64(value) {
  try {
    return typeof value === 'string' && 
           Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

/**
 * Sanitize string input
 */
function sanitizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') {
    return '';
  }
  
  return value.trim().substring(0, maxLength);
}

/**
 * Validate and sanitize metadata object
 */
function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { isValid: false, error: 'Metadata must be an object' };
  }

  const maxKeys = 50;
  const maxKeyLength = 100;
  const maxValueLength = 1000;

  const keys = Object.keys(metadata);
  
  if (keys.length > maxKeys) {
    return { isValid: false, error: `Metadata cannot have more than ${maxKeys} keys` };
  }

  for (const key of keys) {
    if (key.length > maxKeyLength) {
      return { isValid: false, error: `Metadata key too long: ${key}` };
    }

    const value = metadata[key];
    if (typeof value === 'string' && value.length > maxValueLength) {
      return { isValid: false, error: `Metadata value too long for key: ${key}` };
    }
  }

  return { isValid: true };
}

/**
 * Create custom validator for express-validator
 */
function createCustomValidator(validatorFn, errorMessage) {
  return (value) => {
    if (!validatorFn(value)) {
      throw new Error(errorMessage);
    }
    return true;
  };
}

module.exports = {
  handleValidationErrors,
  isValidHash,
  isValidAddress,
  isValidUUID,
  isValidURL,
  isValidISO8601,
  isValidBase64,
  sanitizeString,
  validateMetadata,
  createCustomValidator
};