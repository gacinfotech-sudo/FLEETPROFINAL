/**
 * Baileys WhatsApp Adapter
 * Extends BaseProviderAdapter for unofficial QR-based WhatsApp integration
 * Uses @whiskeysockets/baileys for QR-based session management
 */

import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import crypto from 'crypto';
import { BaseProviderAdapter } from '../../adapters/BaseProviderAdapter';
import { AdapterRequest, AdapterResponse } from '../../types';
import {
  IWhatsAppProvider,
  WhatsAppSessionStatus,
  MessageSendResult,
  SessionStatusResponse,
  IncomingWhatsAppMessage,
  DocumentSendOptions,
  MediaSendOptions,
  BaileysSessionConfig,
  WhatsAppAdapterOptions,
  MessageDeliveryStatus,
} from './types';

interface TenantSession {
  sock: ReturnType<typeof makeWASocket> | null;
  status: WhatsAppSessionStatus;
  qrDataUrl?: string;
  phoneNumber?: string;
  connectedAt?: Date;
  lastActivity?: Date;
  starting: boolean;
  messageQueue: Map<string, MessageQueueItem>;
}

interface MessageQueueItem {
  phone: string;
  text: string;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

/**
 * Baileys WhatsApp Adapter
 * Provides WhatsApp integration using unofficial QR-based approach
 */
export class BaileysAdapter extends BaseProviderAdapter implements IWhatsAppProvider {
  readonly providerKey = 'baileys';
  private sessions = new Map<string, TenantSession>();
  private incomingHandlers: ((msg: IncomingWhatsAppMessage) => void)[] = [];
  private deliveryHandlers: ((status: MessageDeliveryStatus) => void)[] = [];
  private sessionsDir: string;
  private messageRetryInterval: NodeJS.Timer | null = null;

  constructor(options: any) {
    super(options);
    this.sessionsDir = path.join(process.cwd(), 'whatsapp-sessions');
    this.setupMessageRetryInterval();
  }

  /**
   * Get provider ID
   */
  getProviderId(): string {
    return this.providerKey;
  }

  /**
   * Execute adapter action
   */
  async executeAction(request: AdapterRequest): Promise<AdapterResponse> {
    this.logAction(request.action, 'start', { tenantId: request.tenantId });

    try {
      switch (request.action) {
        case 'send_text':
          return this.buildResponse(true, await this.sendText(
            request.tenantId,
            request.data.phone,
            request.data.text,
          ));

        case 'send_document':
          return this.buildResponse(true, await this.sendDocument(
            request.tenantId,
            request.data.phone,
            Buffer.from(request.data.document, 'base64'),
            request.data.options,
          ));

        case 'send_media':
          return this.buildResponse(true, await this.sendMedia(
            request.tenantId,
            request.data.phone,
            request.data.media,
          ));

        case 'start_session':
          return this.buildResponse(true, await this.startSession(request.tenantId));

        case 'get_status':
          return this.buildResponse(true, await this.getStatus(request.tenantId));

        case 'logout_session':
          await this.logoutSession(request.tenantId);
          return this.buildResponse(true, { status: 'disconnected' });

        default:
          return this.buildResponse(false, undefined, {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${request.action}`,
          });
      }
    } catch (error: any) {
      this.logAction(request.action, 'error', { error: error.message });
      return this.buildResponse(false, undefined, {
        code: 'ADAPTER_ERROR',
        message: error.message,
      });
    }
  }

  /**
   * Start a WhatsApp session for a tenant
   */
  async startSession(tenantId: string): Promise<SessionStatusResponse> {
    const session = this.getOrCreateSession(tenantId);

    if (session.status === 'connected') {
      return this.formatSessionResponse(session);
    }

    if (session.starting) {
      return this.formatSessionResponse(session);
    }

    session.starting = true;

    try {
      const authDir = this.getAuthDir(tenantId);
      fs.mkdirSync(authDir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['FleetPro', 'Chrome', '120'],
        syncFullHistory: false,
        maxMissedCalls: 5,
      });

      session.sock = sock;
      session.status = 'disconnected';

      // Handle credentials update
      sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        this.handleConnectionUpdate(tenantId, session, update);
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', ({ messages, type }) => {
        this.handleIncomingMessages(tenantId, messages, type);
      });

      // Handle message status updates
      sock.ev.on('message.update', (updates) => {
        this.handleMessageStatusUpdates(tenantId, updates);
      });

      // Wait for initial connection
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.logAction('startSession', 'success', {
        tenantId,
        status: session.status,
      });
    } catch (error: any) {
      session.status = 'error';
      this.logger.error('Session start failed', error, { tenantId });
    } finally {
      session.starting = false;
    }

    return this.formatSessionResponse(session);
  }

  /**
   * Get current session status
   */
  async getStatus(tenantId: string): Promise<SessionStatusResponse> {
    const session = this.sessions.get(tenantId);
    if (!session) {
      return { status: 'disconnected' };
    }
    return this.formatSessionResponse(session);
  }

  /**
   * Logout a session
   */
  async logoutSession(tenantId: string): Promise<void> {
    const session = this.sessions.get(tenantId);
    if (session?.sock) {
      try {
        await session.sock.logout();
      } catch {
        // Already logged out
      }
    }
    const authDir = this.getAuthDir(tenantId);
    fs.rmSync(authDir, { recursive: true, force: true });
    this.sessions.delete(tenantId);
    this.logAction('logoutSession', 'success', { tenantId });
  }

  /**
   * Send text message
   */
  async sendText(tenantId: string, phone: string, text: string): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);

    if (!session || session.status !== 'connected' || !session.sock) {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'WhatsApp session not connected',
      };
    }

    this.checkRateLimit(`whatsapp:${tenantId}`);

    try {
      const jid = this.formatJID(phone);
      const result = await session.sock.sendMessage(jid, { text });
      session.lastActivity = new Date();

      return {
        providerMessageId: result?.key?.id || null,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error('Message send failed', error, { tenantId, phone });
      return {
        providerMessageId: null,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send document
   */
  async sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    opts: DocumentSendOptions,
  ): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);

    if (!session || session.status !== 'connected' || !session.sock) {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'WhatsApp session not connected',
      };
    }

    this.checkRateLimit(`whatsapp:${tenantId}`);

    try {
      const jid = this.formatJID(phone);
      const result = await session.sock.sendMessage(jid, {
        document,
        mimetype: opts.mimetype,
        fileName: opts.fileName,
        caption: opts.caption,
      });
      session.lastActivity = new Date();

      return {
        providerMessageId: result?.key?.id || null,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error('Document send failed', error, { tenantId, phone });
      return {
        providerMessageId: null,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send media (image, audio, video)
   */
  async sendMedia(
    tenantId: string,
    phone: string,
    media: MediaSendOptions,
  ): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);

    if (!session || session.status !== 'connected' || !session.sock) {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'WhatsApp session not connected',
      };
    }

    this.checkRateLimit(`whatsapp:${tenantId}`);

    try {
      const jid = this.formatJID(phone);
      const messageContent: any = {};

      if (media.buffer) {
        messageContent[media.type] = media.buffer;
      } else if (media.url) {
        messageContent[`${media.type}Message`] = { url: media.url };
      }

      messageContent.mimetype = media.mimeType;
      if (media.caption) {
        messageContent.caption = media.caption;
      }

      const result = await session.sock.sendMessage(jid, messageContent);
      session.lastActivity = new Date();

      return {
        providerMessageId: result?.key?.id || null,
        status: 'sent',
        sentAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error('Media send failed', error, { tenantId, phone });
      return {
        providerMessageId: null,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Register incoming message handler
   */
  onIncoming(handler: (msg: IncomingWhatsAppMessage) => void): void {
    this.incomingHandlers.push(handler);
  }

  /**
   * Register delivery status handler
   */
  onDeliveryStatus(handler: (status: MessageDeliveryStatus) => void): void {
    this.deliveryHandlers.push(handler);
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean> {
    try {
      const signature = headers['x-webhook-signature'];
      if (!signature) return false;

      const secret = this.config.webhookSecret;
      if (!secret) return false;

      return this.verifyWebhookSignature(
        rawBody.toString('utf-8'),
        signature,
        secret,
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse webhook event
   */
  async parseWebhookEvent(rawBody: Buffer): Promise<IncomingWhatsAppMessage> {
    const data = JSON.parse(rawBody.toString('utf-8'));

    return {
      tenantId: data.tenantId,
      fromPhone: data.from,
      text: data.text || '',
      providerMessageId: data.messageId,
      receivedAt: new Date(data.timestamp),
      media: data.media,
      isFromBusiness: data.isFromBusiness || false,
    };
  }

  /**
   * Private helper methods
   */

  private getOrCreateSession(tenantId: string): TenantSession {
    let session = this.sessions.get(tenantId);
    if (!session) {
      session = {
        sock: null,
        status: 'disconnected',
        starting: false,
        messageQueue: new Map(),
      };
      this.sessions.set(tenantId, session);
    }
    return session;
  }

  private getAuthDir(tenantId: string): string {
    return path.join(this.sessionsDir, tenantId);
  }

  private formatJID(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new Error('Invalid phone number');
    }
    return `${digits}@s.whatsapp.net`;
  }

  private formatSessionResponse(session: TenantSession): SessionStatusResponse {
    return {
      status: session.status,
      qrDataUrl: session.qrDataUrl,
      phoneNumber: session.phoneNumber,
      connectedAt: session.connectedAt,
      lastActivity: session.lastActivity,
    };
  }

  private async handleConnectionUpdate(tenantId: string, session: TenantSession, update: any) {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      session.qrDataUrl = await QRCode.toDataURL(qr);
      session.status = 'qr_pending';
    }

    if (connection === 'open') {
      session.status = 'connected';
      session.qrDataUrl = undefined;
      session.connectedAt = new Date();
      this.retryFailedMessages(tenantId);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        session.status = 'logged_out';
        const authDir = this.getAuthDir(tenantId);
        fs.rmSync(authDir, { recursive: true, force: true });
      } else {
        session.status = 'disconnected';
      }
    }
  }

  private handleIncomingMessages(tenantId: string, messages: any[], type: string) {
    if (type !== 'notify') return;

    for (const m of messages) {
      if (m.key.fromMe) continue;

      const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
      if (!text) continue;

      const fromPhone = (m.key.remoteJid || '').split('@')[0];
      const msg: IncomingWhatsAppMessage = {
        tenantId,
        fromPhone,
        text,
        providerMessageId: m.key.id || '',
        receivedAt: new Date((m.messageTimestamp as number || Date.now() / 1000) * 1000),
      };

      for (const handler of this.incomingHandlers) {
        try {
          handler(msg);
        } catch (error) {
          this.logger.error('Incoming message handler error', error);
        }
      }
    }
  }

  private handleMessageStatusUpdates(tenantId: string, updates: any) {
    for (const [, update] of Object.entries(updates)) {
      const u = update as any;
      const status = u.status || u.receipt?.type;

      if (!status) continue;

      const deliveryStatus: MessageDeliveryStatus = {
        messageId: u.key?.id || '',
        status: status === 2 ? 'delivered' : status === 3 ? 'read' : 'sent',
      };

      for (const handler of this.deliveryHandlers) {
        try {
          handler(deliveryStatus);
        } catch (error) {
          this.logger.error('Delivery status handler error', error);
        }
      }
    }
  }

  private async retryFailedMessages(tenantId: string) {
    const session = this.sessions.get(tenantId);
    if (!session) return;

    const failedItems = Array.from(session.messageQueue.values()).filter(
      item => item.retries < item.maxRetries,
    );

    for (const item of failedItems) {
      try {
        const result = await this.sendText(tenantId, item.phone, item.text);
        if (result.status === 'sent') {
          session.messageQueue.delete(item.phone);
        } else {
          item.retries++;
        }
      } catch (error) {
        item.retries++;
      }
    }
  }

  private setupMessageRetryInterval() {
    this.messageRetryInterval = setInterval(() => {
      for (const tenantId of this.sessions.keys()) {
        this.retryFailedMessages(tenantId).catch((error) => {
          this.logger.error('Message retry error', error, { tenantId });
        });
      }
    }, 60000); // Retry every minute
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    if (this.messageRetryInterval) {
      clearInterval(this.messageRetryInterval);
    }

    for (const tenantId of this.sessions.keys()) {
      try {
        await this.logoutSession(tenantId);
      } catch (error) {
        this.logger.error('Cleanup error', error, { tenantId });
      }
    }
  }
}

export default BaileysAdapter;
