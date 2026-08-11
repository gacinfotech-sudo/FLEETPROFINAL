/**
 * eSign Webhook Handler
 * Processes incoming eSign webhook events
 */

import * as crypto from 'crypto';
import type { ESignWebhookPayload } from './types';

interface WebhookEvent {
  id: string;
  payload: ESignWebhookPayload;
  receivedAt: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

interface WebhookRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * eSign Webhook Handler
 */
export class ESignWebhookHandler {
  private eventQueue: WebhookEvent[] = [];
  private processedEvents: Set<string> = new Set();
  private eventHandlers: Map<string, (event: WebhookEvent) => Promise<void>> = new Map();
  private retryConfig: WebhookRetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  };

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register default event handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler('agreement.created', async (event: WebhookEvent) => {
      console.log(`[esign-webhook] Agreement created: ${event.payload.agreementId}`);
    });

    this.registerHandler('agreement.sent', async (event: WebhookEvent) => {
      console.log(`[esign-webhook] Agreement sent: ${event.payload.agreementId}`);
    });

    this.registerHandler('signature.initiated', async (event: WebhookEvent) => {
      console.log(
        `[esign-webhook] Signature initiated for agreement: ${event.payload.agreementId}`,
      );
    });

    this.registerHandler('signature.completed', async (event: WebhookEvent) => {
      console.log(
        `[esign-webhook] Signature completed by party: ${event.payload.partyId}`,
      );
    });

    this.registerHandler('signature.declined', async (event: WebhookEvent) => {
      console.log(
        `[esign-webhook] Signature declined by party: ${event.payload.partyId}`,
      );
    });

    this.registerHandler('agreement.fully_signed', async (event: WebhookEvent) => {
      console.log(
        `[esign-webhook] Agreement fully signed: ${event.payload.agreementId}`,
      );
    });

    this.registerHandler('agreement.expired', async (event: WebhookEvent) => {
      console.log(`[esign-webhook] Agreement expired: ${event.payload.agreementId}`);
    });

    this.registerHandler('agreement.revoked', async (event: WebhookEvent) => {
      console.log(`[esign-webhook] Agreement revoked: ${event.payload.agreementId}`);
    });
  }

  /**
   * Process webhook payload
   */
  async processWebhook(payload: ESignWebhookPayload): Promise<string> {
    const eventId = crypto.randomUUID();

    // Check for duplicate events
    if (this.processedEvents.has(eventId)) {
      console.warn(`[esign-webhook] Duplicate event detected: ${eventId}`);
      return eventId;
    }

    const event: WebhookEvent = {
      id: eventId,
      payload,
      receivedAt: new Date(),
      processed: false,
    };

    // Add to queue
    this.eventQueue.push(event);

    // Mark event as processed to prevent duplicates
    this.processedEvents.add(eventId);

    // Process event asynchronously
    this.handleEvent(event).catch(error => {
      console.error(`[esign-webhook] Error processing event ${eventId}:`, error);
      event.error = error.message;
    });

    return eventId;
  }

  /**
   * Handle event
   */
  private async handleEvent(event: WebhookEvent): Promise<void> {
    let retryCount = 0;

    while (retryCount <= this.retryConfig.maxRetries) {
      try {
        // Get handler for event type
        const handler = this.eventHandlers.get(event.payload.eventType);

        if (!handler) {
          console.warn(
            `[esign-webhook] No handler registered for event type: ${event.payload.eventType}`,
          );
          event.processed = true;
          event.processedAt = new Date();
          return;
        }

        // Execute handler
        await handler(event);

        // Mark as processed
        event.processed = true;
        event.processedAt = new Date();
        return;
      } catch (error) {
        retryCount++;

        if (retryCount > this.retryConfig.maxRetries) {
          console.error(
            `[esign-webhook] Event processing failed after ${this.retryConfig.maxRetries} retries:`,
            error,
          );
          event.error = (error as Error).message;
          return;
        }

        // Calculate backoff delay
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
          this.retryConfig.maxDelayMs,
        );

        console.warn(
          `[esign-webhook] Retrying event ${event.id} (attempt ${retryCount}/${this.retryConfig.maxRetries}) after ${delay}ms`,
        );

        await this.delay(delay);
      }
    }
  }

  /**
   * Register custom event handler
   */
  registerHandler(
    eventType: string,
    handler: (event: WebhookEvent) => Promise<void>,
  ): void {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * Unregister event handler
   */
  unregisterHandler(eventType: string): void {
    this.eventHandlers.delete(eventType);
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): WebhookEvent | null {
    return this.eventQueue.find(e => e.id === eventId) || null;
  }

  /**
   * List pending events
   */
  getPendingEvents(): WebhookEvent[] {
    return this.eventQueue.filter(e => !e.processed);
  }

  /**
   * List processed events
   */
  getProcessedEvents(): WebhookEvent[] {
    return this.eventQueue.filter(e => e.processed);
  }

  /**
   * Retry failed events
   */
  async retryFailedEvents(): Promise<number> {
    const failedEvents = this.eventQueue.filter(e => e.error && !e.processed);

    for (const event of failedEvents) {
      event.error = undefined; // Clear previous error
      await this.handleEvent(event);
    }

    return failedEvents.length;
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
    this.processedEvents.clear();
  }

  /**
   * Get queue statistics
   */
  getStatistics() {
    const total = this.eventQueue.length;
    const processed = this.eventQueue.filter(e => e.processed).length;
    const pending = total - processed;
    const failed = this.eventQueue.filter(e => e.error).length;

    const eventCounts = this.eventQueue.reduce(
      (acc, e) => {
        acc[e.payload.eventType] = (acc[e.payload.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      processed,
      pending,
      failed,
      eventCounts,
      oldestEvent: this.eventQueue.length > 0 ? this.eventQueue[0].receivedAt : null,
      newestEvent: this.eventQueue.length > 0 ? this.eventQueue[this.eventQueue.length - 1].receivedAt : null,
    };
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    signature: string,
    timestamp: string,
    rawBody: string,
    secret: string,
  ): boolean {
    try {
      // Verify timestamp is within acceptable range (5 minutes)
      const webhookTime = parseInt(timestamp);
      const now = Date.now();

      if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
        console.warn('[esign-webhook] Webhook timestamp outside acceptable range');
        return false;
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      console.error('[esign-webhook] Signature validation error:', error);
      return false;
    }
  }

  /**
   * Export events for audit trail
   */
  exportEvents(filters?: {
    eventType?: string;
    agreementId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): WebhookEvent[] {
    let events = [...this.eventQueue];

    if (filters?.eventType) {
      events = events.filter(e => e.payload.eventType === filters.eventType);
    }

    if (filters?.agreementId) {
      events = events.filter(e => e.payload.agreementId === filters.agreementId);
    }

    if (filters?.dateFrom) {
      events = events.filter(e => e.receivedAt >= filters.dateFrom!);
    }

    if (filters?.dateTo) {
      events = events.filter(e => e.receivedAt <= filters.dateTo!);
    }

    return events;
  }

  /**
   * Clean up old events (archive retention)
   */
  cleanupOldEvents(olderThanDays: number = 30): number {
    const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const originalLength = this.eventQueue.length;

    this.eventQueue = this.eventQueue.filter(e => e.receivedAt > cutoffTime);

    return originalLength - this.eventQueue.length;
  }

  /**
   * Helper: delay function
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(config: Partial<WebhookRetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}
