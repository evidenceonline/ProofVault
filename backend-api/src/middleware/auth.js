/**
 * Authentication Middleware
 * 
 * Handles API key validation and user authentication
 * for ProofVault Backend API endpoints.
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Optional authentication middleware
 * Validates API key or JWT token if present
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.get('Authorization');
    const apiKey = req.get('X-API-Key');
    const userAddress = req.get('X-User-Address');

    // If no auth headers present, continue without authentication
    if (!authHeader && !apiKey && !userAddress) {
      return next();
    }

    // Handle JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        logger.debug('JWT authentication successful', { userId: decoded.id });
      } catch (jwtError) {
        logger.warn('Invalid JWT token:', jwtError.message);
        // Continue without auth for optional middleware
      }
    }

    // Handle API key
    if (apiKey) {
      // TODO: Implement API key validation against database
      logger.debug('API key provided', { keyHash: apiKey.substring(0, 8) + '...' });
      req.apiKey = apiKey;
    }

    // Handle user address
    if (userAddress) {
      req.userAddress = userAddress;
      logger.debug('User address provided', { address: userAddress.substring(0, 16) + '...' });
    }

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    next(); // Continue without auth for optional middleware
  }
}

/**
 * Required authentication middleware
 * Requires valid authentication to proceed
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.get('Authorization');
    const apiKey = req.get('X-API-Key');

    // Check for authentication
    if (!authHeader && !apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Provide Authorization header with Bearer token or X-API-Key header'
      });
    }

    // Handle JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        logger.debug('JWT authentication successful', { userId: decoded.id });
        return next();
      } catch (jwtError) {
        logger.warn('Invalid JWT token:', jwtError.message);
        return res.status(401).json({
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
          message: 'The provided JWT token is invalid or expired'
        });
      }
    }

    // Handle API key
    if (apiKey) {
      // TODO: Implement API key validation against database
      // For now, accept any API key for development
      if (apiKey.length < 16) {
        return res.status(401).json({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
          message: 'The provided API key is invalid'
        });
      }

      req.apiKey = apiKey;
      logger.debug('API key authentication successful');
      return next();
    }

    return res.status(401).json({
      error: 'Invalid authentication',
      code: 'INVALID_AUTH',
      message: 'No valid authentication method provided'
    });

  } catch (error) {
    logger.error('Required authentication error:', error);
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
      message: error.message
    });
  }
}

/**
 * Generate JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      address: user.address,
      type: 'user'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'proofvault-api',
      audience: 'proofvault-client'
    }
  );
}

/**
 * Generate API key for user
 */
function generateApiKey() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate Constellation Network address format
 */
function validateAddress(address) {
  // Basic validation - should be enhanced with proper DAG address validation
  return typeof address === 'string' && 
         address.length >= 40 && 
         /^[A-Za-z0-9]+$/.test(address);
}

module.exports = {
  optionalAuth,
  requireAuth,
  generateToken,
  generateApiKey,
  validateAddress
};