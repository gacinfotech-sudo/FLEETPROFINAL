/**
 * CircuitBreaker.ts
 * Production-grade circuit breaker pattern implementation
 * Per-provider circuit breakers with fail-fast, half-open testing, automatic recovery
 * Prevents cascading failures and enables graceful degradation
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',           // Normal operation, requests pass through
  OPEN = 'OPEN',               // Failure threshold exceeded, requests fail immediately
  HALF_OPEN = 'HALF_OPEN',     // Testing if service recovered
}

export enum CircuitEvent {
  STATE_CHANGE = 'state_change',
  THRESHOLD_REACHED = 'threshold_reached',
  RECOVERY_TEST = 'recovery_test',
  RECOVERY_SUCCESS = 'recovery_success',
  RECOVERY_FAILURE = 'recovery_failure',
  METRIC_UPDATE = 'metric_update',
}

export interface CircuitBreakerConfig {
  provider: string;
  failureThreshold: number;           // % of failures to open (e.g., 50 = 50%)
  failureCount: number;               // Consecutive failures to open (e.g., 5)
  successThreshold: number;           // Consecutive successes to close (e.g., 2)
  timeout: number;                    // Time in ms before half-open after open
  halfOpenRequests: number;            // Requests to test in half-open state
  cooldown: number;                   // Additional cooldown after recovery failure
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  lastStateChange: Date;
  stateChanges: number;
}

export interface CircuitBreakerEvent {
  timestamp: Date;
  state: CircuitState;
  reason: string;
  metrics: CircuitBreakerMetrics;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private stateChangeTime: number = Date.now();
  private halfOpenAttempts: number = 0;

  private metrics: CircuitBreakerMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rejectedRequests: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    lastStateChange: new Date(),
    stateChanges: 0,
  };

  private responseTimes: number[] = [];
  private readonly maxResponseTimeSamples = 1000;

  constructor(private config: CircuitBreakerConfig) {
    super();
    this.validateConfig();
    this.setupAutoRecovery();
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    // Check current state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptHalfOpen()) {
        this.transitionToHalfOpen();
      } else {
        this.metrics.rejectedRequests++;
        this.emit(CircuitEvent.METRIC_UPDATE, this.getMetrics());
        throw new Error(
          `Circuit breaker ${this.config.provider} is OPEN. Service unavailable.`
        );
      }
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.executeWithTimeout(operation);
      this.recordSuccess(startTime);
      return result;
    } catch (error) {
      this.recordFailure(startTime, error);

      // Attempt fallback if available
      if (fallback && this.state !== CircuitState.OPEN) {
        logger.warn(
          `CircuitBreaker[${this.config.provider}]: Primary failed, attempting fallback`,
          { error: error instanceof Error ? error.message : String(error) }
        );
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Synchronous check if circuit is available
   */
  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      return this.shouldAttemptHalfOpen();
    }

    // HALF_OPEN - limited availability
    return this.halfOpenAttempts < this.config.halfOpenRequests;
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.stateChangeTime = Date.now();
    this.metrics.stateChanges++;

    logger.info(
      `CircuitBreaker[${this.config.provider}]: RESET from ${previousState} to CLOSED`
    );

    this.emit(CircuitEvent.STATE_CHANGE, {
      from: previousState,
      to: this.state,
      reason: 'Manual reset',
    });
  }

  /**
   * Get historical events
   */
  getEventLog(): CircuitBreakerEvent[] {
    return [
      {
        timestamp: this.metrics.lastStateChange,
        state: this.state,
        reason: `Current state: ${this.state}`,
        metrics: this.getMetrics(),
      },
    ];
  }

  // ============ Private Methods ============

  private async executeWithTimeout<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

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

  private recordSuccess(startTime: number): void {
    const duration = Date.now() - startTime;
    this.metrics.successfulRequests++;
    this.recordResponseTime(duration);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.halfOpenAttempts++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }

    this.emit(CircuitEvent.METRIC_UPDATE, this.getMetrics());
  }

  private recordFailure(startTime: number, error: any): void {
    const duration = Date.now() - startTime;
    this.metrics.failedRequests++;
    this.recordResponseTime(duration);
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen('Recovery test failed');
    } else if (this.state === CircuitState.CLOSED) {
      const failureRate =
        (this.metrics.failedRequests / this.metrics.totalRequests) * 100;

      if (
        this.failureCount >= this.config.failureCount ||
        failureRate >= this.config.failureThreshold
      ) {
        this.transitionToOpen(`Failure threshold exceeded: ${failureRate.toFixed(2)}%`);
      }
    }

    this.emit(CircuitEvent.METRIC_UPDATE, this.getMetrics());
  }

  private recordResponseTime(duration: number): void {
    this.responseTimes.push(duration);

    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }

    // Update metrics
    this.metrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
  }

  private shouldAttemptHalfOpen(): boolean {
    const timeSinceFail = Date.now() - this.lastFailureTime;
    return timeSinceFail >= this.config.timeout;
  }

  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.stateChangeTime = Date.now();
    this.metrics.stateChanges++;

    logger.info(
      `CircuitBreaker[${this.config.provider}]: ${previousState} → CLOSED (recovered)`
    );

    this.emit(CircuitEvent.RECOVERY_SUCCESS, {
      provider: this.config.provider,
      timestamp: new Date(),
    });

    this.emit(CircuitEvent.STATE_CHANGE, {
      from: previousState,
      to: CircuitState.CLOSED,
      reason: 'Recovery successful',
    });
  }

  private transitionToOpen(reason: string): void {
    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.stateChangeTime = Date.now();
    this.metrics.stateChanges++;

    logger.warn(
      `CircuitBreaker[${this.config.provider}]: ${previousState} → OPEN`,
      { reason }
    );

    this.emit(CircuitEvent.THRESHOLD_REACHED, {
      provider: this.config.provider,
      reason,
      timestamp: new Date(),
    });

    this.emit(CircuitEvent.STATE_CHANGE, {
      from: previousState,
      to: CircuitState.OPEN,
      reason,
    });
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.stateChangeTime = Date.now();

    logger.info(
      `CircuitBreaker[${this.config.provider}]: ${previousState} → HALF_OPEN (testing recovery)`
    );

    this.emit(CircuitEvent.RECOVERY_TEST, {
      provider: this.config.provider,
      timestamp: new Date(),
      maxAttempts: this.config.halfOpenRequests,
    });

    this.emit(CircuitEvent.STATE_CHANGE, {
      from: previousState,
      to: CircuitState.HALF_OPEN,
      reason: 'Testing recovery',
    });
  }

  private setupAutoRecovery(): void {
    // Periodic health check and state management
    setInterval(() => {
      if (this.state === CircuitState.OPEN) {
        // Check if we should attempt recovery
        if (this.shouldAttemptHalfOpen()) {
          this.transitionToHalfOpen();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  private validateConfig(): void {
    if (this.config.failureThreshold < 0 || this.config.failureThreshold > 100) {
      throw new Error('failureThreshold must be between 0 and 100');
    }
    if (this.config.failureCount < 1) {
      throw new Error('failureCount must be at least 1');
    }
    if (this.config.successThreshold < 1) {
      throw new Error('successThreshold must be at least 1');
    }
    if (this.config.timeout < 100) {
      throw new Error('timeout must be at least 100ms');
    }
    if (this.config.halfOpenRequests < 1) {
      throw new Error('halfOpenRequests must be at least 1');
    }
  }
}

/**
 * Circuit breaker factory for multiple providers
 */
export class CircuitBreakerFactory {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultConfig: Partial<CircuitBreakerConfig> = {
    failureThreshold: 50,
    failureCount: 5,
    successThreshold: 2,
    timeout: 30000,
    halfOpenRequests: 3,
    cooldown: 60000,
  };

  /**
   * Get or create circuit breaker for provider
   */
  getBreaker(provider: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      const mergedConfig: CircuitBreakerConfig = {
        provider,
        ...(this.defaultConfig as CircuitBreakerConfig),
        ...config,
      };
      this.breakers.set(provider, new CircuitBreaker(mergedConfig));
    }
    return this.breakers.get(provider)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get status of all breakers
   */
  getAllStatus(): Record<string, { state: CircuitState; metrics: CircuitBreakerMetrics }> {
    const status: Record<string, any> = {};
    this.breakers.forEach((breaker, provider) => {
      status[provider] = {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
      };
    });
    return status;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }
}

// Singleton instance
export const circuitBreakerFactory = new CircuitBreakerFactory();
