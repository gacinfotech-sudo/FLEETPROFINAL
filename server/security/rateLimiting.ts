import redis, { Redis } from 'redis';
import { Request, Response, NextFunction } from 'express';

/**
 * Redis-backed Rate Limiting System
 * Supports: per-user, per-channel, per-trigger, per-IP rate limiting
 * Graceful degradation when Redis unavailable
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, retryAfter: number) => void;
  redisClient?: Redis;
}

export interface RateLimitStore {
  getLimit: (key: string) => Promise<number>;
  incrementLimit: (key: string, windowMs: number) => Promise<number>;
  resetLimit: (key: string) => Promise<void>;
}

class InMemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiresAt: number }>();

  async getLimit(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return 0;
    }
    return entry.count;
  }

  async incrementLimit(key: string, windowMs: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || entry.expiresAt < now) {
      this.store.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  async resetLimit(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class RedisStore implements RateLimitStore {
  constructor(private redisClient: Redis) {}

  async getLimit(key: string): Promise<number> {
    try {
      const count = await this.redisClient.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Redis getLimit error:', error);
      return 0;
    }
  }

  async incrementLimit(key: string, windowMs: number): Promise<number> {
    try {
      const count = await this.redisClient.incr(key);

      // Set expiration on first increment
      if (count === 1) {
        await this.redisClient.expire(key, Math.ceil(windowMs / 1000));
      }

      return count;
    } catch (error) {
      console.error('Redis incrementLimit error:', error);
      // Graceful degradation: return max value to trigger rate limit
      return Number.MAX_SAFE_INTEGER;
    }
  }

  async resetLimit(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Redis resetLimit error:', error);
    }
  }
}

export class RateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.ip || 'unknown',
      ...config,
    };

    // Use Redis if available, fall back to in-memory
    if (config.redisClient) {
      this.store = new RedisStore(config.redisClient);
    } else {
      this.store = new InMemoryStore();
    }
  }

  async checkLimit(req: Request, res: Response): Promise<boolean> {
    const key = this.config.keyGenerator!(req);
    const current = await this.store.incrementLimit(key, this.config.windowMs);

    if (current > this.config.maxRequests) {
      const retryAfter = Math.ceil(this.config.windowMs / 1000);

      if (this.config.handler) {
        this.config.handler(req, res, retryAfter);
      } else {
        res.status(429).json({
          message: 'Too many requests, please try again later.',
          retryAfter,
        });
      }

      return false;
    }

    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - current));
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + this.config.windowMs).toISOString());

    return true;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const allowed = await this.checkLimit(req, res);
      if (allowed) {
        next();
      }
    };
  }
}

/**
 * Pre-configured Rate Limiters for Common Use Cases
 */

export function createLoginRateLimiter(redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    keyGenerator: (req) => `login:${req.ip}`,
    redisClient,
    handler: (req, res, retryAfter) => {
      res.status(429).json({
        message: 'Too many login attempts. Please try again later.',
        retryAfter,
        lockoutTime: retryAfter,
      });
    },
  });
}

export function createPerUserRateLimiter(redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: any) => `user:${req.user?.id || req.ip}`,
    redisClient,
  });
}

export function createPerChannelRateLimiter(channel: string, redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req: any) => `channel:${channel}:${req.user?.id || req.ip}`,
    redisClient,
  });
}

export function createPerTriggerRateLimiter(trigger: string, redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyGenerator: (req: any) => `trigger:${trigger}:${req.user?.id || req.ip}`,
    redisClient,
  });
}

export function createIPBasedRateLimiter(maxRequests: number = 100, redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests,
    keyGenerator: (req) => `ip:${req.ip}`,
    redisClient,
  });
}

export function createWebhookRateLimiter(webhookId: string, redisClient?: Redis) {
  return new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // Webhooks can handle more traffic
    keyGenerator: () => `webhook:${webhookId}`,
    redisClient,
    handler: (req, res, retryAfter) => {
      res.status(429).json({
        message: 'Webhook rate limit exceeded.',
        retryAfter,
        webhookId,
      });
    },
  });
}

/**
 * Redis Client Factory
 */
export async function createRedisClient(url?: string): Promise<Redis | null> {
  if (!url && !process.env.REDIS_URL) {
    console.log('Redis URL not configured, using in-memory rate limiting');
    return null;
  }

  const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const client = redis.createClient({ url: redisUrl });

    client.on('error', (err) => {
      console.error('Redis connection error:', err);
      // Graceful degradation: continue with in-memory store
    });

    await client.connect();
    console.log('Connected to Redis for rate limiting');
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Falling back to in-memory rate limiting');
    return null;
  }
}

/**
 * Middleware factory for easy integration
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);
  return limiter.middleware();
}

/**
 * Adaptive Rate Limiting
 * Adjust rate limits based on system load
 */
export class AdaptiveRateLimiter {
  private baseLimiter: RateLimiter;
  private loadThresholds = {
    low: 50, // CPU < 50%
    medium: 75, // CPU 50-75%
    high: 90, // CPU > 90%
  };

  constructor(config: RateLimitConfig) {
    this.baseLimiter = new RateLimiter(config);
  }

  private getSystemLoad(): number {
    // In production, integrate with actual system monitoring
    // For now, return simulated value
    return Math.random() * 100;
  }

  private adjustMaxRequests(baseMax: number): number {
    const load = this.getSystemLoad();

    if (load > this.loadThresholds.high) {
      return Math.floor(baseMax * 0.5); // 50% reduction
    } else if (load > this.loadThresholds.medium) {
      return Math.floor(baseMax * 0.75); // 25% reduction
    }

    return baseMax;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const allowed = await this.baseLimiter.checkLimit(req, res);
      if (allowed) {
        next();
      }
    };
  }
}
