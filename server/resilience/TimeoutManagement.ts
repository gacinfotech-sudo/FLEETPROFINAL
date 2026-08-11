/**
 * TimeoutManagement.ts
 * Adaptive timeout tuning and management per provider
 * Handles request timeouts, escalation, and retry budgets
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface TimeoutConfig {
  provider: string;
  initialTimeout: number;        // Initial timeout in ms
  minTimeout: number;            // Minimum timeout
  maxTimeout: number;            // Maximum timeout
  adaptiveMode: boolean;         // Enable adaptive tuning
  escalationFactor: number;      // Factor to increase timeout on retries
  maxEscalations: number;        // Max times to escalate
  percentileTarget: number;      // Target percentile (e.g., 95)
  sampleSize: number;            // Samples for calculating statistics
}

export interface TimeoutMetrics {
  provider: string;
  currentTimeout: number;
  minObservedLatency: number;
  maxObservedLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  avgLatency: number;
  timeouts: number;
  totalOperations: number;
  timeoutRate: number;
  adjustments: number;
  lastAdjustmentTime: Date | null;
}

export interface RetryBudget {
  provider: string;
  budget: number;
  spent: number;
  remaining: number;
  resetTime: Date;
  requestsThisCycle: number;
  successfulRetries: number;
}

export class TimeoutManager extends EventEmitter {
  private currentTimeout: number;
  private escalationLevel: number = 0;
  private latencies: number[] = [];
  private timeoutCount: number = 0;
  private totalOperations: number = 0;
  private metrics: TimeoutMetrics;
  private retryBudget: RetryBudget;
  private readonly budgetResetInterval = 60000; // 1 minute
  private budgetResetTimer: NodeJS.Timeout | null = null;

  constructor(private config: TimeoutConfig) {
    super();
    this.validateConfig();

    this.currentTimeout = config.initialTimeout;

    this.metrics = {
      provider: config.provider,
      currentTimeout: this.currentTimeout,
      minObservedLatency: Infinity,
      maxObservedLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      avgLatency: 0,
      timeouts: 0,
      totalOperations: 0,
      timeoutRate: 0,
      adjustments: 0,
      lastAdjustmentTime: null,
    };

    this.retryBudget = {
      provider: config.provider,
      budget: 100,
      spent: 0,
      remaining: 100,
      resetTime: new Date(Date.now() + this.budgetResetInterval),
      requestsThisCycle: 0,
      successfulRetries: 0,
    };

    this.startBudgetReset();
  }

  /**
   * Get appropriate timeout for current conditions
   */
  getTimeout(isRetry: boolean = false): number {
    if (isRetry && this.escalationLevel < this.config.maxEscalations) {
      this.escalationLevel++;
      const escalatedTimeout = Math.min(
        this.currentTimeout * Math.pow(this.config.escalationFactor, this.escalationLevel),
        this.config.maxTimeout
      );

      logger.debug(
        `TimeoutManager[${this.config.provider}]: Escalating timeout to ${escalatedTimeout}ms (level ${this.escalationLevel})`
      );

      return escalatedTimeout;
    }

    return this.currentTimeout;
  }

  /**
   * Record operation latency
   */
  recordLatency(latency: number, timedOut: boolean = false): void {
    this.totalOperations++;
    this.retryBudget.requestsThisCycle++;
    this.metrics.totalOperations++;

    if (timedOut) {
      this.timeoutCount++;
      this.metrics.timeouts++;
    }

    this.latencies.push(latency);
    if (this.latencies.length > this.config.sampleSize) {
      this.latencies.shift();
    }

    // Update statistics
    this.updateMetrics();

    // Adaptive timeout adjustment
    if (this.config.adaptiveMode && this.latencies.length > 10) {
      this.adjustTimeout();
    }
  }

  /**
   * Record successful retry
   */
  recordSuccessfulRetry(): void {
    this.retryBudget.successfulRetries++;
  }

  /**
   * Check if retry budget available
   */
  canRetry(): boolean {
    return this.retryBudget.remaining > 0;
  }

  /**
   * Spend retry budget
   */
  spendBudget(amount: number = 1): boolean {
    if (this.retryBudget.remaining >= amount) {
      this.retryBudget.spent += amount;
      this.retryBudget.remaining -= amount;
      return true;
    }
    return false;
  }

  /**
   * Reset escalation for successful operation
   */
  resetEscalation(): void {
    if (this.escalationLevel > 0) {
      this.escalationLevel = 0;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): TimeoutMetrics {
    return { ...this.metrics };
  }

  /**
   * Get retry budget status
   */
  getBudgetStatus(): RetryBudget {
    return { ...this.retryBudget };
  }

  /**
   * Get timeout statistics
   */
  getTimeoutStats(): {
    timeoutRate: number;
    avgLatency: number;
    p95Latency: number;
    isHealthy: boolean;
  } {
    const timeoutRate =
      this.totalOperations > 0
        ? (this.timeoutCount / this.totalOperations) * 100
        : 0;

    return {
      timeoutRate,
      avgLatency: this.metrics.avgLatency,
      p95Latency: this.metrics.p95Latency,
      isHealthy: timeoutRate < 5 && this.metrics.p95Latency < this.config.maxTimeout,
    };
  }

  /**
   * Set manual timeout
   */
  setManualTimeout(timeout: number): void {
    if (timeout < this.config.minTimeout || timeout > this.config.maxTimeout) {
      throw new Error(
        `Timeout must be between ${this.config.minTimeout} and ${this.config.maxTimeout}`
      );
    }

    const oldTimeout = this.currentTimeout;
    this.currentTimeout = timeout;
    this.metrics.currentTimeout = timeout;
    this.metrics.adjustments++;
    this.metrics.lastAdjustmentTime = new Date();

    logger.info(
      `TimeoutManager[${this.config.provider}]: Manual timeout adjustment: ${oldTimeout}ms → ${timeout}ms`
    );

    this.emit('timeout-changed', {
      provider: this.config.provider,
      oldTimeout,
      newTimeout: timeout,
      reason: 'manual',
      timestamp: new Date(),
    });
  }

  /**
   * Shutdown manager
   */
  shutdown(): void {
    if (this.budgetResetTimer) {
      clearInterval(this.budgetResetTimer);
    }
  }

  // ============ Private Methods ============

  private updateMetrics(): void {
    if (this.latencies.length === 0) return;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.minObservedLatency = Math.min(
      this.metrics.minObservedLatency,
      sorted[0]
    );
    this.metrics.maxObservedLatency = Math.max(
      this.metrics.maxObservedLatency,
      sorted[len - 1]
    );
    this.metrics.avgLatency =
      this.latencies.reduce((a, b) => a + b, 0) / len;
    this.metrics.p50Latency = sorted[Math.floor(len * 0.5)];
    this.metrics.p95Latency = sorted[Math.floor(len * 0.95)];
    this.metrics.p99Latency = sorted[Math.floor(len * 0.99)];
    this.metrics.timeoutRate =
      this.totalOperations > 0
        ? (this.timeoutCount / this.totalOperations) * 100
        : 0;
  }

  private adjustTimeout(): void {
    const p95 = this.metrics.p95Latency;
    const currentTimeout = this.currentTimeout;

    // Target: p95 should be < 80% of current timeout
    const targetThreshold = currentTimeout * 0.8;

    if (p95 > targetThreshold) {
      // Increase timeout if p95 is too high
      const newTimeout = Math.min(
        Math.ceil(p95 * 1.2), // 20% buffer above p95
        this.config.maxTimeout
      );

      if (newTimeout !== currentTimeout) {
        this.currentTimeout = newTimeout;
        this.metrics.currentTimeout = newTimeout;
        this.metrics.adjustments++;
        this.metrics.lastAdjustmentTime = new Date();

        logger.info(
          `TimeoutManager[${this.config.provider}]: Adaptive timeout increase: ${currentTimeout}ms → ${newTimeout}ms (p95=${p95.toFixed(2)}ms)`
        );

        this.emit('timeout-changed', {
          provider: this.config.provider,
          oldTimeout: currentTimeout,
          newTimeout,
          reason: 'adaptive-increase',
          p95Latency: p95,
          timestamp: new Date(),
        });
      }
    } else if (p95 < currentTimeout * 0.3) {
      // Decrease timeout if p95 is very low (to reduce resource usage)
      const newTimeout = Math.max(
        Math.ceil(p95 * 1.5),
        this.config.minTimeout
      );

      if (newTimeout < currentTimeout) {
        this.currentTimeout = newTimeout;
        this.metrics.currentTimeout = newTimeout;
        this.metrics.adjustments++;
        this.metrics.lastAdjustmentTime = new Date();

        logger.info(
          `TimeoutManager[${this.config.provider}]: Adaptive timeout decrease: ${currentTimeout}ms → ${newTimeout}ms (p95=${p95.toFixed(2)}ms)`
        );

        this.emit('timeout-changed', {
          provider: this.config.provider,
          oldTimeout: currentTimeout,
          newTimeout,
          reason: 'adaptive-decrease',
          p95Latency: p95,
          timestamp: new Date(),
        });
      }
    }
  }

  private startBudgetReset(): void {
    this.budgetResetTimer = setInterval(() => {
      const oldBudget = this.retryBudget.spent;
      this.retryBudget.spent = 0;
      this.retryBudget.remaining = this.retryBudget.budget;
      this.retryBudget.resetTime = new Date(Date.now() + this.budgetResetInterval);
      this.retryBudget.requestsThisCycle = 0;
      this.retryBudget.successfulRetries = 0;

      const budgetUtilization = (oldBudget / this.retryBudget.budget) * 100;
      if (budgetUtilization > 80) {
        logger.warn(
          `TimeoutManager[${this.config.provider}]: High retry budget utilization: ${budgetUtilization.toFixed(2)}%`
        );
      }

      this.emit('budget-reset', {
        provider: this.config.provider,
        utilization: budgetUtilization,
        timestamp: new Date(),
      });
    }, this.budgetResetInterval);
  }

  private validateConfig(): void {
    if (this.config.initialTimeout < this.config.minTimeout) {
      throw new Error('initialTimeout must be >= minTimeout');
    }
    if (this.config.initialTimeout > this.config.maxTimeout) {
      throw new Error('initialTimeout must be <= maxTimeout');
    }
    if (this.config.minTimeout < 100) {
      throw new Error('minTimeout must be at least 100ms');
    }
    if (this.config.escalationFactor < 1) {
      throw new Error('escalationFactor must be >= 1');
    }
  }
}

/**
 * Timeout manager factory
 */
export class TimeoutManagerFactory {
  private managers: Map<string, TimeoutManager> = new Map();
  private readonly defaultConfig: Partial<TimeoutConfig> = {
    initialTimeout: 5000,
    minTimeout: 1000,
    maxTimeout: 30000,
    adaptiveMode: true,
    escalationFactor: 1.5,
    maxEscalations: 3,
    percentileTarget: 95,
    sampleSize: 100,
  };

  /**
   * Get or create timeout manager for provider
   */
  getManager(
    provider: string,
    config?: Partial<TimeoutConfig>
  ): TimeoutManager {
    if (!this.managers.has(provider)) {
      const mergedConfig: TimeoutConfig = {
        provider,
        ...(this.defaultConfig as TimeoutConfig),
        ...config,
      };
      this.managers.set(provider, new TimeoutManager(mergedConfig));
    }
    return this.managers.get(provider)!;
  }

  /**
   * Get all managers
   */
  getAllManagers(): TimeoutManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Get timeout stats for all providers
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.managers.forEach((manager, provider) => {
      stats[provider] = {
        metrics: manager.getMetrics(),
        budget: manager.getBudgetStatus(),
        stats: manager.getTimeoutStats(),
      };
    });
    return stats;
  }

  /**
   * Shutdown all managers
   */
  shutdownAll(): void {
    this.managers.forEach((manager) => manager.shutdown());
  }
}

// Singleton instance
export const timeoutManagerFactory = new TimeoutManagerFactory();
