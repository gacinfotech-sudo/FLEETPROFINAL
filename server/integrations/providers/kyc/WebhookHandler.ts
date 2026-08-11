/**
 * KYC Webhook Handler
 * Processes incoming webhook events from DigiLocker
 * Handles verification updates, document events, and compliance notifications
 */

import crypto from 'crypto';
import { DigiLockerWebhookEvent } from './types';
import { IntegrationError } from '../../types';

/**
 * Webhook handler for KYC/DigiLocker events
 */
export class KYCWebhookHandler {
  private webhookSecret: string;
  private eventHandlers: Map<string, (event: DigiLockerWebhookEvent) => Promise<void>>;
  private retryAttempts = 5;
  private retryDelays = [1000, 5000, 30000, 60000, 300000]; // 1s, 5s, 30s, 1m, 5m

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
    this.eventHandlers = new Map();
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Process incoming webhook event
   */
  async processEvent(payload: string, signature: string): Promise<void> {
    try {
      // Verify signature
      if (!this.verifySignature(payload, signature)) {
        throw new IntegrationError(
          'INVALID_SIGNATURE',
          'Webhook signature verification failed',
          401,
        );
      }

      // Parse event
      let event: DigiLockerWebhookEvent;
      try {
        event = JSON.parse(payload);
      } catch (error) {
        throw new IntegrationError(
          'INVALID_PAYLOAD',
          'Failed to parse webhook payload',
          400,
        );
      }

      // Validate event
      this.validateEvent(event);

      // Process event
      await this.handleEvent(event);
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error;
      }

      throw new IntegrationError(
        'WEBHOOK_ERROR',
        `Failed to process webhook: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Validate webhook event
   */
  private validateEvent(event: DigiLockerWebhookEvent): void {
    if (!event.eventId) {
      throw new IntegrationError(
        'MISSING_EVENT_ID',
        'Event ID is required',
      );
    }

    if (!event.eventType) {
      throw new IntegrationError(
        'MISSING_EVENT_TYPE',
        'Event type is required',
      );
    }

    if (!event.timestamp) {
      throw new IntegrationError(
        'MISSING_TIMESTAMP',
        'Timestamp is required',
      );
    }

    if (!event.tenantId) {
      throw new IntegrationError(
        'MISSING_TENANT_ID',
        'Tenant ID is required',
      );
    }

    // Check event timestamp is not too old (max 5 minutes)
    const eventTime = new Date(event.timestamp);
    const now = new Date();
    const timeDiff = now.getTime() - eventTime.getTime();

    if (timeDiff > 5 * 60 * 1000) {
      throw new IntegrationError(
        'STALE_EVENT',
        'Event is too old',
      );
    }
  }

  /**
   * Handle webhook event with retry logic
   */
  private async handleEvent(event: DigiLockerWebhookEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.eventType);

    if (!handler) {
      // Event type not registered, log and ignore
      console.warn(`No handler registered for event type: ${event.eventType}`);
      return;
    }

    // Execute with retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        await handler(event);
        return; // Success
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          // Calculate delay with jitter
          const delay = this.retryDelays[attempt] || 300000;
          const jitter = Math.random() * 1000; // Up to 1 second jitter
          const totalDelay = delay + jitter;

          console.error(
            `Webhook handler failed (attempt ${attempt + 1}), retrying in ${totalDelay}ms`,
            {
              eventType: event.eventType,
              eventId: event.eventId,
              error: lastError.message,
            },
          );

          await this.sleep(totalDelay);
        }
      }
    }

    // All retries failed
    throw new IntegrationError(
      'HANDLER_FAILED',
      `Webhook handler failed after ${this.retryAttempts} retries: ${lastError?.message}`,
    );
  }

  /**
   * Register event handler
   */
  on(
    eventType: string,
    handler: (event: DigiLockerWebhookEvent) => Promise<void>,
  ): void {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string): void {
    this.eventHandlers.delete(eventType);
  }

  /**
   * Create webhook signing key
   */
  static generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get event statistics
   */
  getEventStats(): {
    registeredHandlers: number;
    handlerTypes: string[];
  } {
    return {
      registeredHandlers: this.eventHandlers.size,
      handlerTypes: Array.from(this.eventHandlers.keys()),
    };
  }
}

/**
 * Document verification webhook processor
 */
export class DocumentVerificationProcessor {
  /**
   * Process document verification event
   */
  static async processDocumentVerified(
    event: DigiLockerWebhookEvent,
  ): Promise<void> {
    console.log('Processing document verified event', {
      eventId: event.eventId,
      customerId: event.customerId,
      documentId: event.data.documentId,
    });

    // Update document status in storage
    // await storage.updateStatus(event.data.documentId, 'VERIFIED');
  }

  /**
   * Process document rejection event
   */
  static async processDocumentRejected(
    event: DigiLockerWebhookEvent,
  ): Promise<void> {
    console.log('Processing document rejected event', {
      eventId: event.eventId,
      customerId: event.customerId,
      documentId: event.data.documentId,
      reason: event.data.reason,
    });

    // Update document status in storage
    // await storage.updateStatus(event.data.documentId, 'REJECTED');
  }

  /**
   * Process verification completed event
   */
  static async processVerificationCompleted(
    event: DigiLockerWebhookEvent,
  ): Promise<void> {
    console.log('Processing verification completed event', {
      eventId: event.eventId,
      customerId: event.customerId,
      verificationId: event.data.verificationId,
      status: event.data.status,
    });

    // Update verification result in database
    // await verificationService.updateVerification(event.data.verificationId, event.data);
  }

  /**
   * Process verification failed event
   */
  static async processVerificationFailed(
    event: DigiLockerWebhookEvent,
  ): Promise<void> {
    console.log('Processing verification failed event', {
      eventId: event.eventId,
      customerId: event.customerId,
      verificationId: event.data.verificationId,
      reason: event.data.reason,
    });

    // Update verification result in database
    // await verificationService.updateVerification(event.data.verificationId, { status: 'FAILED', reason: event.data.reason });
  }
}

/**
 * Setup default webhook handlers
 */
export function setupDefaultHandlers(handler: KYCWebhookHandler): void {
  handler.on('document.verified', DocumentVerificationProcessor.processDocumentVerified);
  handler.on('document.rejected', DocumentVerificationProcessor.processDocumentRejected);
  handler.on(
    'verification.completed',
    DocumentVerificationProcessor.processVerificationCompleted,
  );
  handler.on(
    'verification.failed',
    DocumentVerificationProcessor.processVerificationFailed,
  );
}

export default KYCWebhookHandler;
