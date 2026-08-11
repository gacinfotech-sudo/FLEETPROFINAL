// Provider-agnostic WhatsApp interface. Anything that talks to WhatsApp
// (an unofficial QR-session library today, the official Business Cloud
// API later) implements this so the rest of the app — routes, the
// message queue, templates — never depends on which one is active.

export type SessionStatus = 'disconnected' | 'qr_pending' | 'connected' | 'logged_out';

export interface SendResult {
  providerMessageId: string | null;
  status: 'sent' | 'failed';
  error?: string;
}

export interface IncomingMessage {
  tenantId: string;
  fromPhone: string;
  text: string;
  providerMessageId: string;
  receivedAt: Date;
}

export interface WhatsAppProvider {
  readonly kind: string;

  /** Begin (or resume) a session for this tenant. Idempotent — calling it
   * again while already connected/pending just returns current status. */
  startSession(tenantId: string): Promise<{ status: SessionStatus; qrDataUrl?: string }>;

  getStatus(tenantId: string): Promise<{ status: SessionStatus; qrDataUrl?: string }>;

  logoutSession(tenantId: string): Promise<void>;

  sendText(tenantId: string, phone: string, text: string): Promise<SendResult>;

  /** Sends a document (e.g. a quotation PDF) as its own WhatsApp message,
   * with an optional caption. */
  sendDocument(tenantId: string, phone: string, document: Buffer, opts: { fileName: string; mimetype: string; caption?: string }): Promise<SendResult>;

  onIncoming(handler: (msg: IncomingMessage) => void): void;
}
