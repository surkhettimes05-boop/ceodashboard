import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Standard rate limit for general API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: Request) => {
    // Skip rate limiting for health endpoints
    return req.path === '/api/health' || req.path === '/ready';
  },
});

// Strict rate limit for sensitive endpoints (admin operations, financial operations)
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP for sensitive operations, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// A POS register must support normal transaction volume without disabling financial safeguards elsewhere.
export const salesRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many sales requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient rate limit for public endpoints
export const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for authentication endpoints (login, refresh)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: 'Too many authentication attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false, // Count failed requests
});

// Middleware to apply rate limiting based on endpoint
export const applyRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // Auth endpoints
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/refresh')) {
    return authRateLimit(req, res, next);
  }

  // Admin endpoints
  if (req.path.startsWith('/admin')) {
    return strictRateLimit(req, res, next);
  }

  // Financial operations
  if (req.path.startsWith('/sales')) {
    return salesRateLimit(req, res, next);
  }

  if (req.path.startsWith('/accounting') || req.path.startsWith('/purchases')) {
    return strictRateLimit(req, res, next);
  }

  // Public endpoints
  if (req.path.startsWith('/public')) {
    return publicRateLimit(req, res, next);
  }

  // Default API rate limit
  return apiRateLimit(req, res, next);
};
