/**
 * BaseProviderAdapter
 * Abstract base class for all provider adapters
 * Provides common functionality: auth, request handling, error management, rate limiting
 */

import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import {
  AdapterOptions,
  AdapterRequest,
  AdapterResponse,
  EncryptedCredentials,
  IntegrationError,
  ProviderConfig,
  RateLimitError,
  RateLimitState,
  TenantContext,
  WebhookEventPayload,
  WebhookVerificationError,
} from '../types';

/**
 * BaseProviderAdapter
 * Base class for all provider adapters
 */
export abstract class BaseProviderAdapter {
  protected logger: any;
  protected tenantContext: TenantContext;
  protected config: ProviderConfig;
  protected maxRetries: number;
  protected timeout: number;
  protected rateLimitState: Map<string, RateLimitState> = new Map();

  constructor(options: AdapterOptions) {
    this.tenantContext = options.tenantContext;
    this.config = options.config;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.logger = options.logger || createLogger(`Adapter:${this.constructor.name}`);
  }

  /**
   * Get provider ID (must be implemented by subclass)
   */
  abstract getProviderId(): string;

  /**
   * Execute an action on the provider
   * Implement specific provider logic in subclass
   */
  abstract executeAction(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Test connection to provider
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.info('Testing connection to provider', {
        provider: this.getProviderId(),
        tenant: this.tenantContext.tenantId,
      });

      const request: AdapterRequest = {
        action: 'health_check',
        tenantId: this.tenantContext.tenantId,
        data: {},
      };

      const response = await this.executeAction(request);
      return response.success;
    } catch (error) {
      this.logger.error('Connection test failed', error as Error, {
        provider: this.getProviderId(),
      });
      return false;
    }
  }

  /**
   * Verify webhook signature
   * Uses HMAC-SHA256 by default
   */
  protected verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error as Error);
      return false;
    }
  }

  /**
   * Verify incoming webhook event
   */
  async verifyWebhookEvent(
    payload: string,
    signature: string,
  ): Promise<WebhookEventPayload> {
    // Get webhook secret from config
    const webhookSecret = this.config.webhookSecret;
    if (!webhookSecret) {
      throw new WebhookVerificationError('Webhook secret not configured');
    }

    // Verify signature
    if (!this.verifyWebhookSignature(payload, signature, webhookSecret)) {
      throw new WebhookVerificationError('Invalid webhook signature');
    }

    // Parse and validate payload
    let event: WebhookEventPayload;
    try {
      event = JSON.parse(payload);
    } catch (error) {
      throw new WebhookVerificationError('Invalid webhook payload');
    }

    // Check idempotency key exists
    if (!event.idempotencyKey) {
      throw new WebhookVerificationError('Missing idempotency key');
    }

    return event;
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest<T = any>(
    url: string,
    options: any = {},
  ): Promise<T> {
    const maxRetries = options.retries || this.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Making request to ${url}`, {
          attempt: attempt + 1,
          maxRetries,
        });

        // Use native fetch (Node 18+) or fallback
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.timeout,
        );

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorBody = await response.text();
            throw new IntegrationError(
              'HTTP_ERROR',
              `HTTP ${response.status}: ${errorBody}`,
              response.status,
            );
          }

          const data = await response.json();
          return data as T;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Request failed, retrying in ${delay}ms`,
            error as Error,
            { attempt: attempt + 1 },
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new IntegrationError(
      'REQUEST_FAILED',
      'Request failed after all retries',
    );
  }

  /**
   * Check rate limit
   */
  protected checkRateLimit(key: string): void {
    const limit = this.config.rateLimitPerMinute || 60;
    let state = this.rateLimitState.get(key);

    const now = new Date();

    // Reset if minute has passed
    if (!state || now > state.resetAt) {
      state = {
        requestCount: 0,
        resetAt: new Date(now.getTime() + 60000), // 1 minute from now
        limitPerMinute: limit,
      };
    }

    // Check limit
    if (state.requestCount >= state.limitPerMinute) {
      throw new RateLimitError(
        `Rate limit exceeded: ${state.requestCount}/${state.limitPerMinute}`,
      );
    }

    // Increment counter
    state.requestCount++;
    this.rateLimitState.set(key, state);
  }

  /**
   * Encrypt credentials
   */
  protected encryptCredentials(
    credentials: Record<string, any>,
    encryptionKey: string,
  ): EncryptedCredentials {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const key = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const payload = JSON.stringify(credentials);

    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      algorithm,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt credentials
   */
  protected decryptCredentials(
    encrypted: EncryptedCredentials,
    encryptionKey: string,
  ): Record<string, any> {
    const algorithm = encrypted.algorithm;
    const key = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();

    const decipher = crypto.createDecipheriv(
      algorithm,
      key,
      Buffer.from(encrypted.iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

    let decrypted = decipher.update(encrypted.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Add authorization headers
   */
  protected addAuthHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  /**
   * Handle response errors consistently
   */
  protected handleResponseError(
    statusCode: number,
    body: any,
  ): void {
    const errorMap: Record<number, { code: string; message: string }> = {
      401: { code: 'UNAUTHORIZED', message: 'Authentication failed' },
      403: { code: 'FORBIDDEN', message: 'Access denied' },
      404: { code: 'NOT_FOUND', message: 'Resource not found' },
      429: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' },
      500: { code: 'SERVER_ERROR', message: 'Server error' },
      503: { code: 'UNAVAILABLE', message: 'Service unavailable' },
    };

    const error = errorMap[statusCode];
    if (error) {
      throw new IntegrationError(error.code, error.message, statusCode);
    }

    throw new IntegrationError(
      'API_ERROR',
      `API returned status ${statusCode}`,
      statusCode,
      { body },
    );
  }

  /**
   * Sleep utility for retries
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build response
   */
  protected buildResponse<T = any>(
    success: boolean,
    data?: T,
    error?: { code: string; message: string; details?: Record<string, any> },
  ): AdapterResponse<T> {
    return {
      success,
      data,
      error,
      metadata: {
        provider: this.getProviderId(),
        tenant: this.tenantContext.tenantId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Log action execution
   */
  protected logAction(
    action: string,
    status: 'start' | 'success' | 'error',
    metadata?: Record<string, any>,
  ): void {
    const level =
      status === 'error'
        ? 'error'
        : status === 'success'
          ? 'info'
          : 'debug';

    this.logger[level](`Action ${action} ${status}`, {
      action,
      status,
      provider: this.getProviderId(),
      tenant: this.tenantContext.tenantId,
      ...metadata,
    });
  }
}

export default BaseProviderAdapter;
