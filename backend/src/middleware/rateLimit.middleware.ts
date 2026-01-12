import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      type: 'RateLimitError',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      type: 'RateLimitError',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for research/discovery endpoints (external API calls)
export const researchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 research requests per minute
  message: {
    success: false,
    error: {
      message: 'Too many research requests, please slow down.',
      type: 'RateLimitError',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom rate limiter for sensitive operations
export const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Limit each IP to 3 sensitive operations per minute
  message: {
    success: false,
    error: {
      message: 'Too many sensitive operations, please try again later.',
      type: 'RateLimitError',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
