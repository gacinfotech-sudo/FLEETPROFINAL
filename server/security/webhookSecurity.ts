import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { Request, Response, NextFunction } from 'express';

/**
 * Webhook Security System
 * - HMAC-SHA256 signature verification
 * - IP whitelist configuration
 * - Exponential backoff retry logic
 * - Webhook rotation keys
 * - Request/Response logging
 */

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  rotationKey?: string;
  ipWhitelist?: string[];
  maxRetries?: number;
  retryBackoffMs?: number;
  enabled?: boolean;
  events?: string[];
  headers?: Record<string, string>;
}

export interface WebhookSignature {
  timestamp: number;
  signature: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  timestamp: number;
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  status: 'pending' | 'delivered' | 'failed';
  response?: {
    statusCode?: number;
    body?: string;
  };
}

export class WebhookSigner {
  /**
   * Create HMAC-SHA256 signature for webhook payload
   */
  static sign(payload: any, secret: string): WebhookSignature {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadString = JSON.stringify(payload);

    const signatureData = `${timestamp}.${payloadString}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signatureData);
    const signature = hmac.digest('hex');

    return {
      timestamp,
      signature,
    };
  }

  /**
   * Verify webhook signature
   */
  static verify(
    payload: any,
    signature: string,
    secret: string,
    timestamp?: number,
    maxAge: number = 5 * 60 * 1000 // 5 minutes default
  ): boolean {
    // If timestamp provided, verify it's not too old
    if (timestamp) {
      const age = Date.now() - timestamp * 1000;
      if (age > maxAge) {
        console.warn(`Webhook signature too old: ${age}ms`);
        return false;
      }
    }

    try {
      const signed = WebhookSigner.sign(payload, secret);

      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(signed.signature)
      );
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }
}

export class WebhookManager {
  private webhooks = new Map<string, WebhookConfig>();
  private deliveryQueue: WebhookDelivery[] = [];
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      validateStatus: () => true, // Accept all status codes
    });
  }

  /**
   * Register webhook
   */
  registerWebhook(config: WebhookConfig): void {
    // Validate URL
    try {
      new URL(config.url);
    } catch {
      throw new Error(`Invalid webhook URL: ${config.url}`);
    }

    // Ensure secret is properly sized (minimum 32 bytes)
    if (config.secret.length < 32) {
      console.warn(`Webhook secret for ${config.id} is too short (${config.secret.length} bytes)`);
    }

    this.webhooks.set(config.id, {
      enabled: true,
      maxRetries: 3,
      retryBackoffMs: 1000,
      ...config,
    });

    console.log(`Webhook registered: ${config.id} -> ${config.url}`);
  }

  /**
   * Unregister webhook
   */
  unregisterWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    console.log(`Webhook unregistered: ${webhookId}`);
  }

  /**
   * Get webhook configuration
   */
  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Rotate webhook secret (key rotation)
   */
  rotateWebhookSecret(webhookId: string): string {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // Store old secret as rotation key
    webhook.rotationKey = webhook.secret;

    // Generate new secret
    webhook.secret = crypto.randomBytes(32).toString('hex');

    this.webhooks.set(webhookId, webhook);
    console.log(`Webhook secret rotated for ${webhookId}`);

    return webhook.secret;
  }

  /**
   * Queue webhook delivery
   */
  async queueWebhookDelivery(
    webhookId: string,
    event: string,
    payload: any
  ): Promise<WebhookDelivery | null> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook || !webhook.enabled) {
      return null;
    }

    // Check if webhook listens to this event
    if (webhook.events && !webhook.events.includes(event)) {
      return null;
    }

    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId,
      event,
      payload,
      timestamp: Date.now(),
      attempts: 0,
      status: 'pending',
    };

    this.deliveryQueue.push(delivery);
    console.log(`Webhook delivery queued: ${delivery.id}`);

    // Process immediately
    this.processDeliveryQueue();

    return delivery;
  }

  /**
   * Process pending webhook deliveries with exponential backoff
   */
  private async processDeliveryQueue(): Promise<void> {
    const now = Date.now();

    for (let i = this.deliveryQueue.length - 1; i >= 0; i--) {
      const delivery = this.deliveryQueue[i];

      // Skip if not ready to retry
      if (delivery.nextRetryAt && delivery.nextRetryAt > now) {
        continue;
      }

      // Skip if already delivered
      if (delivery.status === 'delivered') {
        this.deliveryQueue.splice(i, 1);
        continue;
      }

      // Check max retries
      const webhook = this.webhooks.get(delivery.webhookId);
      if (!webhook) {
        this.deliveryQueue.splice(i, 1);
        continue;
      }

      if (delivery.attempts >= (webhook.maxRetries || 3)) {
        delivery.status = 'failed';
        console.error(`Webhook delivery failed after ${delivery.attempts} attempts: ${delivery.id}`);
        // Keep failed deliveries for audit trail
        continue;
      }

      await this.attemptDelivery(delivery, webhook);
    }
  }

  /**
   * Attempt to deliver webhook
   */
  private async attemptDelivery(delivery: WebhookDelivery, webhook: WebhookConfig): Promise<void> {
    try {
      delivery.attempts++;
      delivery.lastAttemptAt = Date.now();

      // IP whitelist check
      if (webhook.ipWhitelist && webhook.ipWhitelist.length > 0) {
        const targetIP = this.extractIP(webhook.url);
        if (!webhook.ipWhitelist.includes(targetIP)) {
          throw new Error(`Target IP not in whitelist: ${targetIP}`);
        }
      }

      // Create signature
      const { signature, timestamp } = WebhookSigner.sign(delivery.payload, webhook.secret);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Delivery': delivery.id,
        'X-Webhook-Event': delivery.event,
        'User-Agent': 'FleetPro-Webhook/1.0',
        ...webhook.headers,
      };

      // Send webhook
      const response = await this.axiosInstance.post(
        webhook.url,
        delivery.payload,
        { headers }
      );

      delivery.response = {
        statusCode: response.status,
        body: JSON.stringify(response.data).substring(0, 1000), // Limit body size
      };

      // Check if successful (2xx or 3xx)
      if (response.status >= 200 && response.status < 400) {
        delivery.status = 'delivered';
        console.log(`Webhook delivered successfully: ${delivery.id}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Webhook delivery attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Calculate exponential backoff
      const webhook = this.webhooks.get(delivery.webhookId);
      const backoff = (webhook?.retryBackoffMs || 1000) * Math.pow(2, delivery.attempts - 1);

      delivery.nextRetryAt = Date.now() + backoff;
      console.log(`Next retry for ${delivery.id} in ${backoff}ms`);
    }
  }

  /**
   * Extract IP from URL
   */
  private extractIP(url: string): string {
    try {
      const urlObj = new URL(url);
      // In production, resolve domain to IP
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveryQueue.find(d => d.id === deliveryId);
  }

  /**
   * List all webhooks
   */
  listWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Update webhook configuration
   */
  updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): void {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // Validate URL if changed
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        throw new Error(`Invalid webhook URL: ${updates.url}`);
      }
    }

    this.webhooks.set(webhookId, { ...webhook, ...updates });
    console.log(`Webhook updated: ${webhookId}`);
  }
}

/**
 * Webhook verification middleware
 */
export function webhookVerificationMiddleware(webhookManager: WebhookManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const webhookId = req.headers['x-webhook-id'] as string;
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;

    if (!webhookId || !signature || !timestamp) {
      return res.status(401).json({ message: 'Missing webhook authentication headers' });
    }

    const webhook = webhookManager.getWebhook(webhookId);
    if (!webhook || !webhook.enabled) {
      return res.status(404).json({ message: 'Webhook not found' });
    }

    const verified = WebhookSigner.verify(
      req.body,
      signature,
      webhook.secret,
      parseInt(timestamp, 10)
    );

    // Try rotation key if primary verification failed
    if (!verified && webhook.rotationKey) {
      const rotationVerified = WebhookSigner.verify(
        req.body,
        signature,
        webhook.rotationKey,
        parseInt(timestamp, 10),
        24 * 60 * 60 * 1000 // 24 hours for rotation key
      );

      if (!rotationVerified) {
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }
    } else if (!verified) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    (req as any).webhook = webhook;
    next();
  };
}

/**
 * Global webhook manager instance
 */
export const globalWebhookManager = new WebhookManager();
