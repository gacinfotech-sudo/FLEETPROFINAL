/**
 * RateLimiter
 * Advanced rate limiting with token bucket algorithm
 * Supports adaptive rate limiting, burst capacity, backpressure handling
 * Circuit breaker integration and per-tenant limiting
 */

import { createLogger } from '../../utils/logger';

/**
 * Token bucket state
 */
interface TokenBucket {
  tokens: number;
  lastRefillAt: Date;
  capacity: number;
  refillRate: number; // tokens per second
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  tokensPerSecond?: number; // Default: 100
  burstCapacity?: number; // Default: 200 (2x tokensPerSecond)
  windowSize?: number; // Default: 1000ms
  maxWaitTime?: number; // Default: 30000ms
  enableBackpressure?: boolean; // Default: true
  enableCircuitBreaker?: boolean; // Default: true
  circuitBreakerThreshold?: number; // Default: 10 consecutive errors
  circuitBreakerTimeout?: number; // Default: 30000ms
}

/**
 * Rate limit statistics
 */
export interface RateLimitStatistics {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  throttledRequests: number;
  currentTokens: number;
  bucketCapacity: number;
  successRate: number; // percentage
  averageWaitTime: number; // milliseconds
  circuitBreakerState?: 'closed' | 'open' | 'half-open';
  circuitBreakerTrips?: number;
}

/**
 * Scope types for rate limiting
 */
export type RateLimitScope = 'global' | 'tenant' | 'user' | 'category' | 'channel';

/**
 * RateLimiter
 * Token bucket based rate limiting with circuit breaker
 */
export class RateLimiter {
  private logger: any;
  private config: Required<RateLimitConfig>;
  private buckets: Map<string, TokenBucket> = new Map();
  private waitQueues: Map<string, Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>> = new Map();
  private statistics: Map<string, {
    total: number;
    allowed: number;
    denied: number;
    throttled: number;
    waitTimes: number[];
  }> = new Map();
  private circuitBreakers: Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureAt?: Date;
    trips: number;
  }> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.logger = createLogger('RateLimiter');
    this.config = this.normalizeConfig(config);
  }

  /**
   * Normalize and validate configuration
   */
  private normalizeConfig(
    config: RateLimitConfig,
  ): Required<RateLimitConfig> {
    const tokensPerSecond = config.tokensPerSecond ?? 100;

    return {
      tokensPerSecond,
      burstCapacity: config.burstCapacity ?? tokensPerSecond * 2,
      windowSize: config.windowSize ?? 1000,
      maxWaitTime: config.maxWaitTime ?? 30000,
      enableBackpressure: config.enableBackpressure ?? true,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      circuitBreakerThreshold:
        config.circuitBreakerThreshold ?? 10,
      circuitBreakerTimeout: config.circuitBreakerTimeout ?? 30000,
    };
  }

  /**
   * Initialize rate limit scope
   */
  private initializeScope(scope: string): void {
    if (!this.buckets.has(scope)) {
      this.buckets.set(scope, {
        tokens: this.config.burstCapacity,
        lastRefillAt: new Date(),
        capacity: this.config.burstCapacity,
        refillRate: this.config.tokensPerSecond,
      });

      this.statistics.set(scope, {
        total: 0,
        allowed: 0,
        denied: 0,
        throttled: 0,
        waitTimes: [],
      });

      if (this.config.enableCircuitBreaker) {
        this.circuitBreakers.set(scope, {
          state: 'closed',
          failureCount: 0,
          trips: 0,
        });
      }
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(bucket: TokenBucket): void {
    const now = new Date();
    const timePassed =
      (now.getTime() - bucket.lastRefillAt.getTime()) / 1000;
    const tokensToAdd = timePassed * bucket.refillRate;

    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefillAt = now;
  }

  /**
   * Try to acquire rate limit token
   */
  async tryAcquire(
    scope: string,
    tokens: number = 1,
  ): Promise<boolean> {
    this.initializeScope(scope);

    const bucket = this.buckets.get(scope)!;
    const stats = this.statistics.get(scope)!;

    this.refillTokens(bucket);

    stats.total++;

    // Check circuit breaker
    if (this.config.enableCircuitBreaker) {
      const circuitBreaker = this.circuitBreakers.get(scope);
      if (
        circuitBreaker &&
        circuitBreaker.state === 'open'
      ) {
        stats.denied++;
        this.logger.warn('Rate limit denied - circuit breaker open', {
          scope,
        });
        return false;
      }
    }

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      stats.allowed++;
      return true;
    }

    stats.denied++;
    return false;
  }

  /**
   * Acquire rate limit token with wait
   */
  async acquire(
    scope: string,
    tokens: number = 1,
  ): Promise<void> {
    this.initializeScope(scope);

    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts =
      Math.ceil(this.config.maxWaitTime / 100);

    while (attempts < maxAttempts) {
      if (await this.tryAcquire(scope, tokens)) {
        const waitTime = Date.now() - startTime;
        this.recordWaitTime(scope, waitTime);
        return;
      }

      attempts++;

      if (attempts < maxAttempts) {
        // Exponential backoff
        const delay = Math.min(
          100 * Math.pow(1.5, Math.min(attempts, 5)),
          1000,
        );
        await this.sleep(delay);
      }
    }

    const stats = this.statistics.get(scope)!;
    stats.throttled++;

    throw new Error(
      `Rate limit exceeded for scope: ${scope}`,
    );
  }

  /**
   * Record successful request (for circuit breaker)
   */
  recordSuccess(scope: string): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    const circuitBreaker = this.circuitBreakers.get(scope);
    if (circuitBreaker) {
      circuitBreaker.failureCount = 0;

      if (circuitBreaker.state === 'half-open') {
        circuitBreaker.state = 'closed';
        this.logger.info(
          'Circuit breaker closed',
          { scope },
        );
      }
    }
  }

  /**
   * Record failed request (for circuit breaker)
   */
  recordFailure(scope: string): void {
    if (!this.config.enableCircuitBreaker) {
      return;
    }

    const circuitBreaker = this.circuitBreakers.get(scope);
    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureAt = new Date();

      if (
        circuitBreaker.failureCount >=
        this.config.circuitBreakerThreshold
      ) {
        circuitBreaker.state = 'open';
        circuitBreaker.trips++;

        this.logger.warn('Circuit breaker opened', {
          scope,
          failures: circuitBreaker.failureCount,
        });

        // Schedule recovery attempt
        setTimeout(() => {
          if (circuitBreaker.state === 'open') {
            circuitBreaker.state = 'half-open';
            circuitBreaker.failureCount = 0;

            this.logger.info(
              'Circuit breaker half-open',
              { scope },
            );
          }
        }, this.config.circuitBreakerTimeout);
      }
    }
  }

  /**
   * Record wait time
   */
  private recordWaitTime(scope: string, waitTime: number): void {
    const stats = this.statistics.get(scope);
    if (stats) {
      stats.waitTimes.push(waitTime);
      // Keep last 100 wait times for average calculation
      if (stats.waitTimes.length > 100) {
        stats.waitTimes.shift();
      }
    }
  }

  /**
   * Get rate limit status for scope
   */
  getStatus(scope: string): {
    tokensAvailable: number;
    tokensPerSecond: number;
    nextRefillAt?: Date;
  } {
    this.initializeScope(scope);

    const bucket = this.buckets.get(scope)!;
    this.refillTokens(bucket);

    return {
      tokensAvailable: Math.floor(bucket.tokens),
      tokensPerSecond: bucket.refillRate,
      nextRefillAt: new Date(
        bucket.lastRefillAt.getTime() + 1000,
      ),
    };
  }

  /**
   * Get rate limit statistics for scope
   */
  getStatistics(scope?: string): Map<string, RateLimitStatistics> {
    const result = new Map<string, RateLimitStatistics>();

    const scopes = scope
      ? [scope]
      : Array.from(this.statistics.keys());

    for (const s of scopes) {
      const stats = this.statistics.get(s);
      const bucket = this.buckets.get(s);
      const circuitBreaker = this.circuitBreakers.get(s);

      if (stats && bucket) {
        const successRate =
          stats.total > 0
            ? ((stats.allowed / stats.total) * 100)
            : 0;

        const avgWaitTime =
          stats.waitTimes.length > 0
            ? stats.waitTimes.reduce((a, b) => a + b) /
              stats.waitTimes.length
            : 0;

        result.set(s, {
          totalRequests: stats.total,
          allowedRequests: stats.allowed,
          deniedRequests: stats.denied,
          throttledRequests: stats.throttled,
          currentTokens: Math.floor(bucket.tokens),
          bucketCapacity: bucket.capacity,
          successRate,
          averageWaitTime: avgWaitTime,
          circuitBreakerState: circuitBreaker?.state,
          circuitBreakerTrips: circuitBreaker?.trips,
        });
      }
    }

    return result;
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    this.logger.info('Rate limit config updated', {
      config: this.config,
    });

    // Update all bucket capacities and refill rates
    const buckets = Array.from(this.buckets.values());
    for (const bucket of buckets) {
      bucket.refillRate = this.config.tokensPerSecond;
      bucket.capacity = this.config.burstCapacity;
      bucket.tokens = Math.min(
        bucket.tokens,
        bucket.capacity,
      );
    }
  }

  /**
   * Reset rate limit for scope
   */
  reset(scope: string): void {
    this.buckets.delete(scope);
    this.statistics.delete(scope);
    this.waitQueues.delete(scope);

    if (this.config.enableCircuitBreaker) {
      this.circuitBreakers.delete(scope);
    }

    this.logger.info('Rate limit reset', { scope });
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.buckets.clear();
    this.statistics.clear();
    this.waitQueues.clear();
    this.circuitBreakers.clear();

    this.logger.info('All rate limits reset');
  }

  /**
   * Get configuration
   */
  getConfig(): Required<RateLimitConfig> {
    return this.config;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get all scopes
   */
  getScopes(): string[] {
    return Array.from(this.buckets.keys());
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(
    scope: string,
  ): {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    trips: number;
  } | null {
    const cb = this.circuitBreakers.get(scope);
    if (!cb) {
      return null;
    }

    return {
      state: cb.state,
      failures: cb.failureCount,
      trips: cb.trips,
    };
  }
}

export default RateLimiter;
