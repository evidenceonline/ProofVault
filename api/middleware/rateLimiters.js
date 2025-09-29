const createRateLimiter = ({ windowMs, max, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const limitInfo = hits.get(key) || { count: 0, startTime: now };

    if (now - limitInfo.startTime >= windowMs) {
      limitInfo.count = 0;
      limitInfo.startTime = now;
    }

    limitInfo.count += 1;
    hits.set(key, limitInfo);

    if (limitInfo.count === 1) {
      const timeout = setTimeout(() => {
        const record = hits.get(key);

        if (record && record.startTime === limitInfo.startTime) {
          hits.delete(key);
        }
      }, windowMs);

      if (typeof timeout.unref === 'function') {
        timeout.unref();
      }
    }

    const resetTime = limitInfo.startTime + windowMs;
    const remaining = Math.max(0, max - limitInfo.count);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(resetTime / 1000)));

    if (limitInfo.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((resetTime - now) / 1000)));
      return res.status(429).json(message);
    }

    return next();
  };
};

const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Upload rate limit exceeded. Please wait before uploading more files.'
  }
});

const deleteRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Delete rate limit exceeded. Please contact an administrator if this persists.'
  }
});

module.exports = {
  generalRateLimiter,
  uploadRateLimiter,
  deleteRateLimiter
};
