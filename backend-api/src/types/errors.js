/**
 * Standardized Error Types for ProofVault Backend API
 * 
 * Defines all custom error classes with consistent structure and categorization
 * for proper handling throughout the application.
 */

/**
 * Base ProofVault Error class with enhanced error metadata
 */
class ProofVaultError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.retryable = false;
    
    // Capture stack trace, excluding this constructor
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

/**
 * Validation Error - for input validation failures
 */
class ValidationError extends ProofVaultError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.retryable = false;
  }
}

/**
 * Authentication Error - for authentication failures
 */
class AuthenticationError extends ProofVaultError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_REQUIRED', 401);
    this.retryable = false;
  }
}

/**
 * Authorization Error - for authorization failures
 */
class AuthorizationError extends ProofVaultError {
  constructor(message = 'Access denied') {
    super(message, 'ACCESS_DENIED', 403);
    this.retryable = false;
  }
}

/**
 * Resource Not Found Error
 */
class NotFoundError extends ProofVaultError {
  constructor(resource = 'Resource', identifier = '') {
    const message = identifier 
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, 'RESOURCE_NOT_FOUND', 404, { resource, identifier });
    this.retryable = false;
  }
}

/**
 * Resource Conflict Error - for duplicate resources or constraint violations
 */
class ConflictError extends ProofVaultError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 'RESOURCE_CONFLICT', 409, details);
    this.retryable = false;
  }
}

/**
 * Rate Limiting Error
 */
class RateLimitError extends ProofVaultError {
  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
    this.retryable = true;
  }
}

/**
 * File Processing Error - for PDF and file handling issues
 */
class FileProcessingError extends ProofVaultError {
  constructor(message = 'File processing failed', details = {}) {
    super(message, 'FILE_PROCESSING_ERROR', 422, details);
    this.retryable = false;
  }
}

/**
 * Database Error - for database operation failures
 */
class DatabaseError extends ProofVaultError {
  constructor(message = 'Database operation failed', details = {}, retryable = false) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.retryable = retryable;
  }
}

/**
 * Blockchain Communication Error - for metagraph/blockchain failures
 */
class BlockchainError extends ProofVaultError {
  constructor(message = 'Blockchain operation failed', category = 'UNKNOWN', attempts = [], retryable = false) {
    super(message, 'BLOCKCHAIN_ERROR', 503, { category, attempts });
    this.retryable = retryable;
    this.category = category;
    this.attempts = attempts;
  }
  
  static fromMetagraphError(metagraphError) {
    return new BlockchainError(
      metagraphError.message,
      metagraphError.category || 'UNKNOWN',
      metagraphError.attempts || [],
      metagraphError.retryable || false
    );
  }
}

/**
 * External Service Error - for third-party service failures
 */
class ExternalServiceError extends ProofVaultError {
  constructor(service = 'External service', message = 'Service unavailable', retryable = true) {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 503, { service });
    this.retryable = retryable;
  }
}

/**
 * Circuit Breaker Error - when circuit breaker is open
 */
class CircuitBreakerError extends ProofVaultError {
  constructor(service = 'Service', retryAfter = 30) {
    super(`Circuit breaker open for ${service}`, 'CIRCUIT_BREAKER_OPEN', 503, { service, retryAfter });
    this.retryable = true;
  }
}

/**
 * Timeout Error - for operation timeouts
 */
class TimeoutError extends ProofVaultError {
  constructor(operation = 'Operation', timeoutMs = 0) {
    super(`${operation} timed out after ${timeoutMs}ms`, 'OPERATION_TIMEOUT', 408, { operation, timeoutMs });
    this.retryable = true;
  }
}

/**
 * Configuration Error - for missing or invalid configuration
 */
class ConfigurationError extends ProofVaultError {
  constructor(message = 'Configuration error') {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.retryable = false;
  }
}

/**
 * Integrity Error - for data integrity violations
 */
class IntegrityError extends ProofVaultError {
  constructor(message = 'Data integrity violation', details = {}) {
    super(message, 'DATA_INTEGRITY_ERROR', 422, details);
    this.retryable = false;
  }
}

/**
 * Security Error - for security-related issues
 */
class SecurityError extends ProofVaultError {
  constructor(message = 'Security violation detected', details = {}) {
    super(message, 'SECURITY_VIOLATION', 403, details);
    this.retryable = false;
  }
}

/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
  static createFromAxiosError(error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new ExternalServiceError('Network', 'Connection refused', true);
    }
    
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return new TimeoutError('Network request', error.timeout || 0);
    }
    
    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message || error.message;
    
    switch (status) {
      case 400:
        return new ValidationError(message, data?.details);
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 404:
        return new NotFoundError('Resource', data?.identifier);
      case 409:
        return new ConflictError(message, data?.details);
      case 429:
        return new RateLimitError(message, data?.retryAfter);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ExternalServiceError('Remote service', message, true);
      default:
        return new ProofVaultError(message, 'EXTERNAL_ERROR', status || 500);
    }
  }
  
  static createFromDatabaseError(error) {
    const code = error.code;
    const message = error.message;
    
    // PostgreSQL error codes
    switch (code) {
      case '23505': // unique_violation
        return new ConflictError('Duplicate record detected', { constraint: error.constraint });
      case '23503': // foreign_key_violation
        return new ValidationError('Referenced record does not exist', { constraint: error.constraint });
      case '23502': // not_null_violation
        return new ValidationError('Required field missing', { column: error.column });
      case '23514': // check_violation
        return new ValidationError('Data constraint violation', { constraint: error.constraint });
      case '42601': // syntax_error
        return new ProofVaultError('Database query error', 'DATABASE_SYNTAX_ERROR', 500);
      case '53300': // too_many_connections
        return new DatabaseError('Database connection limit exceeded', { code }, true);
      case '57014': // query_canceled
        return new TimeoutError('Database query', 0);
      case '08006': // connection_failure
      case '08001': // sqlclient_unable_to_establish_sqlconnection
        return new DatabaseError('Database connection failed', { code }, true);
      default:
        const retryable = ['08', '53', '54', '57', '58'].some(prefix => code?.startsWith(prefix));
        return new DatabaseError(message, { code }, retryable);
    }
  }
}

/**
 * Error categorization for monitoring and alerting
 */
const ErrorCategories = {
  CLIENT_ERROR: 'client_error',      // 4xx errors - client's fault
  SERVER_ERROR: 'server_error',      // 5xx errors - our fault
  NETWORK_ERROR: 'network_error',    // Network connectivity issues
  EXTERNAL_ERROR: 'external_error',  // Third-party service issues
  SECURITY_ERROR: 'security_error',  // Security violations
  DATA_ERROR: 'data_error'          // Data integrity/validation issues
};

/**
 * Error severity levels for logging and alerting
 */
const ErrorSeverity = {
  LOW: 'low',           // Non-critical errors, expected failures
  MEDIUM: 'medium',     // Important errors that need attention
  HIGH: 'high',         // Critical errors affecting functionality
  CRITICAL: 'critical'  // System-threatening errors requiring immediate attention
};

/**
 * Get error category based on error type
 */
function getErrorCategory(error) {
  if (error instanceof ValidationError || error instanceof AuthenticationError || 
      error instanceof AuthorizationError || error instanceof NotFoundError) {
    return ErrorCategories.CLIENT_ERROR;
  }
  
  if (error instanceof SecurityError) {
    return ErrorCategories.SECURITY_ERROR;
  }
  
  if (error instanceof DatabaseError || error instanceof IntegrityError) {
    return ErrorCategories.DATA_ERROR;
  }
  
  if (error instanceof BlockchainError || error instanceof ExternalServiceError) {
    return ErrorCategories.EXTERNAL_ERROR;
  }
  
  if (error instanceof TimeoutError || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return ErrorCategories.NETWORK_ERROR;
  }
  
  return ErrorCategories.SERVER_ERROR;
}

/**
 * Get error severity based on error type and context
 */
function getErrorSeverity(error) {
  if (error instanceof SecurityError) {
    return ErrorSeverity.CRITICAL;
  }
  
  if (error instanceof DatabaseError || error instanceof ConfigurationError) {
    return ErrorSeverity.HIGH;
  }
  
  if (error instanceof BlockchainError || error instanceof ExternalServiceError) {
    return ErrorSeverity.MEDIUM;
  }
  
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    return ErrorSeverity.LOW;
  }
  
  // Default based on status code
  if (error.statusCode >= 500) {
    return ErrorSeverity.HIGH;
  } else if (error.statusCode >= 400) {
    return ErrorSeverity.LOW;
  }
  
  return ErrorSeverity.MEDIUM;
}

module.exports = {
  // Error classes
  ProofVaultError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  FileProcessingError,
  DatabaseError,
  BlockchainError,
  ExternalServiceError,
  CircuitBreakerError,
  TimeoutError,
  ConfigurationError,
  IntegrityError,
  SecurityError,
  
  // Utilities
  ErrorFactory,
  ErrorCategories,
  ErrorSeverity,
  getErrorCategory,
  getErrorSeverity
};