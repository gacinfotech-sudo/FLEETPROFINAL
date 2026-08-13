import { EventEmitter } from "events";
import * as crypto from "crypto";

interface Webhook {
  webhookId: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface WebhookEvent {
  eventId: string;
  webhookId: string;
  type: string;
  data: Record<string, any>;
  timestamp: Date;
  signature: string;
}

interface WebhookDelivery {
  deliveryId: string;
  eventId: string;
  webhookId: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  response?: {
    statusCode: number;
    body?: string;
  };
  error?: string;
}

export class WebhookManager extends EventEmitter {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private activityLog: WebhookEvent[] = [];

  /**
   * Register a webhook
   */
  registerWebhook(
    webhookId: string,
    tenantId: string,
    url: string,
    events: string[],
    secret?: string
  ): Webhook {
    const webhook: Webhook = {
      webhookId,
      tenantId,
      url,
      events,
      secret: secret || crypto.randomBytes(32).toString("hex"),
      active: true,
      retryPolicy: {
        maxRetries: 5,
        backoffMs: 1000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookId, webhook);
    this.emit("webhook-registered", webhook);
    return webhook;
  }

  /**
   * Get webhook
   */
  getWebhook(webhookId: string): Webhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * List webhooks for tenant
   */
  listWebhooks(tenantId: string): Webhook[] {
    return Array.from(this.webhooks.values()).filter(
      (w) => w.tenantId === tenantId
    );
  }

  /**
   * Update webhook
   */
  updateWebhook(
    webhookId: string,
    updates: Partial<Webhook>
  ): Webhook | undefined {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return undefined;

    Object.assign(webhook, updates, { updatedAt: new Date() });
    this.emit("webhook-updated", webhook);
    return webhook;
  }

  /**
   * Delete webhook
   */
  deleteWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    this.emit("webhook-deleted", { webhookId });
  }

  /**
   * Send event to all matching webhooks
   */
  async sendEvent(
    tenantId: string,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const webhooks = this.listWebhooks(tenantId).filter(
      (w) => w.active && w.events.includes(eventType)
    );

    for (const webhook of webhooks) {
      await this.dispatchEvent(webhook, eventType, data);
    }
  }

  /**
   * Dispatch event to specific webhook
   */
  private async dispatchEvent(
    webhook: Webhook,
    eventType: string,
    data: Record<string, any>
  ): Promise<void> {
    const event: WebhookEvent = {
      eventId: `evt_${Date.now()}`,
      webhookId: webhook.webhookId,
      type: eventType,
      data,
      timestamp: new Date(),
      signature: this.generateSignature(webhook.secret, data),
    };

    this.activityLog.push(event);

    const delivery: WebhookDelivery = {
      deliveryId: `del_${Date.now()}`,
      eventId: event.eventId,
      webhookId: webhook.webhookId,
      status: "pending",
      attempts: 0,
    };

    this.deliveries.set(delivery.deliveryId, delivery);
    this.emit("event-dispatched", event);

    // Attempt delivery with retries
    await this.attemptDelivery(delivery, event, webhook);
  }

  /**
   * Attempt delivery with exponential backoff
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    event: WebhookEvent,
    webhook: Webhook
  ): Promise<void> {
    const maxRetries = webhook.retryPolicy.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      delivery.attempts = attempt + 1;
      delivery.lastAttemptAt = new Date();

      try {
        // Simulate HTTP request
        const response = await this.sendHttpRequest(webhook.url, event);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          delivery.status = "delivered";
          delivery.response = response;
          this.emit("event-delivered", { delivery, event });
          return;
        } else if (response.statusCode >= 400 && response.statusCode < 500) {
          // Client error - don't retry
          delivery.status = "failed";
          delivery.error = `HTTP ${response.statusCode}`;
          delivery.response = response;
          this.emit("event-failed", { delivery, event });
          return;
        }
      } catch (error: any) {
        delivery.error = error.message;
      }

      // Schedule retry if not last attempt
      if (attempt < maxRetries) {
        const backoffMs = webhook.retryPolicy.backoffMs * Math.pow(2, attempt);
        delivery.nextRetryAt = new Date(Date.now() + backoffMs);

        // Simulate async retry
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        delivery.status = "failed";
        this.emit("event-failed-after-retries", { delivery, event });
      }
    }
  }

  /**
   * Send HTTP request to webhook URL
   */
  private async sendHttpRequest(
    url: string,
    event: WebhookEvent
  ): Promise<{ statusCode: number; body?: string }> {
    // Simulate HTTP call
    return {
      statusCode: Math.random() > 0.1 ? 200 : 500,
      body: JSON.stringify({ received: true }),
    };
  }

  /**
   * Generate HMAC signature for webhook
   */
  generateSignature(secret: string, data: Record<string, any>): string {
    const payload = JSON.stringify(data);
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    webhookId: string,
    signature: string,
    data: Record<string, any>
  ): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;

    const expectedSignature = this.generateSignature(webhook.secret, data);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  /**
   * Get event activity log
   */
  getActivityLog(webhookId?: string, limit: number = 100): WebhookEvent[] {
    let log = this.activityLog.slice(-limit);
    if (webhookId) {
      log = log.filter((e) => e.webhookId === webhookId);
    }
    return log;
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;

    const testData = { test: true, timestamp: new Date().toISOString() };
    try {
      const response = await this.sendHttpRequest(webhook.url, {
        eventId: "test",
        webhookId,
        type: "test",
        data: testData,
        timestamp: new Date(),
        signature: this.generateSignature(webhook.secret, testData),
      });

      return response.statusCode >= 200 && response.statusCode < 300;
    } catch {
      return false;
    }
  }

  /**
   * Get webhook stats
   */
  getWebhookStats(webhookId: string): {
    totalEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    successRate: number;
  } {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return {
        totalEvents: 0,
        deliveredEvents: 0,
        failedEvents: 0,
        successRate: 0,
      };
    }

    const deliveries = Array.from(this.deliveries.values()).filter(
      (d) => d.webhookId === webhookId
    );

    const delivered = deliveries.filter((d) => d.status === "delivered").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const total = deliveries.length;

    return {
      totalEvents: total,
      deliveredEvents: delivered,
      failedEvents: failed,
      successRate: total > 0 ? (delivered / total) * 100 : 0,
    };
  }

  /**
   * Clean up old logs
   */
  cleanupOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date(
      Date.now() - daysToKeep * 24 * 60 * 60 * 1000
    );

    // Keep only recent logs
    this.activityLog = this.activityLog.filter(
      (e) => e.timestamp > cutoffDate
    );

    // Clean old deliveries
    const keysToDelete: string[] = [];
    this.deliveries.forEach((delivery, key) => {
      if (delivery.createdAt && delivery.createdAt < cutoffDate) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.deliveries.delete(key));

    this.emit("logs-cleaned", { logsRetained: this.activityLog.length });
  }
}
