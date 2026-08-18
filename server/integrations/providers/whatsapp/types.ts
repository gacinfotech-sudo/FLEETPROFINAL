/**
 * WhatsApp Provider Types
 * Defines interfaces and types for WhatsApp messaging integration
 * Supports both official Business Cloud API and unofficial QR-based (Baileys)
 */

/**
 * WhatsApp session status
 */
export type WhatsAppSessionStatus = 'disconnected' | 'qr_pending' | 'connected' | 'logged_out' | 'error';

/**
 * Message send result
 */
export interface MessageSendResult {
  providerMessageId: string | null;
  status: 'sent' | 'failed' | 'queued';
  error?: string;
  retryCount?: number;
  sentAt?: Date;
}

/**
 * Incoming WhatsApp message
 */
export interface IncomingWhatsAppMessage {
  tenantId: string;
  fromPhone: string;
  text: string;
  providerMessageId: string;
  receivedAt: Date;
  media?: {
    type: 'image' | 'document' | 'audio' | 'video';
    url: string;
    mimeType: string;
  };
  isFromBusiness?: boolean;
}

/**
 * Document send options
 */
export interface DocumentSendOptions {
  fileName: string;
  mimetype: string;
  caption?: string;
  pageCount?: number;
}

/**
 * Media send options
 */
export interface MediaSendOptions {
  type: 'image' | 'document' | 'audio' | 'video';
  url?: string;
  buffer?: Buffer;
  mimeType: string;
  caption?: string;
}

/**
 * Session status response
 */
export interface SessionStatusResponse {
  status: WhatsAppSessionStatus;
  qrDataUrl?: string;
  phoneNumber?: string;
  connectedAt?: Date;
  lastActivity?: Date;
}

/**
 * Message delivery status
 */
export interface MessageDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  deliveredAt?: Date;
  readAt?: Date;
  error?: string;
}

/**
 * WhatsApp provider interface
 */
export interface IWhatsAppProvider {
  readonly providerKey: string;

  /**
   * Start (or resume) a session for this tenant
   * Idempotent — calling it again while already connected/pending just returns current status
   */
  startSession(tenantId: string): Promise<SessionStatusResponse>;

  /**
   * Get current session status
   */
  getStatus(tenantId: string): Promise<SessionStatusResponse>;

  /**
   * Logout a session and cleanup
   */
  logoutSession(tenantId: string): Promise<void>;

  /**
   * Send text message
   */
  sendText(tenantId: string, phone: string, text: string): Promise<MessageSendResult>;

  /**
   * Send document (PDF, etc)
   */
  sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    opts: DocumentSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Send media (image, audio, video)
   */
  sendMedia(
    tenantId: string,
    phone: string,
    media: MediaSendOptions,
  ): Promise<MessageSendResult>;

  /**
   * Register incoming message handler
   */
  onIncoming(handler: (msg: IncomingWhatsAppMessage) => void): void;

  /**
   * Register delivery status handler
   */
  onDeliveryStatus?(handler: (status: MessageDeliveryStatus) => void): void;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;

  /**
   * Parse incoming webhook event
   */
  parseWebhookEvent(rawBody: Buffer): Promise<IncomingWhatsAppMessage>;
}

/**
 * WhatsApp template parameter
 */
export interface TemplateParameter {
  type: 'text' | 'image' | 'document';
  value?: string;
  url?: string;
}

/**
 * WhatsApp message template
 */
export interface MessageTemplate {
  templateId: string;
  name: string;
  category: 'marketing' | 'transactional' | 'informational';
  parameters?: Record<string, TemplateParameter>;
  language?: string;
}

/**
 * Session configuration for Baileys
 */
export interface BaileysSessionConfig {
  multiDevice?: boolean;
  syncFullHistory?: boolean;
  maxMissedCalls?: number;
  version?: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  messagesPerMinute?: number;
  messagesPerHour?: number;
  requestsPerSecond?: number;
}

/**
 * WhatsApp adapter initialization options
 */
export interface WhatsAppAdapterOptions {
  tenantId: string;
  provider: 'baileys' | 'official' | 'mock';
  config?: Record<string, any>;
  credentials?: Record<string, any>;
  rateLimiting?: RateLimitConfig;
  webhookSecret?: string;
  logger?: any;
}
