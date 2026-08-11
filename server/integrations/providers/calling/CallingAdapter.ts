/**
 * Base Calling Provider Adapter
 * Abstract base class for all calling provider implementations
 * Provides common functionality for call tracking, rate limiting, and error handling
 */

import type {
  ICallingProvider,
  CallingProviderCredentials,
  CallInitiationResult,
  CallConnectionDetails,
  CallForwardingRule,
  IncomingCallWebhook,
  CallStatusWebhook,
  CallEvent,
  CallRateLimitConfig,
  CallOptions,
} from './types';

/**
 * Rate limiter using token bucket algorithm
 */
class CallRateLimiter {
  private perMinute = 0;
  private perHour = 0;
  private perDay = 0;
  private concurrent = 0;
  private lastResetMinute = Date.now();
  private lastResetHour = Date.now();
  private lastResetDay = Date.now();
  private config: CallRateLimitConfig;

  constructor(config?: CallRateLimitConfig) {
    this.config = config || {
      callsPerMinute: 60,
      callsPerHour: 1000,
      callsPerDay: 10000,
      concurrentCalls: 100,
      requestsPerSecond: 10,
    };
  }

  canMakeCall(): boolean {
    const now = Date.now();

    // Reset counters based on time windows
    if (now - this.lastResetMinute > 60000) {
      this.perMinute = 0;
      this.lastResetMinute = now;
    }
    if (now - this.lastResetHour > 3600000) {
      this.perHour = 0;
      this.lastResetHour = now;
    }
    if (now - this.lastResetDay > 86400000) {
      this.perDay = 0;
      this.lastResetDay = now;
    }

    // Check all limits
    if (this.config.callsPerMinute && this.perMinute >= this.config.callsPerMinute) {
      return false;
    }
    if (this.config.callsPerHour && this.perHour >= this.config.callsPerHour) {
      return false;
    }
    if (this.config.callsPerDay && this.perDay >= this.config.callsPerDay) {
      return false;
    }
    if (this.config.concurrentCalls && this.concurrent >= this.config.concurrentCalls) {
      return false;
    }

    return true;
  }

  recordCall(): void {
    this.perMinute++;
    this.perHour++;
    this.perDay++;
    this.concurrent++;
  }

  releaseCall(): void {
    if (this.concurrent > 0) {
      this.concurrent--;
    }
  }

  getStats() {
    return {
      perMinute: this.perMinute,
      perHour: this.perHour,
      perDay: this.perDay,
      concurrent: this.concurrent,
    };
  }
}

/**
 * Base calling provider adapter
 */
export abstract class BaseCallingAdapter implements ICallingProvider {
  abstract readonly providerKey: string;
  protected rateLimiter: CallRateLimiter;
  protected incomingCallHandlers: Set<(call: IncomingCallWebhook) => void> = new Set();
  protected callStatusHandlers: Set<(status: CallStatusWebhook) => void> = new Set();
  protected callEventHandlers: Set<(event: CallEvent) => void> = new Set();
  protected credentials: CallingProviderCredentials;

  constructor(credentials: CallingProviderCredentials, rateLimitConfig?: CallRateLimitConfig) {
    this.credentials = credentials;
    this.rateLimiter = new CallRateLimiter(rateLimitConfig);
  }

  /**
   * Test connection with credentials
   */
  abstract testConnection(credentials: CallingProviderCredentials): Promise<{ ok: boolean; message: string }>;

  /**
   * Place an outbound call
   */
  abstract placeCall(params: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    agentId?: string;
    options?: CallOptions;
  }): Promise<CallInitiationResult>;

  /**
   * Get call details
   */
  abstract getCallDetails(providerCallId: string): Promise<CallConnectionDetails>;

  /**
   * End a call
   */
  abstract endCall(providerCallId: string, reason?: string): Promise<void>;

  /**
   * Transfer a call to another number
   */
  abstract transferCall(
    fromCallId: string,
    toNumber: string,
    transferType?: 'blind' | 'attended',
  ): Promise<CallInitiationResult>;

  /**
   * Set up call forwarding
   */
  abstract setupForwarding(rule: CallForwardingRule): Promise<void>;

  /**
   * Remove call forwarding
   */
  abstract removeForwarding(ruleId: string): Promise<void>;

  /**
   * Get recording URL
   */
  abstract getRecordingUrl(providerCallId: string): Promise<string | null>;

  /**
   * Verify webhook signature
   */
  abstract verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;

  /**
   * Parse incoming call webhook
   */
  abstract parseIncomingCallWebhook(rawBody: Buffer): Promise<IncomingCallWebhook>;

  /**
   * Parse call status webhook
   */
  abstract parseCallStatusWebhook(rawBody: Buffer): Promise<CallStatusWebhook>;

  /**
   * Register incoming call handler
   */
  onIncomingCall(handler: (call: IncomingCallWebhook) => void): void {
    this.incomingCallHandlers.add(handler);
  }

  /**
   * Register call status handler
   */
  onCallStatus(handler: (status: CallStatusWebhook) => void): void {
    this.callStatusHandlers.add(handler);
  }

  /**
   * Register call event handler
   */
  onCallEvent(handler: (event: CallEvent) => void): void {
    this.callEventHandlers.add(handler);
  }

  /**
   * Emit incoming call event
   */
  protected emitIncomingCall(call: IncomingCallWebhook): void {
    this.incomingCallHandlers.forEach(handler => {
      try {
        handler(call);
      } catch (error) {
        console.error('[calling] Error in incoming call handler:', error);
      }
    });
  }

  /**
   * Emit call status event
   */
  protected emitCallStatus(status: CallStatusWebhook): void {
    this.callStatusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('[calling] Error in call status handler:', error);
      }
    });
  }

  /**
   * Emit call event
   */
  protected emitCallEvent(event: CallEvent): void {
    this.callEventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[calling] Error in call event handler:', error);
      }
    });
  }

  /**
   * Check rate limits
   */
  protected checkRateLimit(): boolean {
    if (!this.rateLimiter.canMakeCall()) {
      console.warn('[calling] Rate limit exceeded');
      return false;
    }
    this.rateLimiter.recordCall();
    return true;
  }

  /**
   * Record call completion
   */
  protected recordCallCompletion(): void {
    this.rateLimiter.releaseCall();
  }

  /**
   * Get rate limit stats
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }
}
