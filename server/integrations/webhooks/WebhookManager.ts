/**
 * Webhook Management System
 * Enterprise-grade webhook handling with HMAC-SHA256 verification,
 * delivery tracking, retry logic, and dead letter queue
 */

import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { WebhookLog, WebhookDelivery, WebhookConfig } from '../models';

interface WebhookPayload {
  id: string;
  eventType: string;
  timestamp: Date;
  data: Record<string, any>;
  tenantId: string;
}

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  retryCount: number;
  nextRetry?: Date;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 3600000, // 1 hour
  jitter: true,
};

export class WebhookManager extends EventEmitter {
  private activeDeliveries: Map<string, Promise<DeliveryResult>> = new Map();
  private deadLetterQueue: WebhookPayload[] = [];
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    super();
    this.initializeDeadLetterProcessor();
  }

  /**
   * Register a webhook for a tenant
   */
  async registerWebhook(
    tenantId: string,
    config: {
      url: string;
      events: string[];
      secret: string;
      isActive: boolean;
      name?: string;
      description?: string;
      headers?: Record<string, string>;
    }
  ): Promise<WebhookConfig> {
    const webhookId = `wh_${crypto.randomBytes(12).toString('hex')}`;
    const hashedSecret = this.hashSecret(config.secret);

    const webhook: WebhookConfig = {
      id: webhookId,
      tenantId,
      url: config.url,
      events: config.events,
      secret: hashedSecret,
      isActive: config.isActive,
      name: config.name || `Webhook ${webhookId}`,
      description: config.description,
      headers: config.headers || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      testUrl: config.url,
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
        lastDeliveryAt: null,
      },
    };

    return webhook;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    webhookId: string,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookConfig> {
    // Implementation would update in database
    const webhook = { ...updates, id: webhookId, updatedAt: new Date() } as WebhookConfig;
    return webhook;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    // Clear any pending retries
    const retryKey = `retry_${webhookId}`;
    if (this.retryQueue.has(retryKey)) {
      clearTimeout(this.retryQueue.get(retryKey));
      this.retryQueue.delete(retryKey);
    }

    // Implementation would delete from database
    this.emit('webhook:deleted', { webhookId, timestamp: new Date() });
  }

  /**
   * Deliver webhook event to a registered webhook URL
   */
  async deliverWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<DeliveryResult> {
    const deliveryId = `del_${crypto.randomBytes(12).toString('hex')}`;
    const startTime = Date.now();

    try {
      const signature = this.generateSignature(payload, webhook.secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': webhook.id,
        'X-Delivery-ID': deliveryId,
        'X-Timestamp': new Date().toISOString(),
        ...webhook.headers,
      };

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000, // 30 second timeout
        validateStatus: (status) => status < 500, // Don't throw on 4xx
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      const result: DeliveryResult = {
        success,
        statusCode: response.status,
        responseTime,
        retryCount: 0,
      };

      // Log successful delivery
      await this.logDelivery(webhook.id, payload, result, success);

      if (success) {
        this.emit('delivery:success', {
          webhookId: webhook.id,
          deliveryId,
          statusCode: response.status,
          responseTime,
        });
      } else {
        // Retry on 4xx/5xx
        result.nextRetry = this.calculateNextRetry(0);
        await this.scheduleRetry(webhook, payload, 0, result.nextRetry);
      }

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      const result: DeliveryResult = {
        success: false,
        responseTime,
        error: error.message,
        retryCount: 0,
        nextRetry: this.calculateNextRetry(0),
      };

      // Log failed delivery
      await this.logDelivery(webhook.id, payload, result, false);

      // Schedule retry
      await this.scheduleRetry(webhook, payload, 0, result.nextRetry);

      this.emit('delivery:failed', {
        webhookId: webhook.id,
        deliveryId,
        error: error.message,
        nextRetry: result.nextRetry,
      });

      return result;
    }
  }

  /**
   * Retry webhook delivery with exponential backoff
   */
  async retryWebhookDelivery(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    retryCount: number = 0
  ): Promise<DeliveryResult> {
    if (retryCount >= this.retryConfig.maxRetries) {
      // Move to dead letter queue
      this.deadLetterQueue.push(payload);
      this.emit('delivery:deadletter', {
        webhookId: webhook.id,
        payload,
        reason: 'Max retries exceeded',
      });

      return {
        success: false,
        responseTime: 0,
        error: 'Max retries exceeded',
        retryCount,
      };
    }

    const startTime = Date.now();

    try {
      const signature = this.generateSignature(payload, webhook.secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': webhook.id,
        'X-Retry-Count': retryCount.toString(),
        'X-Timestamp': new Date().toISOString(),
        ...webhook.headers,
      };

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      const result: DeliveryResult = {
        success,
        statusCode: response.status,
        responseTime,
        retryCount,
      };

      if (success) {
        this.emit('delivery:success_after_retry', {
          webhookId: webhook.id,
          retryCount,
          responseTime,
        });
      } else {
        result.nextRetry = this.calculateNextRetry(retryCount + 1);
        await this.scheduleRetry(webhook, payload, retryCount + 1, result.nextRetry);
      }

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const nextRetry = this.calculateNextRetry(retryCount + 1);

      const result: DeliveryResult = {
        success: false,
        responseTime,
        error: error.message,
        retryCount,
        nextRetry,
      };

      await this.scheduleRetry(webhook, payload, retryCount + 1, nextRetry);

      return result;
    }
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhook: WebhookConfig): Promise<DeliveryResult> {
    const testPayload: WebhookPayload = {
      id: `test_${crypto.randomBytes(6).toString('hex')}`,
      eventType: 'webhook.test',
      timestamp: new Date(),
      data: {
        message: 'Test webhook delivery',
        timestamp: new Date().toISOString(),
      },
      tenantId: webhook.tenantId,
    };

    return this.deliverWebhook(webhook, testPayload);
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Hash webhook secret for storage
   */
  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateNextRetry(retryCount: number): Date {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, retryCount),
      this.retryConfig.maxDelay
    );

    const jitter = this.retryConfig.jitter
      ? Math.random() * delay * 0.1
      : 0;

    const totalDelay = Math.floor(delay + jitter);
    return new Date(Date.now() + totalDelay);
  }

  /**
   * Schedule retry for failed delivery
   */
  private async scheduleRetry(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    retryCount: number,
    retryTime: Date
  ): Promise<void> {
    const retryKey = `retry_${webhook.id}_${payload.id}`;
    const delayMs = retryTime.getTime() - Date.now();

    if (this.retryQueue.has(retryKey)) {
      clearTimeout(this.retryQueue.get(retryKey));
    }

    const timeoutId = setTimeout(async () => {
      await this.retryWebhookDelivery(webhook, payload, retryCount);
      this.retryQueue.delete(retryKey);
    }, Math.max(0, delayMs));

    this.retryQueue.set(retryKey, timeoutId);
  }

  /**
   * Log webhook delivery
   */
  private async logDelivery(
    webhookId: string,
    payload: WebhookPayload,
    result: DeliveryResult,
    success: boolean
  ): Promise<void> {
    const log: WebhookLog = {
      id: `log_${crypto.randomBytes(6).toString('hex')}`,
      webhookId,
      eventType: payload.eventType,
      payload,
      status: success ? 'success' : 'failed',
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
      timestamp: new Date(),
      retryCount: result.retryCount,
    };

    // Store in database
    this.emit('delivery:logged', log);
  }

  /**
   * Initialize dead letter processor
   */
  private initializeDeadLetterProcessor(): void {
    // Process dead letter queue periodically
    setInterval(() => {
      if (this.deadLetterQueue.length > 0) {
        this.emit('deadletter:queue', {
          count: this.deadLetterQueue.length,
          items: this.deadLetterQueue.slice(0, 10),
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): WebhookPayload[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
    this.emit('deadletter:cleared', { timestamp: new Date() });
  }

  /**
   * Replay webhook from dead letter queue
   */
  async replayWebhook(
    webhookId: string,
    payloadId: string,
    webhook: WebhookConfig
  ): Promise<DeliveryResult> {
    const index = this.deadLetterQueue.findIndex((p) => p.id === payloadId);
    if (index === -1) {
      throw new Error('Payload not found in dead letter queue');
    }

    const payload = this.deadLetterQueue[index];
    const result = await this.deliverWebhook(webhook, payload);

    if (result.success) {
      this.deadLetterQueue.splice(index, 1);
      this.emit('deadletter:replayed', { webhookId, payloadId });
    }

    return result;
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string): Promise<any> {
    return {
      webhookId,
      activeRetries: Array.from(this.retryQueue.keys()).filter((k) =>
        k.includes(webhookId)
      ).length,
      deadLetterCount: this.deadLetterQueue.length,
      timestamp: new Date(),
    };
  }
}

export default WebhookManager;
