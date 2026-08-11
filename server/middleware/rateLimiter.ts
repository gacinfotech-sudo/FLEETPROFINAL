import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('RateLimiter');

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based rate limiter
 */
class RateLimiter {
  private stores: Map<string, RateLimitStore> = new Map();

  /**
   * Create rate limit middleware
   * @param options Configuration
   */
  middleware(options: {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    keyGenerator?: (req: Request) => string; // Custom key generator
    skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
    onLimitReached?: (req: Request, res: Response) => void;
  }) {
    const {
      windowMs,
      maxRequests,
      keyGenerator = (req) => req.ip || 'unknown',
      skip = () => false,
      onLimitReached,
    } = options;

    const storeName = `${windowMs}-${maxRequests}`;

    return (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting for certain requests
      if (skip(req)) {
        return next();
      }

      // Get or create store
      if (!this.stores.has(storeName)) {
        this.stores.set(storeName, {});
      }
      const store = this.stores.get(storeName)!;

      // Get key for this request
      const key = keyGenerator(req);
      const now = Date.now();

      // Initialize or get record
      if (!store[key]) {
        store[key] = { count: 0, resetTime: now + windowMs };
      }

      const record = store[key];

      // Reset if window has passed
      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
      }

      // Increment counter
      record.count++;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
      res.setHeader('X-RateLimit-Reset', record.resetTime.toString());

      // Check if limit exceeded
      if (record.count > maxRequests) {
        log.warn('Rate limit exceeded', {
          key,
          method: req.method,
          path: req.path,
          count: record.count,
          limit: maxRequests,
        });

        if (onLimitReached) {
          onLimitReached(req, res);
        }

        return res.status(429).json({
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        });
      }

      next();
    };
  }
}

// Global instance
const rateLimiter = new RateLimiter();

/**
 * Login attempt rate limiter
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts
  keyGenerator: (req) => {
    // Key by IP + username for brute force protection
    const username = (req.body as any)?.email || (req.body as any)?.username || 'unknown';
    return `${req.ip}-${username}`;
  },
  onLimitReached: (req, res) => {
    log.warn('Login rate limit exceeded', {
      ip: req.ip,
      username: (req.body as any)?.email,
    });
  },
});

/**
 * API rate limiter
 * 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimiter.middleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Strict rate limiter
 * 10 requests per minute per IP
 * For sensitive endpoints like password reset
 */
export const strictRateLimiter = rateLimiter.middleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests
  keyGenerator: (req) => req.ip || 'unknown',
});

/**
 * Very strict rate limiter
 * 3 requests per 15 minutes per IP
 * For password reset, account recovery, etc.
 */
export const veryStrictRateLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 attempts
  keyGenerator: (req) => {
    // Key by IP + email
    const email = (req.body as any)?.email || (req.query as any)?.email || 'unknown';
    return `${req.ip}-${email}`;
  },
  onLimitReached: (req, res) => {
    log.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      email: (req.body as any)?.email || (req.query as any)?.email,
    });
  },
});

export default rateLimiter;
