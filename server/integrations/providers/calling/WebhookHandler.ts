/**
 * Webhook Handler for Calling Provider
 * Receives and processes incoming call events, status updates, recordings
 */

import type { Request, Response } from 'express';
import type { ICallingProvider } from './types';
import { getCallLogger } from './CallLogger';

/**
 * Webhook event payload
 */
export interface WebhookEventPayload {
  type: 'incoming_call' | 'call_status' | 'recording_completed' | 'ivr_interaction';
  providerId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Webhook handler for calling provider events
 */
export class CallingWebhookHandler {
  private provider: ICallingProvider;
  private callLogger = getCallLogger();
  private eventHandlers: Map<string, Set<(payload: WebhookEventPayload) => void>> = new Map();
  private retryQueue: Array<{
    payload: WebhookEventPayload;
    attempt: number;
    nextRetry: Date;
  }> = [];

  constructor(provider: ICallingProvider) {
    this.provider = provider;
    this.startRetryProcessor();
  }

  /**
   * Handle incoming webhook request
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-signature'] || req.headers['x-exotel-signature'];
      if (signature && typeof signature === 'string') {
        const isValid = await this.provider.verifyWebhookSignature(
          req.headers as Record<string, string>,
          Buffer.from(JSON.stringify(req.body)),
        );

        if (!isValid) {
          console.warn('[webhook] Invalid signature');
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      // Determine webhook type
      const body = req.body;

      if (body.CallType || body.From) {
        // Incoming call webhook
        await this.handleIncomingCall(body);
      } else if (body.Status || body.Sid) {
        // Call status update webhook
        await this.handleCallStatus(body);
      } else if (body.RecordingUrl) {
        // Recording completed webhook
        await this.handleRecordingCompleted(body);
      } else {
        console.warn('[webhook] Unknown webhook type:', body);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[webhook] Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle incoming call webhook
   */
  private async handleIncomingCall(body: any): Promise<void> {
    try {
      const webhook = await this.provider.parseIncomingCallWebhook(Buffer.from(JSON.stringify(body)));

      // Log the incoming call
      this.callLogger.logIncomingCall(webhook);

      // Emit event
      this.emit('incoming_call', {
        type: 'incoming_call',
        providerId: this.provider.providerKey,
        timestamp: new Date(),
        data: webhook,
      });

      console.log(`[webhook] Processed incoming call: ${webhook.fromNumber} -> ${webhook.toNumber}`);
    } catch (error) {
      console.error('[webhook] Error processing incoming call:', error);
      throw error;
    }
  }

  /**
   * Handle call status update webhook
   */
  private async handleCallStatus(body: any): Promise<void> {
    try {
      const status = await this.provider.parseCallStatusWebhook(Buffer.from(JSON.stringify(body)));

      // Update CDR
      this.callLogger.logCallStatusUpdate(status);

      // Emit event
      this.emit('call_status', {
        type: 'call_status',
        providerId: this.provider.providerKey,
        timestamp: new Date(),
        data: status,
      });

      console.log(
        `[webhook] Processed call status: ${status.providerCallId} -> ${status.status}`,
      );
    } catch (error) {
      console.error('[webhook] Error processing call status:', error);
      throw error;
    }
  }

  /**
   * Handle recording completed webhook
   */
  private async handleRecordingCompleted(body: any): Promise<void> {
    try {
      const callId = body.CallSid || body.callId;
      const recordingUrl = body.RecordingUrl || body.recordingUrl;
      const duration = body.Duration || body.duration;

      if (callId && recordingUrl) {
        this.callLogger.markCallRecording(callId, recordingUrl, duration);

        this.emit('recording_completed', {
          type: 'recording_completed',
          providerId: this.provider.providerKey,
          timestamp: new Date(),
          data: {
            callId,
            recordingUrl,
            duration,
          },
        });

        console.log(`[webhook] Recording completed for call ${callId}`);
      }
    } catch (error) {
      console.error('[webhook] Error processing recording:', error);
      throw error;
    }
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: (payload: WebhookEventPayload) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string, handler: (payload: WebhookEventPayload) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(eventType: string, payload: WebhookEventPayload): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[webhook] Error in ${eventType} handler:`, error);
        }
      });
    }
  }

  /**
   * Queue webhook for retry
   */
  async retryWebhook(payload: WebhookEventPayload, maxAttempts: number = 3): Promise<void> {
    const queueItem = {
      payload,
      attempt: 0,
      nextRetry: new Date(),
    };

    this.retryQueue.push(queueItem);
    console.log(`[webhook] Queued webhook for retry: ${payload.type}`);
  }

  /**
   * Process retry queue
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      const now = new Date();
      const itemsToRetry = this.retryQueue.filter(item => item.nextRetry <= now);

      for (const item of itemsToRetry) {
        try {
          // Emit retry event
          this.emit(item.payload.type, item.payload);

          // Remove from queue
          const index = this.retryQueue.indexOf(item);
          if (index > -1) {
            this.retryQueue.splice(index, 1);
          }

          console.log(
            `[webhook] Retried webhook (attempt ${item.attempt + 1}): ${item.payload.type}`,
          );
        } catch (error) {
          console.error('[webhook] Error retrying webhook:', error);

          // Schedule next retry with exponential backoff
          item.attempt++;
          const backoffMs = Math.pow(2, item.attempt) * 1000;
          item.nextRetry = new Date(now.getTime() + backoffMs);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Get webhook retry stats
   */
  getRetryStats(): {
    queuedItems: number;
    oldestRetry: Date | null;
  } {
    return {
      queuedItems: this.retryQueue.length,
      oldestRetry: this.retryQueue.length > 0 ?
        Math.min(...this.retryQueue.map(item => item.nextRetry.getTime())) > 0 ?
          new Date(Math.min(...this.retryQueue.map(item => item.nextRetry.getTime()))) : null : null,
    };
  }

  /**
   * Validate webhook payload structure
   */
  validatePayload(body: any, expectedFields: string[]): boolean {
    return expectedFields.every(field => field in body);
  }

  /**
   * Sanitize webhook payload
   */
  sanitizePayload(body: any): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    const allowedFields = [
      'CallSid',
      'Sid',
      'CallType',
      'Status',
      'From',
      'To',
      'Duration',
      'CallTime',
      'RecordingUrl',
      'CustomField',
      'Agent',
      'VirtualNumber',
      'Direction',
      'Timestamp',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        sanitized[field] = body[field];
      }
    }

    return sanitized;
  }
}
