// Integrations Index - Central export point for all third-party integrations
export { emailProvider, type EmailConfig, type EmailMessage, type EmailDeliveryResult } from './emailProvider';
export { smsProvider, type SmsConfig, type SmsMessage, type SmsDeliveryResult } from './smsProvider';

// Initialize providers based on environment configuration
import { emailProvider } from './emailProvider';
import { smsProvider } from './smsProvider';
import { createLogger } from '../utils/logger';

const log = createLogger('Integrations');

/**
 * Initialize all third-party providers based on environment variables
 * This should be called during application startup
 */
export async function initializeProviders(): Promise<void> {
  try {
    log.info('Initializing third-party providers...');

    // Configure Email Provider
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
        : 100
    });

    // Test email provider connection
    const emailConnected = await emailProvider.testConnection();
    if (emailConnected) {
      log.info('✓ Email provider initialized and connected');
    } else {
      log.warn('⚠ Email provider initialized but connection test failed');
    }

    // Configure SMS Provider
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
        : 100
    });

    // Test SMS provider connection
    const smsConnected = await smsProvider.testConnection();
    if (smsConnected) {
      log.info('✓ SMS provider initialized and connected');
    } else {
      log.warn('⚠ SMS provider initialized but connection test failed');
    }

    log.info('✓ All third-party providers initialized');
  } catch (error) {
    log.error('Failed to initialize providers', { error });
    throw error;
  }
}

/**
 * Get health status of all providers
 */
export async function getProvidersHealthStatus(): Promise<Record<string, any>> {
  const status: Record<string, any> = {
    email: {
      provider: emailProvider.getConfig().provider,
      configured: emailProvider.getConfig().provider !== 'mock',
      connected: await emailProvider.testConnection()
    },
    sms: {
      provider: smsProvider.getConfig().provider,
      configured: smsProvider.getConfig().provider !== 'mock',
      connected: await smsProvider.testConnection()
    }
  };

  return status;
}

/**
 * Production-ready initialization code pattern
 * Add to your server/index.ts or startup sequence:
 *
 * import { initializeProviders } from './integrations';
 *
 * async function startServer() {
 *   // ... other initialization code ...
 *
 *   // Initialize third-party integrations
 *   await initializeProviders();
 *
 *   // ... rest of server startup ...
 * }
 */
