/**
 * BulkheadPattern.ts
 * Resource isolation pattern to prevent cascading failures
 * Per-provider thread pool management with queue depth limits and backpressure handling
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface BulkheadConfig {
  provider: string;
  maxConcurrent: number;        // Max concurrent operations
  maxQueueSize: number;         // Max queued operations
  maxQueueWaitTime: number;     // Max time to wait in queue (ms)
  rejectionPolicy: 'ABORT' | 'RETRY' | 'CALLER_RUNS'; // What to do when queue full
  timeout: number;              // Operation timeout
  monitoringInterval: number;   // How often to report metrics
}

export interface BulkheadMetrics {
  maxConcurrent: number;
  currentConcurrent: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageWaitTime: number;
  maxWaitTime: number;
  currentQueueSize: number;
  peakQueueSize: number;
  cpuUtilization: number;
}

export interface BulkheadEvent {
  timestamp: Date;
  eventType: string;
  provider: string;
  details: Record<string, any>;
}

enum RejectionPolicy {
  ABORT = 'ABORT',
  RETRY = 'RETRY',
  CALLER_RUNS = 'CALLER_RUNS',
}

interface QueuedTask<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  timeout: NodeJS.Timeout | null;
}

export class BulkheadIsolation extends EventEmitter {
  private activeOperations: Set<string> = new Set();
  private queue: QueuedTask<any>[] = [];
  private metrics: BulkheadMetrics;
  private waitTimes: number[] = [];
  private readonly maxSamples = 1000;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(private config: BulkheadConfig) {
    super();
    this.validateConfig();

    this.metrics = {
      maxConcurrent: config.maxConcurrent,
      currentConcurrent: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageWaitTime: 0,
      maxWaitTime: 0,
      currentQueueSize: 0,
      peakQueueSize: 0,
      cpuUtilization: 0,
    };

    this.startMonitoring();
  }

  /**
   * Submit operation to bulkhead
   */
  async submit<T>(operation: () => Promise<T>): Promise<T> {
    const taskId = this.generateTaskId();
    this.metrics.totalRequests++;

    // Check if we can run immediately
    if (this.activeOperations.size < this.config.maxConcurrent) {
      return this.executeTask(taskId, operation);
    }

    // Check if we can queue
    if (this.queue.length >= this.config.maxQueueSize) {
      this.metrics.rejectedRequests++;
      return this.handleRejection(taskId, operation);
    }

    // Queue the operation
    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask<T> = {
        id: taskId,
        operation,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        timeout: null,
      };

      // Setup timeout for queue wait
      queuedTask.timeout = setTimeout(() => {
        const index = this.queue.indexOf(queuedTask);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.metrics.rejectedRequests++;
          reject(
            new Error(
              `Bulkhead[${this.config.provider}]: Queue wait timeout exceeded`
            )
          );
          this.processQueue();
        }
      }, this.config.maxQueueWaitTime);

      this.queue.push(queuedTask);
      this.metrics.currentQueueSize = this.queue.length;
      this.metrics.peakQueueSize = Math.max(
        this.metrics.peakQueueSize,
        this.queue.length
      );
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): BulkheadMetrics {
    return { ...this.metrics };
  }

  /**
   * Get bulkhead status
   */
  getStatus(): {
    isHealthy: boolean;
    utilizationPercent: number;
    queueUtilizationPercent: number;
    estimatedWaitTime: number;
  } {
    const utilizationPercent =
      (this.activeOperations.size / this.config.maxConcurrent) * 100;
    const queueUtilizationPercent =
      (this.queue.length / this.config.maxQueueSize) * 100;

    return {
      isHealthy: utilizationPercent < 80 && queueUtilizationPercent < 80,
      utilizationPercent,
      queueUtilizationPercent,
      estimatedWaitTime: this.estimateWaitTime(),
    };
  }

  /**
   * Stop accepting new operations
   */
  drain(): Promise<void> {
    return new Promise((resolve) => {
      const checkEmpty = () => {
        if (this.activeOperations.size === 0 && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(checkEmpty, 100);
        }
      };
      checkEmpty();
    });
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.waitTimes = [];
    this.metrics.totalRequests = 0;
    this.metrics.successfulRequests = 0;
    this.metrics.failedRequests = 0;
    this.metrics.rejectedRequests = 0;
    this.metrics.averageWaitTime = 0;
    this.metrics.maxWaitTime = 0;
    this.metrics.peakQueueSize = 0;
  }

  /**
   * Shutdown bulkhead
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Clear pending operations
    this.queue.forEach((task) => {
      if (task.timeout) clearTimeout(task.timeout);
      task.reject(new Error('Bulkhead shutting down'));
    });
    this.queue = [];

    logger.info(
      `Bulkhead[${this.config.provider}]: Shutdown complete. Final metrics:`,
      this.getMetrics()
    );
  }

  // ============ Private Methods ============

  private async executeTask<T>(
    taskId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.activeOperations.add(taskId);
    this.metrics.currentConcurrent = this.activeOperations.size;

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeout<T>(taskId),
      ]);
      this.metrics.successfulRequests++;
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    } finally {
      this.activeOperations.delete(taskId);
      this.metrics.currentConcurrent = this.activeOperations.size;
      this.processQueue();
    }
  }

  private createTimeout<T>(taskId: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Bulkhead[${this.config.provider}]: Operation timeout (${taskId})`
          )
        );
      }, this.config.timeout);
    });
  }

  private async processQueue(): Promise<void> {
    while (
      this.queue.length > 0 &&
      this.activeOperations.size < this.config.maxConcurrent
    ) {
      const task = this.queue.shift();
      if (!task) break;

      this.metrics.currentQueueSize = this.queue.length;

      if (task.timeout) clearTimeout(task.timeout);

      const waitTime = Date.now() - task.enqueuedAt;
      this.recordWaitTime(waitTime);

      try {
        const result = await this.executeTask(task.id, task.operation);
        task.resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async handleRejection<T>(
    taskId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const policy = this.config.rejectionPolicy;

    if (policy === RejectionPolicy.ABORT) {
      throw new Error(
        `Bulkhead[${this.config.provider}]: Queue full, rejecting operation`
      );
    }

    if (policy === RejectionPolicy.CALLER_RUNS) {
      logger.warn(
        `Bulkhead[${this.config.provider}]: Running operation on caller thread`
      );
      return operation();
    }

    if (policy === RejectionPolicy.RETRY) {
      logger.warn(
        `Bulkhead[${this.config.provider}]: Retrying operation in queue`
      );
      return this.retryWithBackoff(operation, 3);
    }

    throw new Error(`Unknown rejection policy: ${policy}`);
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    attempt: number = 1
  ): Promise<T> {
    try {
      // Try to queue again
      return await this.submit(operation);
    } catch (error) {
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.retryWithBackoff(operation, maxRetries, attempt + 1);
      }
      throw error;
    }
  }

  private recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > this.maxSamples) {
      this.waitTimes.shift();
    }

    this.metrics.averageWaitTime =
      this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    this.metrics.maxWaitTime = Math.max(...this.waitTimes);
  }

  private estimateWaitTime(): number {
    const tasksAhead = this.queue.length;
    const avgOperationTime =
      this.metrics.averageWaitTime > 0 ? this.metrics.averageWaitTime : 100;
    const availableSlots =
      this.config.maxConcurrent - this.activeOperations.size;

    return availableSlots > 0
      ? (tasksAhead / availableSlots) * avgOperationTime
      : tasksAhead * avgOperationTime;
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      // Calculate CPU utilization (simplified)
      const utilization =
        (this.activeOperations.size / this.config.maxConcurrent) * 100;
      this.metrics.cpuUtilization = utilization;

      // Emit metrics
      if (utilization > 80) {
        this.emit('high-utilization', {
          provider: this.config.provider,
          utilization,
          activeOperations: this.activeOperations.size,
          queueSize: this.queue.length,
          timestamp: new Date(),
        });
      }
    }, this.config.monitoringInterval);
  }

  private generateTaskId(): string {
    return `${this.config.provider}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  private validateConfig(): void {
    if (this.config.maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1');
    }
    if (this.config.maxQueueSize < 0) {
      throw new Error('maxQueueSize must be non-negative');
    }
    if (this.config.maxQueueWaitTime < 100) {
      throw new Error('maxQueueWaitTime must be at least 100ms');
    }
    if (this.config.timeout < 100) {
      throw new Error('timeout must be at least 100ms');
    }
  }
}

/**
 * Bulkhead factory for multiple providers
 */
export class BulkheadFactory {
  private bulkheads: Map<string, BulkheadIsolation> = new Map();
  private readonly defaultConfig: Partial<BulkheadConfig> = {
    maxConcurrent: 10,
    maxQueueSize: 100,
    maxQueueWaitTime: 30000,
    rejectionPolicy: 'RETRY',
    timeout: 30000,
    monitoringInterval: 5000,
  };

  /**
   * Get or create bulkhead for provider
   */
  getBulkhead(
    provider: string,
    config?: Partial<BulkheadConfig>
  ): BulkheadIsolation {
    if (!this.bulkheads.has(provider)) {
      const mergedConfig: BulkheadConfig = {
        provider,
        ...(this.defaultConfig as BulkheadConfig),
        ...config,
      };
      this.bulkheads.set(provider, new BulkheadIsolation(mergedConfig));
    }
    return this.bulkheads.get(provider)!;
  }

  /**
   * Get all bulkheads
   */
  getAllBulkheads(): BulkheadIsolation[] {
    return Array.from(this.bulkheads.values());
  }

  /**
   * Get status of all bulkheads
   */
  getAllStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    this.bulkheads.forEach((bulkhead, provider) => {
      status[provider] = bulkhead.getStatus();
    });
    return status;
  }

  /**
   * Shutdown all bulkheads
   */
  shutdownAll(): void {
    this.bulkheads.forEach((bulkhead) => bulkhead.shutdown());
  }
}

// Singleton instance
export const bulkheadFactory = new BulkheadFactory();
