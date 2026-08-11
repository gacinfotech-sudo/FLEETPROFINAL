/**
 * Optimization Module Index
 * Exports all performance optimization utilities for provider integrations
 * Includes connection pooling, caching, batching, and rate limiting
 */

export { ConnectionPool, type PoolConfig, type PoolStatistics } from './ConnectionPool';
export { CacheLayer, type CacheConfig, type CacheStatistics } from './CacheLayer';
export { BatchProcessor, type ProviderBatchConfigs, type BatchStatistics } from './BatchProcessor';
export { RateLimiter, type RateLimitConfig, type RateLimitStatistics, type RateLimitScope } from './RateLimiter';

/**
 * Optimization Manager
 * Coordinates all optimization strategies for provider integrations
 */
import { ConnectionPool, type PoolConfig } from './ConnectionPool';
import { CacheLayer, type CacheConfig } from './CacheLayer';
import { BatchProcessor, type ProviderBatchConfigs } from './BatchProcessor';
import { RateLimiter, type RateLimitConfig } from './RateLimiter';
import { createLogger } from '../../utils/logger';

export interface OptimizationConfig {
  connectionPool?: PoolConfig;
  cache?: CacheConfig;
  batch?: ProviderBatchConfigs;
  rateLimit?: RateLimitConfig;
}

/**
 * OptimizationManager
 * Central coordinator for all optimization strategies
 */
export class OptimizationManager {
  private logger: any;
  private connectionPool: ConnectionPool | null = null;
  private cache: CacheLayer | null = null;
  private batchProcessor: BatchProcessor | null = null;
  private rateLimiter: RateLimiter | null = null;
  private config: OptimizationConfig;

  constructor(config: OptimizationConfig = {}) {
    this.logger = createLogger('OptimizationManager');
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize all optimization components
   */
  private initialize(): void {
    if (this.config.connectionPool) {
      this.connectionPool = new ConnectionPool(
        'global',
        this.config.connectionPool,
      );
      this.logger.info('ConnectionPool initialized');
    }

    if (this.config.cache) {
      this.cache = new CacheLayer(this.config.cache);
      this.logger.info('CacheLayer initialized');
    }

    if (this.config.batch) {
      this.batchProcessor = new BatchProcessor(
        this.config.batch,
      );
      this.logger.info('BatchProcessor initialized');
    }

    if (this.config.rateLimit) {
      this.rateLimiter = new RateLimiter(
        this.config.rateLimit,
      );
      this.logger.info('RateLimiter initialized');
    }
  }

  /**
   * Get connection pool instance
   */
  getConnectionPool(): ConnectionPool | null {
    return this.connectionPool;
  }

  /**
   * Get cache layer instance
   */
  getCache(): CacheLayer | null {
    return this.cache;
  }

  /**
   * Get batch processor instance
   */
  getBatchProcessor(): BatchProcessor | null {
    return this.batchProcessor;
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};

    if (this.connectionPool) {
      metrics.connectionPool =
        this.connectionPool.getStatistics();
    }

    if (this.cache) {
      metrics.cache = this.cache.getStatistics();
    }

    if (this.batchProcessor) {
      metrics.batch = this.batchProcessor.getStatistics();
    }

    if (this.rateLimiter) {
      const rateLimitStats = this.rateLimiter.getStatistics();
      metrics.rateLimit = Object.fromEntries(rateLimitStats);
    }

    return metrics;
  }

  /**
   * Log comprehensive health report
   */
  reportHealth(): void {
    const metrics = this.getMetrics();

    this.logger.info('Optimization health report', metrics);

    if (metrics.connectionPool) {
      this.logger.info('ConnectionPool health', {
        utilization: `${metrics.connectionPool.poolUtilization.toFixed(1)}%`,
        totalRequests: metrics.connectionPool.totalRequests,
      });
    }

    if (metrics.cache) {
      this.logger.info('Cache health', {
        hitRate: `${metrics.cache.hitRate.toFixed(1)}%`,
        totalEntries: metrics.cache.memorySize,
      });
    }

    if (metrics.batch) {
      this.logger.info('Batch processor health', {
        throughput: `${metrics.batch.throughput.toFixed(2)} items/sec`,
        successRate: `${(metrics.batch.successfulBatches / (metrics.batch.successfulBatches + metrics.batch.failedBatches) * 100).toFixed(1)}%`,
      });
    }
  }

  /**
   * Destroy all components
   */
  async destroy(): Promise<void> {
    this.logger.info('Destroying optimization manager');

    if (this.connectionPool) {
      await this.connectionPool.destroy();
    }

    if (this.cache) {
      await this.cache.clear();
    }

    if (this.batchProcessor) {
      await this.batchProcessor.flushAll();
      await this.batchProcessor.clear();
    }

    // RateLimiter is stateless, no destroy needed
  }
}

export default OptimizationManager;
