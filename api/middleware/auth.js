const crypto = require('crypto');

const base64UrlToBase64 = (input) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = 4 - (normalized.length % 4);
  return padding === 4 ? normalized : normalized + '='.repeat(padding);
};

const base64UrlDecode = (input) => {
  const padded = base64UrlToBase64(input);
  return Buffer.from(padded, 'base64').toString('utf8');
};

const verifyJwt = (token, secret) => {
  const segments = token.split('.');

  if (segments.length !== 3) {
    throw new Error('Token structure incorrect');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const header = JSON.parse(base64UrlDecode(encodedHeader));

  if (header.alg !== 'HS256') {
    throw new Error('Unsupported JWT algorithm');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const providedSignature = Buffer.from(base64UrlToBase64(signature), 'base64');
  const expectedBuffer = Buffer.from(base64UrlToBase64(expectedSignature), 'base64');

  if (
    providedSignature.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedSignature, expectedBuffer)
  ) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }

  return payload;
};

const parseApiKeys = () => {
  const raw = process.env.API_KEYS || '';

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [role, key] = entry.split(':');

      if (key) {
        return {
          role: role.trim(),
          key: key.trim()
        };
      }

      return {
        role: (process.env.DEFAULT_API_KEY_ROLE || 'service').trim(),
        key: role.trim()
      };
    });
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set.');
      return res.status(500).json({
        success: false,
        message: 'Authentication misconfigured on server'
      });
    }

    try {
      const decoded = verifyJwt(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      console.warn('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token'
      });
    }
  }

  if (apiKeyHeader) {
    const configuredKeys = parseApiKeys();
    const matchedKey = configuredKeys.find(({ key }) => key === apiKeyHeader);

    if (matchedKey) {
      req.user = {
        role: matchedKey.role,
        roles: [matchedKey.role],
        authStrategy: 'api-key'
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid API key provided'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Authentication credentials were not provided'
  });
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.length) {
      return next();
    }

    const user = req.user;

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: authentication required'
      });
    }

    const userRoles = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];

    const hasRole = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }

    return next();
  };
};

module.exports = {
  authenticate,
  authorizeRoles
};
