/**
 * Universal Integration Hub - Main Index
 * Central export point for all integration infrastructure
 * Supports: WhatsApp, Calling, GPS, KYC/DigiLocker, eSign, and custom providers
 *
 * PHASE 1: Core Infrastructure
 * - Models (IntegrationProvider, ProviderConnection, IntegrationAuditLog)
 * - Types (canonical type definitions)
 * - Adapters (base provider adapter)
 * - Registry (provider discovery and registration)
 *
 * PHASE 2-7: Provider Implementation
 * - WhatsApp adapter
 * - Calling adapter
 * - GPS adapter
 * - KYC/DigiLocker adapter
 * - eSign adapter
 * - Payment adapter
 * - Analytics adapter
 */

// PHASE 1: Core Infrastructure Exports

// Types
export type {
  IntegrationCategory,
  ProviderHealthStatus,
  ProviderConnectionStatus,
  IntegrationRole,
  AuditActionType,
  AuditResultStatus,
  WebhookEventType,
  ProviderConfig,
  EncryptedCredentials,
  HealthCheckResult,
  AdapterRequest,
  AdapterResponse,
  WebhookEventPayload,
  RateLimitState,
  TenantContext,
  AdapterOptions,
  ProviderMetadata,
} from './types';

export {
  IntegrationError,
  ProviderNotFoundError,
  ConnectionNotFoundError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ConfigurationError,
  WebhookVerificationError,
} from './types';

// Models
export {
  IntegrationProvider,
  ProviderConnection,
  IntegrationAuditLog,
  type IIntegrationProvider,
  type IProviderConnection,
  type IIntegrationAuditLog,
} from './models';

// Adapters
export { BaseProviderAdapter } from './adapters';

// Registry
export { ProviderRegistry, getProviderRegistry } from './config';

// Legacy Email/SMS Providers (backward compatibility)
export { emailProvider, type EmailConfig, type EmailMessage, type EmailDeliveryResult } from './emailProvider';
export { smsProvider, type SmsConfig, type SmsMessage, type SmsDeliveryResult } from './smsProvider';

// Imports for initialization
import { emailProvider } from './emailProvider';
import { smsProvider } from './smsProvider';
import { createLogger } from '../utils/logger';
import { getProviderRegistry } from './config';

const log = createLogger('Integrations');

/**
 * Initialize integration hub
 * Called during application startup
 * Loads provider registry and configures legacy providers
 */
export async function initializeIntegrationHub(): Promise<void> {
  try {
    log.info('🚀 Initializing Universal Integration Hub');

    // Initialize provider registry
    const registry = getProviderRegistry();
    await registry.initialize();

    const stats = registry.getStatistics();
    log.info(`✓ Provider registry initialized`, {
      totalProviders: stats.totalProviders,
      byCategory: stats.byCategory,
    });

    // Initialize legacy email provider
    const emailProviderType = process.env.EMAIL_PROVIDER || 'mock';
    log.info(`Configuring email provider: ${emailProviderType}`);

    emailProvider.updateConfig({
      provider: emailProviderType as any,
      sendgridApiKey: process.env.SENDGRID_API_KEY,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      fromEmail: process.env.EMAIL_FROM || 'noreply@fleetpro.com',
      fromName: process.env.EMAIL_FROM_NAME || 'FleetPro',
      replyTo: process.env.EMAIL_REPLY_TO,
      rateLimitPerMinute: process.env.EMAIL_RATE_LIMIT
        ? parseInt(process.env.EMAIL_RATE_LIMIT)
        : 100,
    });

    const emailConnected = await emailProvider.testConnection();
    if (emailConnected) {
      log.info('✓ Email provider initialized and connected');
    } else {
      log.warn('⚠ Email provider initialized but connection test failed');
    }

    // Initialize legacy SMS provider
    const smsProviderType = process.env.SMS_PROVIDER || 'mock';
    log.info(`Configuring SMS provider: ${smsProviderType}`);

    smsProvider.updateConfig({
      provider: smsProviderType as any,
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
      awsRegion: process.env.AWS_REGION,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      rateLimitPerMinute: process.env.SMS_RATE_LIMIT
        ? parseInt(process.env.SMS_RATE_LIMIT)
        : 100,
    });

    const smsConnected = await smsProvider.testConnection();
    if (smsConnected) {
      log.info('✓ SMS provider initialized and connected');
    } else {
      log.warn('⚠ SMS provider initialized but connection test failed');
    }

    log.info('✅ Universal Integration Hub initialized successfully');
  } catch (error) {
    log.error('Failed to initialize integration hub', error as Error);
    throw error;
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use initializeIntegrationHub instead
 */
export async function initializeProviders(): Promise<void> {
  await initializeIntegrationHub();
}

/**
 * Get health status of all providers
 */
export async function getProvidersHealthStatus(): Promise<Record<string, any>> {
  const status: Record<string, any> = {
    email: {
      provider: emailProvider.getConfig().provider,
      configured: emailProvider.getConfig().provider !== 'mock',
      connected: await emailProvider.testConnection(),
    },
    sms: {
      provider: smsProvider.getConfig().provider,
      configured: smsProvider.getConfig().provider !== 'mock',
      connected: await smsProvider.testConnection(),
    },
  };

  return status;
}

export default {
  initializeIntegrationHub,
  initializeProviders,
  getProvidersHealthStatus,
  getProviderRegistry,
};
