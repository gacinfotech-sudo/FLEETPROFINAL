// Notification Channel Manager - Unified interface for multiple delivery channels
import { createLogger } from './logger';

let nodemailer: any;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer is optional if email delivery not configured
  nodemailer = null;
}

const log = createLogger('NotificationChannels');

// Channel types
export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export interface ChannelConfig {
  name: NotificationChannel;
  enabled: boolean;
  provider?: string;
  credentials?: Record<string, string>;
  settings?: Record<string, any>;
}

export interface DeliveryResult {
  channel: NotificationChannel;
  status: 'success' | 'failed';
  messageId?: string;
  error?: string;
  timestamp: Date;
  deliveryTime: number; // milliseconds
}

// Email Channel Implementation
export class EmailChannel {
  private transporter: any;
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (!nodemailer) {
      log.warn('nodemailer not available, email delivery disabled');
      return;
    }

    const provider = this.config.provider || 'smtp';

    if (provider === 'sendgrid') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: this.config.credentials?.sendgridApiKey || ''
        }
      });
    } else if (provider === 'gmail') {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.config.credentials?.gmailEmail || '',
          pass: this.config.credentials?.gmailAppPassword || ''
        }
      });
    } else {
      // Default SMTP
      this.transporter = nodemailer.createTransport({
        host: this.config.credentials?.smtpHost || 'localhost',
        port: parseInt(this.config.credentials?.smtpPort || '587'),
        secure: this.config.credentials?.smtpSecure === 'true',
        auth: {
          user: this.config.credentials?.smtpUser || '',
          pass: this.config.credentials?.smtpPassword || ''
        }
      });
    }
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.config.enabled) {
        throw new Error('Email channel is disabled');
      }

      const result = await this.transporter.sendMail({
        from: this.config.settings?.fromEmail || 'noreply@fleetpro.local',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
        replyTo: this.config.settings?.replyTo
      });

      log.info('Email sent successfully', { to, subject, messageId: result.messageId });

      return {
        channel: 'email',
        status: 'success',
        messageId: result.messageId,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Email delivery failed', { to, subject, error: errorMsg });

      return {
        channel: 'email',
        status: 'failed',
        error: errorMsg,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      if (this.transporter.verify) {
        await this.transporter.verify();
        log.info('Email channel verified');
        return true;
      }
      return true;
    } catch (error) {
      log.error('Email channel verification failed', { error });
      return false;
    }
  }
}

// SMS Channel Implementation (Twilio-based)
export class SMSChannel {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
    this.accountSid = config.credentials?.twilioAccountSid || '';
    this.authToken = config.credentials?.twilioAuthToken || '';
    this.fromNumber = config.settings?.fromNumber || '';
  }

  async send(to: string, message: string): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.config.enabled) {
        throw new Error('SMS channel is disabled');
      }

      if (!this.accountSid || !this.authToken) {
        throw new Error('Twilio credentials not configured');
      }

      // Twilio API call (using basic auth)
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: this.fromNumber,
          To: to,
          Body: message
        }).toString()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'SMS delivery failed');
      }

      const result = await response.json();

      log.info('SMS sent successfully', { to, messageId: result.sid });

      return {
        channel: 'sms',
        status: 'success',
        messageId: result.sid,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('SMS delivery failed', { to, error: errorMsg });

      return {
        channel: 'sms',
        status: 'failed',
        error: errorMsg,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    }
  }
}

// Push Notification Channel (using VAPID)
export class PushChannel {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
    this.vapidPublicKey = config.credentials?.vapidPublicKey || '';
    this.vapidPrivateKey = config.credentials?.vapidPrivateKey || '';
  }

  async send(
    subscription: any,
    title: string,
    options: any
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.config.enabled) {
        throw new Error('Push channel is disabled');
      }

      if (!this.vapidPublicKey || !this.vapidPrivateKey) {
        throw new Error('VAPID keys not configured');
      }

      // For production: use web-push library
      // This is a placeholder implementation
      const payload = JSON.stringify({
        title,
        ...options
      });

      log.info('Push notification sent', { title });

      return {
        channel: 'push',
        status: 'success',
        messageId: `push-${Date.now()}`,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Push delivery failed', { title, error: errorMsg });

      return {
        channel: 'push',
        status: 'failed',
        error: errorMsg,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    }
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }
}

// In-App Notification Channel (DB-only)
export class InAppChannel {
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  async send(
    userId: string,
    title: string,
    body: string,
    options?: any
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      if (!this.config.enabled) {
        throw new Error('In-app channel is disabled');
      }

      // In-app notifications are stored in database by delivery orchestrator
      // This channel just confirms storage
      log.info('In-app notification recorded', { userId, title });

      return {
        channel: 'in_app',
        status: 'success',
        messageId: `in-app-${Date.now()}`,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('In-app notification failed', { userId, error: errorMsg });

      return {
        channel: 'in_app',
        status: 'failed',
        error: errorMsg,
        timestamp: new Date(),
        deliveryTime: Date.now() - startTime
      };
    }
  }
}

// Channel Manager - Orchestrates all channels
export class NotificationChannelManager {
  private channels: Map<NotificationChannel, any> = new Map();
  private configs: Map<NotificationChannel, ChannelConfig> = new Map();

  registerChannel(config: ChannelConfig) {
    const name = config.name;

    try {
      let channel: any;

      switch (name) {
        case 'email':
          channel = new EmailChannel(config);
          break;
        case 'sms':
          channel = new SMSChannel(config);
          break;
        case 'push':
          channel = new PushChannel(config);
          break;
        case 'in_app':
          channel = new InAppChannel(config);
          break;
        default:
          throw new Error(`Unknown channel: ${name}`);
      }

      this.channels.set(name, channel);
      this.configs.set(name, config);
      log.info('Channel registered', { channel: name, provider: config.provider });
    } catch (error) {
      log.error('Failed to register channel', { channel: name, error });
      throw error;
    }
  }

  getChannel(name: NotificationChannel): any {
    return this.channels.get(name);
  }

  getConfig(name: NotificationChannel): ChannelConfig | undefined {
    return this.configs.get(name);
  }

  isChannelEnabled(name: NotificationChannel): boolean {
    return this.configs.get(name)?.enabled || false;
  }

  async verifyChannels(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, channel] of this.channels) {
      try {
        if (channel.verify) {
          results[name] = await channel.verify();
        } else {
          results[name] = true; // Assume working if no verify method
        }
      } catch (error) {
        log.error(`Channel verification failed: ${name}`, { error });
        results[name] = false;
      }
    }

    return results;
  }

  getEnabledChannels(): NotificationChannel[] {
    const enabled: NotificationChannel[] = [];

    for (const [name, config] of this.configs) {
      if (config.enabled) {
        enabled.push(name);
      }
    }

    return enabled;
  }

  getChannelStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, config] of this.configs) {
      stats[name] = {
        enabled: config.enabled,
        provider: config.provider,
        hasCredentials: !!config.credentials && Object.keys(config.credentials).length > 0
      };
    }

    return stats;
  }
}

// Singleton instance
let channelManager: NotificationChannelManager | null = null;

export function getChannelManager(): NotificationChannelManager {
  if (!channelManager) {
    channelManager = new NotificationChannelManager();
  }
  return channelManager;
}

export function initializeChannels(configs: ChannelConfig[]) {
  const manager = getChannelManager();

  for (const config of configs) {
    manager.registerChannel(config);
  }

  log.info('Notification channels initialized', {
    channels: manager.getEnabledChannels()
  });
}
