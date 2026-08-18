/**
 * FaultTolerance.ts
 * Comprehensive fault tolerance patterns
 * Retry logic with jitter, fallback strategies, cascading failure prevention, self-healing
 */

import { EventEmitter } from 'events';
import { CircuitBreaker } from './CircuitBreaker';
import { BulkheadIsolation } from './BulkheadPattern';
import { TimeoutManager } from './TimeoutManagement';
import { logger } from '../utils/logger';

export enum RetryStrategy {
  LINEAR = 'LINEAR',             // 1s, 2s, 3s, 4s, 5s
  EXPONENTIAL = 'EXPONENTIAL',   // 1s, 2s, 4s, 8s, 16s
  FIBONACCI = 'FIBONACCI',       // 1s, 1s, 2s, 3s, 5s
}

export interface FaultToleranceConfig {
  provider: string;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  baseDelay: number;             // Base delay in ms
  maxDelay: number;              // Maximum delay for backoff
  jitterFraction: number;        // 0.0 - 1.0, portion of delay that is random
  circuitBreaker: CircuitBreaker;
  bulkhead: BulkheadIsolation;
  timeoutManager: TimeoutManager;
  fallbackChain?: Array<() => Promise<any>>;
}

export interface FaultToleranceMetrics {
  provider: string;
  totalAttempts: number;
  successfulAttempts: number;
  retries: number;
  fallbacks: number;
  circuitBreakerTrips: number;
  bulkheadRejects: number;
  cascadingFailuresPrevented: number;
  lastErrorType: string | null;
  lastErrorTime: Date | null;
}

export interface RetryContext {
  attempt: number;
  totalDelay: number;
  nextRetryTime: Date;
  shouldRetry: boolean;
  reason: string;
}

export class FaultTolerance extends EventEmitter {
  private metrics: FaultToleranceMetrics;
  private failureHistory: Map<string, number[]> = new Map();
  private readonly historyWindow = 60000; // 1 minute window

  constructor(private config: FaultToleranceConfig) {
    super();

    this.metrics = {
      provider: config.provider,
      totalAttempts: 0,
      successfulAttempts: 0,
      retries: 0,
      fallbacks: 0,
      circuitBreakerTrips: 0,
      bulkheadRejects: 0,
      cascadingFailuresPrevented: 0,
      lastErrorType: null,
      lastErrorTime: null,
    };
  }

  /**
   * Execute operation with full fault tolerance
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'Operation'
  ): Promise<T> {
    // Check circuit breaker first
    if (!this.config.circuitBreaker.isAvailable()) {
      this.metrics.circuitBreakerTrips++;
      throw new Error(
        `Circuit breaker open for ${this.config.provider}. Service unavailable.`
      );
    }

    // Use bulkhead for resource isolation
    try {
      return await this.config.bulkhead.submit(async () => {
        return await this.executeWithRetry(operation, operationName);
      });
    } catch (error) {
      // Handle bulkhead rejection
      if (error instanceof Error && error.message.includes('Queue')) {
        this.metrics.bulkheadRejects++;
        logger.warn(
          `FaultTolerance[${this.config.provider}]: Bulkhead rejected operation`,
          { operationName, error: error.message }
        );

        // Attempt fallback if available
        if (this.config.fallbackChain && this.config.fallbackChain.length > 0) {
          return this.executeFallback<T>(operationName);
        }
      }

      throw error;
    }
  }

  /**
   * Execute with fallback chain
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbacks: Array<() => Promise<T>>,
    operationName: string = 'Operation'
  ): Promise<T> {
    try {
      return await this.execute(operation, operationName);
    } catch (primaryError) {
      return this.tryFallbacks(fallbacks, primaryError, operationName);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): FaultToleranceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    successRate: number;
    retryRate: number;
    cascadingFailureRisk: number;
  } {
    const successRate =
      this.metrics.totalAttempts > 0
        ? (this.metrics.successfulAttempts / this.metrics.totalAttempts) * 100
        : 100;

    const retryRate =
      this.metrics.totalAttempts > 0
        ? (this.metrics.retries / this.metrics.totalAttempts) * 100
        : 0;

    const cascadingRisk =
      this.metrics.circuitBreakerTrips +
      this.metrics.bulkheadRejects +
      this.metrics.cascadingFailuresPrevented;

    return {
      isHealthy: successRate > 95 && this.config.circuitBreaker.isAvailable(),
      successRate,
      retryRate,
      cascadingFailureRisk:
        cascadingRisk > 10
          ? 'HIGH'
          : cascadingRisk > 5
            ? 'MEDIUM'
            : cascadingRisk > 1
              ? 'LOW'
              : 'NONE',
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      ...this.metrics,
      totalAttempts: 0,
      successfulAttempts: 0,
      retries: 0,
      fallbacks: 0,
      circuitBreakerTrips: 0,
      bulkheadRejects: 0,
      cascadingFailuresPrevented: 0,
    };
  }

  // ============ Private Methods ============

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      this.metrics.totalAttempts++;

      try {
        const timeout = this.config.timeoutManager.getTimeout(attempt > 1);
        const result = await this.executeWithTimeout(operation, timeout);

        this.metrics.successfulAttempts++;
        this.config.timeoutManager.resetEscalation();

        if (attempt > 1) {
          this.config.timeoutManager.recordSuccessfulRetry();
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.updateFailureHistory(lastError);
        this.metrics.lastErrorType = lastError.constructor.name;
        this.metrics.lastErrorTime = new Date();

        // Record latency (use a high value for timeouts)
        const isTimeout = lastError.message.includes('timeout');
        this.config.timeoutManager.recordLatency(
          isTimeout ? this.config.timeoutManager.getMetrics().currentTimeout : 0,
          isTimeout
        );

        // Check if we should retry
        const retryContext = this.shouldRetry(attempt, lastError);

        if (!retryContext.shouldRetry) {
          logger.error(
            `FaultTolerance[${this.config.provider}]: Operation failed after ${attempt} attempts`,
            { operationName, reason: retryContext.reason, error: lastError.message }
          );
          break;
        }

        // Check retry budget
        if (!this.config.timeoutManager.canRetry()) {
          logger.warn(
            `FaultTolerance[${this.config.provider}]: Retry budget exhausted`,
            { operationName }
          );
          break;
        }

        this.config.timeoutManager.spendBudget(1);
        this.metrics.retries++;

        // Wait before retry with jitter
        const delay = this.calculateDelay(attempt);
        const jitter = this.calculateJitter(delay);
        const totalDelay = delay + jitter;

        logger.debug(
          `FaultTolerance[${this.config.provider}]: Retrying ${operationName}`,
          { attempt, delay, jitter, totalDelay }
        );

        await this.sleep(totalDelay);

        // Check for cascading failures (too many failures across providers)
        this.detectCascadingFailures();
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.config.maxRetries + 1} attempts`);
  }

  private async tryFallbacks<T>(
    fallbacks: Array<() => Promise<T>>,
    primaryError: Error,
    operationName: string
  ): Promise<T> {
    if (!fallbacks || fallbacks.length === 0) {
      throw primaryError;
    }

    for (let i = 0; i < fallbacks.length; i++) {
      try {
        this.metrics.fallbacks++;
        logger.info(
          `FaultTolerance[${this.config.provider}]: Attempting fallback ${i + 1}/${fallbacks.length}`,
          { operationName }
        );

        const result = await this.config.bulkhead.submit(fallbacks[i]);
        return result;
      } catch (fallbackError) {
        if (i === fallbacks.length - 1) {
          // Last fallback failed
          throw fallbackError;
        }
        // Try next fallback
      }
    }

    throw primaryError;
  }

  private async executeFallback<T>(operationName: string): Promise<T> {
    if (!this.config.fallbackChain || this.config.fallbackChain.length === 0) {
      throw new Error(`No fallback available for ${operationName}`);
    }

    return this.tryFallbacks(this.config.fallbackChain, new Error('Primary failed'), operationName);
  }

  private executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  private shouldRetry(attempt: number, error: Error): RetryContext {
    const maxAttempts = this.config.maxRetries + 1;

    if (attempt >= maxAttempts) {
      return {
        attempt,
        totalDelay: 0,
        nextRetryTime: new Date(),
        shouldRetry: false,
        reason: 'Max retries exceeded',
      };
    }

    // Don't retry on permanent errors
    if (this.isPermanentError(error)) {
      return {
        attempt,
        totalDelay: 0,
        nextRetryTime: new Date(),
        shouldRetry: false,
        reason: 'Permanent error',
      };
    }

    return {
      attempt,
      totalDelay: this.calculateDelay(attempt),
      nextRetryTime: new Date(Date.now() + this.calculateDelay(attempt)),
      shouldRetry: true,
      reason: 'Transient error',
    };
  }

  private calculateDelay(attempt: number): number {
    let baseDelay = this.config.baseDelay;

    switch (this.config.retryStrategy) {
      case RetryStrategy.LINEAR:
        return Math.min(baseDelay * attempt, this.config.maxDelay);

      case RetryStrategy.EXPONENTIAL:
        return Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          this.config.maxDelay
        );

      case RetryStrategy.FIBONACCI:
        const fib = this.fibonacci(attempt);
        return Math.min(baseDelay * fib, this.config.maxDelay);

      default:
        return baseDelay;
    }
  }

  private calculateJitter(delay: number): number {
    const jitterAmount = delay * this.config.jitterFraction;
    return Math.random() * jitterAmount;
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i < n; i++) {
      [a, b] = [b, a + b];
    }
    return a + b;
  }

  private isPermanentError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const permanentPatterns = [
      'not found',
      'unauthorized',
      'forbidden',
      'invalid argument',
      'malformed',
    ];
    return permanentPatterns.some((pattern) => message.includes(pattern));
  }

  private updateFailureHistory(error: Error): void {
    const errorType = error.constructor.name;
    const now = Date.now();

    if (!this.failureHistory.has(errorType)) {
      this.failureHistory.set(errorType, []);
    }

    const history = this.failureHistory.get(errorType)!;
    history.push(now);

    // Remove old entries outside the window
    const cutoff = now - this.historyWindow;
    while (history.length > 0 && history[0] < cutoff) {
      history.shift();
    }
  }

  private detectCascadingFailures(): void {
    let totalRecentFailures = 0;

    this.failureHistory.forEach((timestamps) => {
      totalRecentFailures += timestamps.length;
    });

    // If more than 50% of operations in recent window failed, likely cascading
    if (totalRecentFailures > 20) {
      this.metrics.cascadingFailuresPrevented++;
      logger.warn(
        `FaultTolerance[${this.config.provider}]: Cascading failure detected!`,
        { recentFailures: totalRecentFailures }
      );

      this.emit('cascading-failure-detected', {
        provider: this.config.provider,
        recentFailures: totalRecentFailures,
        timestamp: new Date(),
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Orchestrator for all fault tolerance patterns
 */
export class FaultToleranceOrchestrator {
  private faultTolerances: Map<string, FaultTolerance> = new Map();

  /**
   * Register fault tolerance for provider
   */
  register(faultTolerance: FaultTolerance, provider: string): void {
    this.faultTolerances.set(provider, faultTolerance);
  }

  /**
   * Get fault tolerance for provider
   */
  get(provider: string): FaultTolerance | null {
    return this.faultTolerances.get(provider) || null;
  }

  /**
   * Get all fault tolerances
   */
  getAll(): FaultTolerance[] {
    return Array.from(this.faultTolerances.values());
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport(): Record<string, any> {
    const report: Record<string, any> = {
      timestamp: new Date(),
      providers: {},
    };

    this.faultTolerances.forEach((ft, provider) => {
      report.providers[provider] = {
        metrics: ft.getMetrics(),
        health: ft.getHealthStatus(),
      };
    });

    return report;
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.faultTolerances.forEach((ft) => ft.resetMetrics());
  }
}

// Singleton instance
export const faultToleranceOrchestrator = new FaultToleranceOrchestrator();
