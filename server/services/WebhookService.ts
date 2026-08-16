import { WebhookConfiguration, WebhookDelivery } from '../models/enterprise.models';
import axios from 'axios';
import crypto from 'crypto';

/**
 * WAVE 21: Webhook System Service
 * Webhook delivery, retry logic, signature verification, delivery history
 */
export class WebhookService {
  /**
   * Create webhook subscription
   */
  async createWebhook(tenantId: string, data: any): Promise<any> {
    // Generate secret for HMAC
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = new WebhookConfiguration({
      tenantId,
      name: data.name,
      url: data.url,
      events: data.events,
      secret,
      headers: data.headers || {},
      retryPolicy: {
        maxRetries: data.maxRetries || 5,
        backoffMs: data.backoffMs || 1000,
        exponentialBackoff: data.exponentialBackoff !== false,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return webhook.save();
  }

  /**
   * Send webhook event
   */
  async sendWebhookEvent(
    tenantId: string,
    eventType: string,
    payload: Record<string, any>
  ): Promise<void> {
    // Find all active webhooks for this event
    const webhooks = await WebhookConfiguration.find({
      tenantId,
      isActive: true,
      'events.0': { $exists: true }, // Has at least one event
    });

    for (const webhook of webhooks) {
      // Check if webhook is subscribed to this event type
      const isSubscribed = webhook.events.some((event: any) => {
        const [entity, action] = eventType.split('.');
        return event.entity === entity && event.action === action;
      });

      if (!isSubscribed) continue;

      // Create delivery record
      const delivery = new WebhookDelivery({
        tenantId,
        webhookId: webhook._id,
        eventType,
        payload,
        delivery: {
          status: 'pending',
          attempts: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await delivery.save();

      // Attempt delivery
      await this.deliverWebhook(webhook, delivery);
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWebhook(webhook: any, delivery: any): Promise<void> {
    const maxRetries = webhook.retryPolicy.maxRetries;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        // Create HMAC signature
        const signature = this.generateSignature(delivery.payload, webhook.secret);

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Timestamp': new Date().toISOString(),
          ...webhook.headers,
        };

        // Send webhook
        const response = await axios.post(webhook.url, delivery.payload, {
          headers,
          timeout: 5000, // 5 second timeout
        });

        // Success
        delivery.delivery.status = 'delivered';
        delivery.delivery.statusCode = response.status;
        delivery.delivery.response = JSON.stringify(response.data).slice(0, 1000);
        delivery.delivery.lastAttemptAt = new Date();
        delivery.updatedAt = new Date();

        await delivery.save();
        break;
      } catch (error: any) {
        attempts++;
        delivery.delivery.attempts = attempts;
        delivery.delivery.statusCode = error.response?.status;
        delivery.delivery.response = error.message.slice(0, 500);
        delivery.delivery.lastAttemptAt = new Date();

        if (attempts < maxRetries) {
          // Schedule retry with exponential backoff
          const delay = webhook.retryPolicy.exponentialBackoff
            ? webhook.retryPolicy.backoffMs * Math.pow(2, attempts - 1)
            : webhook.retryPolicy.backoffMs;

          delivery.delivery.nextRetryAt = new Date(Date.now() + delay);
          delivery.delivery.status = 'pending';
        } else {
          // Max retries exceeded
          delivery.delivery.status = 'failed';
        }

        delivery.updatedAt = new Date();
        await delivery.save();

        if (attempts < maxRetries) {
          // Wait before retry
          await new Promise((resolve) =>
            setTimeout(resolve, webhook.retryPolicy.backoffMs)
          );
        }
      }
    }
  }

  /**
   * Generate HMAC signature
   */
  private generateSignature(payload: Record<string, any>, secret: string): string {
    const message = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(tenantId: string, webhookId: string): Promise<any> {
    const webhook = await WebhookConfiguration.findOne({
      _id: webhookId,
      tenantId,
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook delivery',
    };

    try {
      const signature = this.generateSignature(testPayload, webhook.secret);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'test.event',
        'X-Webhook-Test': 'true',
      };

      const response = await axios.post(webhook.url, testPayload, {
        headers,
        timeout: 5000,
      });

      return {
        success: true,
        statusCode: response.status,
        response: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        statusCode: error.response?.status || 0,
        error: error.message,
      };
    }
  }

  /**
   * List webhook deliveries
   */
  async listWebhookDeliveries(
    tenantId: string,
    webhookId: string,
    limit: number = 50
  ): Promise<any[]> {
    return WebhookDelivery.find({
      tenantId,
      webhookId,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get webhook delivery details
   */
  async getWebhookDeliveryDetails(tenantId: string, deliveryId: string): Promise<any> {
    return WebhookDelivery.findOne({
      _id: deliveryId,
      tenantId,
    });
  }

  /**
   * Retry failed webhook delivery
   */
  async retryWebhookDelivery(tenantId: string, deliveryId: string): Promise<void> {
    const delivery = await WebhookDelivery.findOne({
      _id: deliveryId,
      tenantId,
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const webhook = await WebhookConfiguration.findOne({
      _id: delivery.webhookId,
      tenantId,
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Reset delivery status
    delivery.delivery.status = 'pending';
    delivery.delivery.attempts = 0;
    delivery.delivery.nextRetryAt = undefined;
    delivery.updatedAt = new Date();

    await delivery.save();

    // Retry
    await this.deliverWebhook(webhook, delivery);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
    await WebhookConfiguration.deleteOne({
      _id: webhookId,
      tenantId,
    });

    // Clean up deliveries
    await WebhookDelivery.deleteMany({
      tenantId,
      webhookId,
    });
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(tenantId: string, webhookId: string): Promise<any> {
    const deliveries = await WebhookDelivery.find({
      tenantId,
      webhookId,
    });

    return {
      total: deliveries.length,
      delivered: deliveries.filter((d) => d.delivery.status === 'delivered').length,
      failed: deliveries.filter((d) => d.delivery.status === 'failed').length,
      pending: deliveries.filter((d) => d.delivery.status === 'pending').length,
      successRate: deliveries.length > 0
        ? (deliveries.filter((d) => d.delivery.status === 'delivered').length / deliveries.length) * 100
        : 0,
      avgDeliveryTime: this.calculateAvgDeliveryTime(deliveries),
    };
  }

  /**
   * Calculate average delivery time
   */
  private calculateAvgDeliveryTime(deliveries: any[]): number {
    const completedDeliveries = deliveries.filter(
      (d) => d.delivery.status === 'delivered' && d.delivery.lastAttemptAt
    );

    if (completedDeliveries.length === 0) return 0;

    const totalTime = completedDeliveries.reduce(
      (sum, d) => sum + (d.delivery.lastAttemptAt.getTime() - d.createdAt.getTime()),
      0
    );

    return Math.round(totalTime / completedDeliveries.length);
  }

  /**
   * List webhooks
   */
  async listWebhooks(tenantId: string): Promise<any[]> {
    return WebhookConfiguration.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Update webhook
   */
  async updateWebhook(tenantId: string, webhookId: string, data: any): Promise<any> {
    const webhook = await WebhookConfiguration.findOne({
      _id: webhookId,
      tenantId,
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    webhook.name = data.name || webhook.name;
    webhook.url = data.url || webhook.url;
    webhook.events = data.events || webhook.events;
    webhook.isActive = data.isActive !== undefined ? data.isActive : webhook.isActive;
    webhook.headers = data.headers || webhook.headers;
    webhook.retryPolicy = data.retryPolicy || webhook.retryPolicy;
    webhook.updatedAt = new Date();

    return webhook.save();
  }
}

export default new WebhookService();
