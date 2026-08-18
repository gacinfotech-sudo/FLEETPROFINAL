/**
 * Universal Integration Hub - Canonical Types
 * Central type definitions for all provider integrations
 * Supports: WhatsApp, Calling, GPS, KYC/DigiLocker, eSign
 */

/**
 * Integration category - corresponds to major provider categories
 */
export type IntegrationCategory =
  | 'MESSAGING' // WhatsApp, SMS, Email
  | 'CALLING' // Telephony, Video Calling
  | 'GPS' // GPS Tracking, Location
  | 'KYC' // Identity verification, DigiLocker
  | 'ESIGN' // Digital signature, eSign
  | 'PAYMENT' // Payment processing
  | 'ANALYTICS' // Analytics and reporting
  | 'STORAGE' // Cloud storage
  | 'CUSTOM'; // Custom integrations

/**
 * Provider status in health check
 */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'down' | 'unchecked';

/**
 * Connection status
 */
export type ProviderConnectionStatus = 'active' | 'inactive' | 'error' | 'pending_auth' | 'expired';

/**
 * RBAC role for integration management
 */
export type IntegrationRole = 'viewer' | 'operator' | 'admin' | 'super_admin';

/**
 * Audit action type
 */
export type AuditActionType =
  | 'CREATE_PROVIDER'
  | 'UPDATE_PROVIDER'
  | 'DELETE_PROVIDER'
  | 'CONNECT_PROVIDER'
  | 'DISCONNECT_PROVIDER'
  | 'TEST_CONNECTION'
  | 'RETRIEVE_CREDENTIALS'
  | 'UPDATE_CREDENTIALS'
  | 'HEALTH_CHECK'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AUTHORIZATION_FAILED'
  | 'SYNC_OPERATION'
  | 'CUSTOM_ACTION';

/**
 * Audit result status
 */
export type AuditResultStatus = 'success' | 'failure' | 'partial';

/**
 * Webhook event type
 */
export type WebhookEventType =
  | 'message.received'
  | 'message.sent'
  | 'call.initiated'
  | 'call.ended'
  | 'location.updated'
  | 'document.verified'
  | 'document.rejected'
  | 'signature.completed'
  | 'signature.failed'
  | 'payment.received'
  | 'provider.error'
  | 'custom_event';

/**
 * Configuration for a provider
 */
export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  apiEndpoint?: string;
  region?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
  [key: string]: any; // Allow custom config fields
}

/**
 * Credentials stored encrypted
 */
export interface EncryptedCredentials {
  encrypted: string;
  algorithm: string;
  iv: string;
  authTag: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: ProviderHealthStatus;
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Adapter request/response types
 */
export interface AdapterRequest {
  action: string;
  tenantId: string;
  userId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AdapterResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

/**
 * Webhook event from provider
 */
export interface WebhookEventPayload {
  providerId: string;
  eventType: WebhookEventType;
  timestamp: Date;
  data: Record<string, any>;
  signature?: string; // HMAC signature for verification
  idempotencyKey?: string; // For idempotency
}

/**
 * Rate limiting state
 */
export interface RateLimitState {
  requestCount: number;
  resetAt: Date;
  limitPerMinute: number;
}

/**
 * Integration error with context
 */
export class IntegrationError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

/**
 * Provider not found error
 */
export class ProviderNotFoundError extends IntegrationError {
  constructor(providerId: string) {
    super('PROVIDER_NOT_FOUND', `Provider not found: ${providerId}`, 404);
  }
}

/**
 * Connection not found error
 */
export class ConnectionNotFoundError extends IntegrationError {
  constructor(connectionId: string) {
    super('CONNECTION_NOT_FOUND', `Connection not found: ${connectionId}`, 404);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends IntegrationError {
  constructor(message: string = 'Authentication failed') {
    super('AUTHENTICATION_FAILED', message, 401);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends IntegrationError {
  constructor(message: string = 'Not authorized') {
    super('AUTHORIZATION_FAILED', message, 403);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends IntegrationError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
  }
}

/**
 * Provider configuration error
 */
export class ConfigurationError extends IntegrationError {
  constructor(message: string = 'Invalid configuration') {
    super('INVALID_CONFIG', message, 400);
  }
}

/**
 * Webhook verification error
 */
export class WebhookVerificationError extends IntegrationError {
  constructor(message: string = 'Webhook verification failed') {
    super('WEBHOOK_VERIFICATION_FAILED', message, 401);
  }
}

/**
 * Multi-tenant isolation context
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  role?: IntegrationRole;
  permissions?: string[];
}

/**
 * Adapter initialization options
 */
export interface AdapterOptions {
  tenantContext: TenantContext;
  config: ProviderConfig;
  logger?: any; // Logger instance
  maxRetries?: number;
  timeout?: number;
}

/**
 * Provider metadata
 */
export interface ProviderMetadata {
  displayName: string;
  description: string;
  icon?: string;
  category: IntegrationCategory;
  version: string;
  documentation?: string;
  supportedFeatures: string[];
  requiredCredentials: string[];
}
