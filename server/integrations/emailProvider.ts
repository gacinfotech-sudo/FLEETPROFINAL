// Email Provider Integration - SendGrid + SMTP support (Production-Ready)
import axios, { AxiosInstance } from 'axios';
import nodemailer from 'nodemailer';
import { createLogger } from '../utils/logger';

const log = createLogger('EmailProvider');

export interface EmailConfig {
  provider: 'sendgrid' | 'smtp' | 'mock';
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  rateLimitPerMinute?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  data?: Record<string, any>;
  trackingSettings?: {
    openTracking?: boolean;
    clickTracking?: boolean;
  };
  tags?: string[];
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  timestamp: Date;
  statusCode?: number;
}

class EmailProvider {
  private config: EmailConfig;
  private sgClient: AxiosInstance | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;
  private rateLimitStats = {
    count: 0,
    resetTime: Date.now()
  };

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeProvider();
    log.info('Email provider initialized', { provider: config.provider });
  }

  private initializeProvider() {
    if (this.config.provider === 'sendgrid') {
      this.initializeSendGrid();
    } else if (this.config.provider === 'smtp') {
      this.initializeSmtp();
    }
  }

  private initializeSendGrid() {
    if (!this.config.sendgridApiKey) {
      log.warn('SendGrid API key not configured');
      return;
    }

    this.sgClient = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: {
        Authorization: `Bearer ${this.config.sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    log.info('SendGrid client initialized');
  }

  private initializeSmtp() {
    if (!this.config.smtpHost || !this.config.smtpUser || !this.config.smtpPass) {
      log.warn('SMTP configuration incomplete');
      return;
    }

    this.smtpTransporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort || 587,
      secure: (this.config.smtpPort || 587) === 465,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass
      }
    });

    log.info('SMTP transporter initialized');
  }

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      // Check rate limit
      this.checkRateLimit();

      switch (this.config.provider) {
        case 'sendgrid':
          return await this.sendViaSendGrid(message);
        case 'smtp':
          return await this.sendViaSmtp(message);
        case 'mock':
          return await this.sendViaMock(message);
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }
    } catch (error) {
      log.error('Email delivery failed', {
        to: message.to[0],
        subject: message.subject,
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

  async sendBulk(messages: EmailMessage[]): Promise<EmailDeliveryResult[]> {
    return Promise.all(messages.map(msg => this.send(msg)));
  }

  private async sendViaSendGrid(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      if (!this.sgClient) {
        throw new Error('SendGrid client not initialized');
      }

      const payload = {
        personalizations: [
          {
            to: message.to.map(email => ({ email })),
            ...(message.cc && { cc: message.cc.map(email => ({ email })) }),
            ...(message.bcc && { bcc: message.bcc.map(email => ({ email })) }),
            subject: message.subject
          }
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        content: [
          {
            type: 'text/html',
            value: message.htmlBody
          }
        ],
        ...(message.textBody && {
          content: message.content ? [...message.content] : undefined
        }),
        ...(message.replyTo && { reply_to: { email: message.replyTo } }),
        ...(message.tags && { categories: message.tags }),
        ...(message.trackingSettings && {
          tracking_settings: {
            open_tracking: message.trackingSettings.openTracking ? { enable: true } : undefined,
            click_tracking: message.trackingSettings.clickTracking ? { enable: true } : undefined
          }
        })
      };

      const response = await this.sgClient.post('/mail/send', payload);
      const messageId = response.headers['x-message-id'] || `sg_${Date.now()}`;

      log.info('Email sent via SendGrid', {
        to: message.to[0],
        messageId
      });

      return {
        success: true,
        messageId,
        provider: 'sendgrid',
        timestamp: new Date(),
        statusCode: response.status
      };
    } catch (error: any) {
      log.error('SendGrid delivery failed', {
        error: error.message,
        statusCode: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        provider: 'sendgrid',
        timestamp: new Date(),
        statusCode: error.response?.status
      };
    }
  }

  private async sendViaSmtp(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      if (!this.smtpTransporter) {
        throw new Error('SMTP transporter not initialized');
      }

      const info = await this.smtpTransporter.sendMail({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: message.to.join(', '),
        cc: message.cc?.join(', '),
        bcc: message.bcc?.join(', '),
        subject: message.subject,
        html: message.htmlBody,
        text: message.textBody,
        replyTo: message.replyTo || this.config.replyTo,
        headers: {
          'X-FleetPro-Message-ID': `fleetpro_${Date.now()}`
        }
      });

      log.info('Email sent via SMTP', {
        to: message.to[0],
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId || `smtp_${Date.now()}`,
        provider: 'smtp',
        timestamp: new Date()
      };
    } catch (error: any) {
      log.error('SMTP delivery failed', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        provider: 'smtp',
        timestamp: new Date()
      };
    }
  }

  private async sendViaMock(message: EmailMessage): Promise<EmailDeliveryResult> {
    log.info('Email sent via Mock (development)', {
      to: message.to[0],
      subject: message.subject
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider: 'mock',
      timestamp: new Date()
    };
  }

  private checkRateLimit() {
    const limit = this.config.rateLimitPerMinute || 100;
    const now = Date.now();
    const windowMs = 60 * 1000;

    if (now - this.rateLimitStats.resetTime > windowMs) {
      this.rateLimitStats.count = 0;
      this.rateLimitStats.resetTime = now;
    }

    this.rateLimitStats.count++;

    if (this.rateLimitStats.count > limit) {
      const waitMs = windowMs - (now - this.rateLimitStats.resetTime);
      throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(waitMs / 1000)}s`);
    }
  }

  updateConfig(config: Partial<EmailConfig>) {
    this.config = { ...this.config, ...config };
    this.initializeProvider();
    log.info('Email provider config updated', { provider: this.config.provider });
  }

  getConfig(): EmailConfig {
    return { ...this.config };
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.config.provider === 'sendgrid' && this.sgClient) {
        const response = await this.sgClient.get('/user/account');
        return response.status === 200;
      } else if (this.config.provider === 'smtp' && this.smtpTransporter) {
        await this.smtpTransporter.verify();
        return true;
      } else if (this.config.provider === 'mock') {
        return true;
      }
      return false;
    } catch (error) {
      log.error('Connection test failed', { error });
      return false;
    }
  }
}

// Create singleton instance
const emailConfig: EmailConfig = {
  provider: (process.env.EMAIL_PROVIDER as any) || 'mock',
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  fromEmail: process.env.EMAIL_FROM || 'noreply@fleetpro.com',
  fromName: process.env.EMAIL_FROM_NAME || 'FleetPro'
};

export const emailProvider = new EmailProvider(emailConfig);
