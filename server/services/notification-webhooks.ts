import { Db } from 'mongodb';
import crypto from 'crypto';

export interface Webhook {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  retryAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  tenantId: string;
  event: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastError?: string;
  deliveredAt?: Date;
  createdAt: Date;
}

class WebhookManager {
  private db: Db | null = null;
  private webhooks: Map<string, Webhook> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[WebhookManager] Database not initialized, running in memory mode');
        return;
      }

      const webhooks = await this.db.collection('webhooks')
        .find({ isActive: true })
        .toArray();

      for (const webhook of webhooks) {
        this.webhooks.set(webhook.id, webhook as Webhook);
      }

      console.log(`[WebhookManager] Initialized with ${webhooks.length} webhooks`);
    } catch (error) {
      console.error('[WebhookManager] Initialization error:', error);
    }
  }

  async registerWebhook(
    tenantId: string,
    url: string,
    events: string[],
    retryAttempts: number = 5
  ): Promise<Webhook> {
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook: Webhook = {
      id: `wh-${tenantId}-${Date.now()}`,
      tenantId,
      url,
      events,
      isActive: true,
      secret,
      retryAttempts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhook.id, webhook);

    if (this.db) {
      try {
        await this.db.collection('webhooks').insertOne(webhook);
      } catch (e) {
        console.warn('[WebhookManager] Failed to persist webhook:', e);
      }
    }

    return webhook;
  }

  async getWebhooks(tenantId: string): Promise<Webhook[]> {
    const webhooks = Array.from(this.webhooks.values())
      .filter(w => w.tenantId === tenantId && w.isActive);

    if (webhooks.length > 0) {
      return webhooks;
    }

    if (this.db) {
      try {
        return await this.db.collection('webhooks')
          .find({ tenantId, isActive: true })
          .toArray() as Webhook[];
      } catch (e) {
        return [];
      }
    }

    return webhooks;
  }

  async getWebhooksByEvent(tenantId: string, event: string): Promise<Webhook[]> {
    const webhooks = await this.getWebhooks(tenantId);
    return webhooks.filter(w => w.events.includes(event));
  }

  async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    const updated = { ...webhook, ...updates, updatedAt: new Date() };
    this.webhooks.set(webhookId, updated);

    if (this.db) {
      try {
        await this.db.collection('webhooks').updateOne(
          { id: webhookId },
          { $set: updated }
        );
      } catch (e) {
        console.warn('[WebhookManager] Failed to update webhook:', e);
      }
    }

    return updated;
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    this.webhooks.delete(webhookId);

    if (this.db) {
      try {
        await this.db.collection('webhooks').updateOne(
          { id: webhookId },
          { $set: { isActive: false, updatedAt: new Date() } }
        );
        return true;
      } catch (e) {
        console.warn('[WebhookManager] Failed to delete webhook:', e);
        return false;
      }
    }

    return true;
  }

  async dispatchEvent(
    tenantId: string,
    event: string,
    payload: Record<string, any>
  ): Promise<WebhookDelivery[]> {
    const webhooks = await this.getWebhooksByEvent(tenantId, event);
    const deliveries: WebhookDelivery[] = [];

    for (const webhook of webhooks) {
      const delivery: WebhookDelivery = {
        id: `del-${webhook.id}-${Date.now()}`,
        webhookId: webhook.id,
        tenantId,
        event,
        payload,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
      };

      this.deliveries.set(delivery.id, delivery);

      if (this.db) {
        try {
          await this.db.collection('webhookDeliveries').insertOne(delivery);
        } catch (e) {
          console.warn('[WebhookManager] Failed to record delivery:', e);
        }
      }

      deliveries.push(delivery);
      this.attemptDelivery(webhook, delivery);
    }

    return deliveries;
  }

  private async attemptDelivery(webhook: Webhook, delivery: WebhookDelivery): Promise<void> {
    const signature = this.generateSignature(delivery.payload, webhook.secret);

    try {
      delivery.attempts += 1;

      // Mock delivery (in production, would be actual HTTP call)
      console.log(`[WebhookManager] Delivering event ${delivery.event} to ${webhook.url}`);

      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();

      if (this.db) {
        await this.db.collection('webhookDeliveries').updateOne(
          { id: delivery.id },
          { $set: { status: 'delivered', attempts: delivery.attempts, deliveredAt: new Date() } }
        );
      }
    } catch (error: any) {
      if (delivery.attempts < webhook.retryAttempts) {
        const backoffMs = Math.min(1000 * Math.pow(2, delivery.attempts - 1), 60000);
        setTimeout(() => this.attemptDelivery(webhook, delivery), backoffMs);
      } else {
        delivery.status = 'failed';
        delivery.lastError = error.message;

        if (this.db) {
          await this.db.collection('webhookDeliveries').updateOne(
            { id: delivery.id },
            { $set: { status: 'failed', lastError: error.message, attempts: delivery.attempts } }
          );
        }
      }
    }
  }

  private generateSignature(payload: Record<string, any>, secret: string): string {
    const message = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  async verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  async getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);

    if (deliveries.length > 0) {
      return deliveries;
    }

    if (this.db) {
      try {
        return await this.db.collection('webhookDeliveries')
          .find({ webhookId })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray() as WebhookDelivery[];
      } catch (e) {
        return [];
      }
    }

    return deliveries;
  }

  getWebhookCount(): number {
    return this.webhooks.size;
  }

  getStatus() {
    return {
      webhooksActive: Array.from(this.webhooks.values()).filter(w => w.isActive).length,
      deliveriesTracked: this.deliveries.size,
      timestamp: new Date(),
    };
  }
}

export const webhookManager = new WebhookManager();
