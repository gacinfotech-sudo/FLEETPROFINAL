/**
 * Mock WhatsApp Adapter
 * No-op provider for testing and tenants without WhatsApp linked
 * Never touches network — logs instead of sending
 */

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
  MessageDeliveryStatus,
} from './types';

/**
 * Mock WhatsApp Adapter for testing
 */
export class MockWhatsAppAdapter extends BaseProviderAdapter implements IWhatsAppProvider {
  readonly providerKey = 'mock';
  private incomingHandlers: ((msg: IncomingWhatsAppMessage) => void)[] = [];
  private deliveryHandlers: ((status: MessageDeliveryStatus) => void)[] = [];
  private sessions = new Map<string, { status: WhatsAppSessionStatus; phoneNumber?: string }>();

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
   * Start a mock WhatsApp session
   */
  async startSession(tenantId: string): Promise<SessionStatusResponse> {
    this.sessions.set(tenantId, {
      status: 'connected',
      phoneNumber: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    });

    this.logger.info('[whatsapp:mock] Session started', { tenantId });

    return {
      status: 'connected',
      phoneNumber: this.sessions.get(tenantId)?.phoneNumber,
      connectedAt: new Date(),
    };
  }

  /**
   * Get mock session status
   */
  async getStatus(tenantId: string): Promise<SessionStatusResponse> {
    const session = this.sessions.get(tenantId);
    if (!session) {
      return { status: 'disconnected' };
    }
    return {
      status: session.status,
      phoneNumber: session.phoneNumber,
    };
  }

  /**
   * Logout mock session
   */
  async logoutSession(tenantId: string): Promise<void> {
    this.sessions.delete(tenantId);
    this.logger.info('[whatsapp:mock] Session logged out', { tenantId });
  }

  /**
   * Send mock text message
   */
  async sendText(tenantId: string, phone: string, text: string): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);
    if (!session || session.status !== 'connected') {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'Session not connected',
      };
    }

    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.info('[whatsapp:mock] Text message', {
      tenantId,
      to: phone,
      text: text.substring(0, 100),
      messageId,
    });

    // Simulate delivery status callback
    setTimeout(() => {
      this.handleDeliveryStatus(messageId, 'delivered');
    }, 1000);

    return {
      providerMessageId: messageId,
      status: 'sent',
      sentAt: new Date(),
    };
  }

  /**
   * Send mock document
   */
  async sendDocument(
    tenantId: string,
    phone: string,
    document: Buffer,
    opts: DocumentSendOptions,
  ): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);
    if (!session || session.status !== 'connected') {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'Session not connected',
      };
    }

    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.logger.info('[whatsapp:mock] Document sent', {
      tenantId,
      to: phone,
      fileName: opts.fileName,
      size: document.length,
      caption: opts.caption?.substring(0, 50),
      messageId,
    });

    setTimeout(() => {
      this.handleDeliveryStatus(messageId, 'delivered');
    }, 1000);

    return {
      providerMessageId: messageId,
      status: 'sent',
      sentAt: new Date(),
    };
  }

  /**
   * Send mock media
   */
  async sendMedia(
    tenantId: string,
    phone: string,
    media: MediaSendOptions,
  ): Promise<MessageSendResult> {
    const session = this.sessions.get(tenantId);
    if (!session || session.status !== 'connected') {
      return {
        providerMessageId: null,
        status: 'failed',
        error: 'Session not connected',
      };
    }

    const messageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const size = media.buffer ? media.buffer.length : 0;

    this.logger.info('[whatsapp:mock] Media sent', {
      tenantId,
      to: phone,
      type: media.type,
      size,
      caption: media.caption?.substring(0, 50),
      messageId,
    });

    setTimeout(() => {
      this.handleDeliveryStatus(messageId, 'delivered');
    }, 1000);

    return {
      providerMessageId: messageId,
      status: 'sent',
      sentAt: new Date(),
    };
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
   * Verify webhook signature (mock always returns true)
   */
  async verifyWebhookSignature(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean> {
    return true;
  }

  /**
   * Parse webhook event (mock)
   */
  async parseWebhookEvent(rawBody: Buffer): Promise<IncomingWhatsAppMessage> {
    const data = JSON.parse(rawBody.toString('utf-8'));
    return {
      tenantId: data.tenantId,
      fromPhone: data.from,
      text: data.text || '',
      providerMessageId: data.messageId,
      receivedAt: new Date(data.timestamp),
    };
  }

  /**
   * Simulate incoming message (for testing)
   */
  simulateIncomingMessage(tenantId: string, from: string, text: string): void {
    const msg: IncomingWhatsAppMessage = {
      tenantId,
      fromPhone: from,
      text,
      providerMessageId: `mock_${Date.now()}`,
      receivedAt: new Date(),
    };

    for (const handler of this.incomingHandlers) {
      try {
        handler(msg);
      } catch (error) {
        this.logger.error('Mock incoming handler error', error);
      }
    }

    this.logger.info('[whatsapp:mock] Simulated incoming message', { tenantId, from, text });
  }

  /**
   * Simulate delivery status (for testing)
   */
  simulateDeliveryStatus(messageId: string, status: 'sent' | 'delivered' | 'read'): void {
    this.handleDeliveryStatus(messageId, status);
  }

  /**
   * Private helper
   */
  private handleDeliveryStatus(messageId: string, status: 'sent' | 'delivered' | 'read') {
    const deliveryStatus: MessageDeliveryStatus = {
      messageId,
      status,
      deliveredAt: status !== 'sent' ? new Date() : undefined,
      readAt: status === 'read' ? new Date() : undefined,
    };

    for (const handler of this.deliveryHandlers) {
      try {
        handler(deliveryStatus);
      } catch (error) {
        this.logger.error('Mock delivery handler error', error);
      }
    }
  }
}

export default MockWhatsAppAdapter;
