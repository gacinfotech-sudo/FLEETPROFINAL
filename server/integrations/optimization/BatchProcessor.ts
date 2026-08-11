/**
 * BatchProcessor
 * Message batching system for multiple providers
 * Supports batching for: WhatsApp, Calling, GPS, KYC/DigiLocker, eSign
 * Configurable batch sizes and flush timing with throughput optimization
 */

import { createLogger } from '../../utils/logger';

/**
 * Batch item interface
 */
interface BatchItem<T = any> {
  id: string;
  data: T;
  addedAt: Date;
  priority?: number;
  retryCount?: number;
}

/**
 * Batch configuration
 */
interface BatchConfig {
  maxBatchSize: number;
  flushInterval: number; // milliseconds
  maxWaitTime?: number; // milliseconds before forced flush
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Batch statistics
 */
export interface BatchStatistics {
  totalBatches: number;
  totalItems: number;
  averageBatchSize: number;
  averageFlushTime: number; // milliseconds
  successfulBatches: number;
  failedBatches: number;
  throughput: number; // items per second
}

/**
 * Provider-specific batch configurations
 */
export interface ProviderBatchConfigs {
  whatsapp?: BatchConfig;
  calling?: BatchConfig;
  gps?: BatchConfig;
  kyc?: BatchConfig;
  esign?: BatchConfig;
}

/**
 * Batch processor callback
 */
type BatchProcessorCallback<T = any> = (
  items: T[],
) => Promise<{ success: boolean; results?: any; errors?: any }>;

/**
 * BatchProcessor
 * Manages batching for multiple provider types
 */
export class BatchProcessor {
  private logger: any;
  private batches: Map<string, BatchItem[]> = new Map();
  private batchConfigs: Map<string, BatchConfig> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private processors: Map<string, BatchProcessorCallback> = new Map();
  private statistics: {
    totalBatches: number;
    totalItems: number;
    totalFlushTime: number;
    successfulBatches: number;
    failedBatches: number;
    startTime: Date;
  } = {
    totalBatches: 0,
    totalItems: 0,
    totalFlushTime: 0,
    successfulBatches: 0,
    failedBatches: 0,
    startTime: new Date(),
  };

  constructor(configs?: ProviderBatchConfigs) {
    this.logger = createLogger('BatchProcessor');
    this.initializeDefaultConfigs();

    if (configs) {
      this.registerConfigs(configs);
    }
  }

  /**
   * Initialize default batch configurations
   */
  private initializeDefaultConfigs(): void {
    // WhatsApp: larger batches, 2-5 second flush
    this.batchConfigs.set('whatsapp', {
      maxBatchSize: 50,
      flushInterval: 3000,
      maxWaitTime: 5000,
      priority: 'high',
    });

    // Calling: smaller batches, faster flush
    this.batchConfigs.set('calling', {
      maxBatchSize: 20,
      flushInterval: 2000,
      maxWaitTime: 3000,
      priority: 'high',
    });

    // GPS: medium batches, moderate flush
    this.batchConfigs.set('gps', {
      maxBatchSize: 30,
      flushInterval: 4000,
      maxWaitTime: 6000,
      priority: 'normal',
    });

    // KYC: small batches, careful processing
    this.batchConfigs.set('kyc', {
      maxBatchSize: 10,
      flushInterval: 5000,
      maxWaitTime: 10000,
      priority: 'high',
    });

    // eSign: small batches, careful processing
    this.batchConfigs.set('esign', {
      maxBatchSize: 15,
      flushInterval: 3000,
      maxWaitTime: 7000,
      priority: 'high',
    });
  }

  /**
   * Register custom batch configurations
   */
  registerConfigs(configs: ProviderBatchConfigs): void {
    if (configs.whatsapp) {
      this.batchConfigs.set('whatsapp', configs.whatsapp);
    }
    if (configs.calling) {
      this.batchConfigs.set('calling', configs.calling);
    }
    if (configs.gps) {
      this.batchConfigs.set('gps', configs.gps);
    }
    if (configs.kyc) {
      this.batchConfigs.set('kyc', configs.kyc);
    }
    if (configs.esign) {
      this.batchConfigs.set('esign', configs.esign);
    }
  }

  /**
   * Register batch processor callback
   */
  registerProcessor<T = any>(
    providerType: string,
    processor: BatchProcessorCallback<T>,
  ): void {
    this.processors.set(providerType, processor);
    this.logger.info('Processor registered', { providerType });
  }

  /**
   * Add item to batch
   */
  async addItem<T = any>(
    providerType: string,
    item: T,
    options?: { priority?: number; autoFlush?: boolean },
  ): Promise<void> {
    const config = this.batchConfigs.get(providerType);
    if (!config) {
      throw new Error(
        `No batch configuration for provider: ${providerType}`,
      );
    }

    const batchKey = providerType;
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
    }

    const batch = this.batches.get(batchKey)!;
    const batchItem: BatchItem<T> = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: item,
      addedAt: new Date(),
      priority: options?.priority || 0,
      retryCount: 0,
    };

    batch.push(batchItem);
    this.statistics.totalItems++;

    this.logger.debug('Item added to batch', {
      providerType,
      batchSize: batch.length,
      maxBatchSize: config.maxBatchSize,
    });

    // Check if batch should be flushed
    if (batch.length >= config.maxBatchSize) {
      await this.flush(providerType);
    } else if (!this.flushTimers.has(batchKey)) {
      // Start flush timer
      const timer = setTimeout(() => {
        this.flush(providerType).catch((error) => {
          this.logger.error('Batch flush error', error as Error);
        });
      }, config.flushInterval);

      this.flushTimers.set(batchKey, timer);
    }
  }

  /**
   * Add multiple items to batch
   */
  async addItems<T = any>(
    providerType: string,
    items: T[],
  ): Promise<void> {
    for (const item of items) {
      await this.addItem(providerType, item);
    }
  }

  /**
   * Flush batch for a provider
   */
  async flush(providerType: string): Promise<void> {
    const batchKey = providerType;
    const batch = this.batches.get(batchKey);

    if (!batch || batch.length === 0) {
      return;
    }

    // Clear flush timer
    if (this.flushTimers.has(batchKey)) {
      clearTimeout(this.flushTimers.get(batchKey)!);
      this.flushTimers.delete(batchKey);
    }

    const startTime = Date.now();
    const batchSize = batch.length;
    const processor = this.processors.get(providerType);

    if (!processor) {
      this.logger.error('No processor for provider', {
        providerType,
      });
      return;
    }

    try {
      this.logger.info('Flushing batch', {
        providerType,
        itemCount: batchSize,
      });

      // Sort by priority
      batch.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Extract data from batch items
      const data = batch.map((item) => item.data);

      // Process batch
      const result = await processor(data);

      const flushTime = Date.now() - startTime;
      this.statistics.totalFlushTime += flushTime;
      this.statistics.totalBatches++;
      this.statistics.successfulBatches++;

      if (result.success) {
        this.batches.set(batchKey, []);

        this.logger.info('Batch flushed successfully', {
          providerType,
          itemCount: batchSize,
          flushTime,
          avgTime: flushTime / batchSize,
        });
      } else {
        this.statistics.failedBatches++;
        this.logger.error('Batch processing failed', {
          providerType,
          itemCount: batchSize,
          errors: result.errors,
        });
      }
    } catch (error) {
      this.statistics.failedBatches++;
      this.logger.error('Batch flush error', error as Error, {
        providerType,
        batchSize,
      });
    }
  }

  /**
   * Flush all batches
   */
  async flushAll(): Promise<void> {
    this.logger.info('Flushing all batches', {
      batchCount: this.batches.size,
    });

    const keys = Array.from(this.batches.keys());
    for (const providerType of keys) {
      await this.flush(providerType);
    }
  }

  /**
   * Get batch status for provider
   */
  getBatchStatus(providerType: string): {
    itemCount: number;
    oldestItem?: Date;
    config: BatchConfig | undefined;
  } {
    const batch = this.batches.get(providerType);
    const config = this.batchConfigs.get(providerType);

    return {
      itemCount: batch?.length || 0,
      oldestItem: batch?.[0]?.addedAt,
      config,
    };
  }

  /**
   * Get all batch statuses
   */
  getAllBatchStatuses(): Map<
    string,
    { itemCount: number; oldestItem?: Date; config: BatchConfig | undefined }
  > {
    const statuses = new Map();
    const keys = Array.from(this.batchConfigs.keys());
    for (const providerType of keys) {
      statuses.set(providerType, this.getBatchStatus(providerType));
    }
    return statuses;
  }

  /**
   * Get processor statistics
   */
  getStatistics(): BatchStatistics {
    const uptime = Date.now() - this.statistics.startTime.getTime();
    const throughput =
      uptime > 0
        ? (this.statistics.totalItems / uptime) * 1000
        : 0;

    return {
      totalBatches: this.statistics.totalBatches,
      totalItems: this.statistics.totalItems,
      averageBatchSize:
        this.statistics.totalBatches > 0
          ? this.statistics.totalItems /
            this.statistics.totalBatches
          : 0,
      averageFlushTime:
        this.statistics.totalBatches > 0
          ? this.statistics.totalFlushTime /
            this.statistics.totalBatches
          : 0,
      successfulBatches: this.statistics.successfulBatches,
      failedBatches: this.statistics.failedBatches,
      throughput,
    };
  }

  /**
   * Get batch configuration
   */
  getConfig(providerType: string): BatchConfig | undefined {
    return this.batchConfigs.get(providerType);
  }

  /**
   * Update batch configuration
   */
  updateConfig(
    providerType: string,
    config: Partial<BatchConfig>,
  ): void {
    const existing = this.batchConfigs.get(providerType);
    if (existing) {
      this.batchConfigs.set(providerType, {
        ...existing,
        ...config,
      });

      this.logger.info('Batch config updated', {
        providerType,
        config: this.batchConfigs.get(providerType),
      });
    }
  }

  /**
   * Clear all batches
   */
  async clear(): Promise<void> {
    // Cancel all timers
    const timers = Array.from(this.flushTimers.values());
    for (const timer of timers) {
      clearTimeout(timer);
    }
    this.flushTimers.clear();

    // Clear batches
    this.batches.clear();

    this.logger.info('All batches cleared');
  }

  /**
   * Get pending items count
   */
  getPendingItemsCount(): number {
    let total = 0;
    const batches = Array.from(this.batches.values());
    for (const batch of batches) {
      total += batch.length;
    }
    return total;
  }

  /**
   * Get batch by provider type
   */
  getBatch(providerType: string): BatchItem[] {
    return this.batches.get(providerType) || [];
  }

  /**
   * Optimize batch size based on throughput
   */
  optimizeBatchSize(
    providerType: string,
    targetThroughput?: number,
  ): void {
    const config = this.batchConfigs.get(providerType);
    if (!config) {
      return;
    }

    const stats = this.getStatistics();

    // Adjust batch size based on throughput and success rate
    const successRate =
      stats.totalBatches > 0
        ? stats.successfulBatches / stats.totalBatches
        : 0;

    if (successRate > 0.95 && config.maxBatchSize < 200) {
      // Increase batch size for high success rate
      config.maxBatchSize = Math.min(
        config.maxBatchSize * 1.1,
        200,
      );
    } else if (successRate < 0.8 && config.maxBatchSize > 5) {
      // Decrease batch size for low success rate
      config.maxBatchSize = Math.max(
        config.maxBatchSize * 0.9,
        5,
      );
    }

    this.logger.info('Batch size optimized', {
      providerType,
      newSize: config.maxBatchSize,
      successRate: (successRate * 100).toFixed(2) + '%',
    });
  }
}

export default BatchProcessor;
