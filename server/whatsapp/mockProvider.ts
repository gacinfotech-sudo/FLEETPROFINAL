import { WhatsAppProvider, SessionStatus, SendResult, IncomingMessage } from './types';

// No-op provider used in tests and for tenants that haven't linked
// WhatsApp yet. Never touches the network — logs instead of sending.
export class MockProvider implements WhatsAppProvider {
  readonly kind = 'mock';
  private handlers: ((msg: IncomingMessage) => void)[] = [];

  async startSession(tenantId: string) {
    return { status: 'connected' as SessionStatus };
  }

  async getStatus(tenantId: string) {
    return { status: 'connected' as SessionStatus };
  }

  async logoutSession(tenantId: string): Promise<void> {}

  async sendText(tenantId: string, phone: string, text: string): Promise<SendResult> {
    console.log(`[whatsapp:mock] tenant=${tenantId} -> ${phone}: ${text}`);
    return { providerMessageId: `mock_${Date.now()}`, status: 'sent' };
  }

  onIncoming(handler: (msg: IncomingMessage) => void): void {
    this.handlers.push(handler);
  }
}
