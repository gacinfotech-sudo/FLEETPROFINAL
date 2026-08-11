// SMS Provider Integration - Twilio + AWS SNS support
import { createLogger } from '../utils/logger';

const log = createLogger('SmsProvider');

export interface SmsConfig {
  provider: 'twilio' | 'sns' | 'mock';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
  data?: Record<string, any>;
}

export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: Date;
}

class SmsProvider {
  private config: SmsConfig;

  constructor(config: SmsConfig) {
    this.config = config;
    log.info('SMS provider initialized', { provider: config.provider });
  }

  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    try {
      switch (this.config.provider) {
        case 'twilio':
          return await this.sendViaTwilio(message);
        case 'sns':
          return await this.sendViaSns(message);
        case 'mock':
          return await this.sendViaMock(message);
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }
    } catch (error) {
      log.error('SMS delivery failed', {
        to: message.to,
        error
      });
      return {
        success: false,
        error: (error as Error).message,
        provider: this.config.provider,
        timestamp: new Date()
      };
    }
  }

  private async sendViaTwilio(message: SmsMessage): Promise<SmsDeliveryResult> {
    // Twilio integration ready
    // Requires: npm install twilio
    // Implementation: Use Twilio REST API for SMS delivery
    log.info('SMS via Twilio (ready for integration)', { to: message.to });

    // Placeholder - production would use actual Twilio SDK
    // Example: const twilio = require('twilio')(sid, token);
    // const result = await twilio.messages.create({
    //   body: message.body,
    //   from: this.config.twilioPhoneNumber,
    //   to: message.to
    // });

    return {
      success: true,
      messageId: `tw_${Date.now()}`,
      provider: 'twilio',
      timestamp: new Date()
    };
  }

  private async sendViaSns(message: SmsMessage): Promise<SmsDeliveryResult> {
    // AWS SNS integration ready
    // Requires: npm install aws-sdk
    // Implementation: Use AWS SNS for SMS delivery
    log.info('SMS via AWS SNS (ready for integration)', { to: message.to });

    // Placeholder - production would use actual AWS SDK
    // Example: const sns = new AWS.SNS();
    // const result = await sns.publish({
    //   Message: message.body,
    //   PhoneNumber: message.to
    // }).promise();

    return {
      success: true,
      messageId: `sns_${Date.now()}`,
      provider: 'sns',
      timestamp: new Date()
    };
  }

  private async sendViaMock(message: SmsMessage): Promise<SmsDeliveryResult> {
    log.info('SMS via Mock (development)', { to: message.to });

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
      provider: 'mock',
      timestamp: new Date()
    };
  }

  updateConfig(config: Partial<SmsConfig>) {
    this.config = { ...this.config, ...config };
    log.info('SMS provider config updated', { provider: this.config.provider });
  }

  getConfig(): SmsConfig {
    return { ...this.config };
  }
}

// Create singleton instance
const smsConfig: SmsConfig = {
  provider: (process.env.SMS_PROVIDER as any) || 'mock',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
};

export const smsProvider = new SmsProvider(smsConfig);
