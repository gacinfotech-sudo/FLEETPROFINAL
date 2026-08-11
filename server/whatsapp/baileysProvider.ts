import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import type { WhatsAppProvider, SessionStatus, SendResult, IncomingMessage } from './types';
import { WhatsAppMessage } from '../models/index';

// Each tenant scans their own WhatsApp — this is the "unofficial" QR-web
// route (whatsapp-web.js/Baileys style), NOT the official Business Cloud
// API. Real risk: WhatsApp does not sanction this, and a linked number
// can be banned. Persisted per tenant under SESSIONS_DIR so a server
// restart doesn't force a re-scan ("web login save rahe").
const SESSIONS_DIR = path.join(process.cwd(), 'whatsapp-sessions');

interface TenantSession {
  sock: ReturnType<typeof makeWASocket> | null;
  status: SessionStatus;
  qrDataUrl?: string;
  starting: boolean;
}

export class BaileysProvider implements WhatsAppProvider {
  readonly kind = 'baileys';
  private sessions = new Map<string, TenantSession>();
  private handlers: ((msg: IncomingMessage) => void)[] = [];

  private authDir(tenantId: string) {
    return path.join(SESSIONS_DIR, tenantId);
  }

  private getOrCreate(tenantId: string): TenantSession {
    let s = this.sessions.get(tenantId);
    if (!s) {
      s = { sock: null, status: 'disconnected', starting: false };
      this.sessions.set(tenantId, s);
    }
    return s;
  }

  async startSession(tenantId: string): Promise<{ status: SessionStatus; qrDataUrl?: string }> {
    const session = this.getOrCreate(tenantId);

    if (session.status === 'connected') {
      return { status: 'connected' };
    }
    if (session.starting) {
      return { status: session.status, qrDataUrl: session.qrDataUrl };
    }

    session.starting = true;
    try {
      fs.mkdirSync(this.authDir(tenantId), { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir(tenantId));
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
      });

      session.sock = sock;
      session.status = 'disconnected';

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
          session.qrDataUrl = await QRCode.toDataURL(qr);
          session.status = 'qr_pending';
        }

        if (connection === 'open') {
          session.status = 'connected';
          session.qrDataUrl = undefined;
          // A booking created in the few seconds between server start and
          // the socket actually reaching "open" fires its confirmation
          // send immediately and gets a permanent 'failed' status with no
          // retry — the message is just lost until a staff member notices
          // and manually resends from the Booking Communication panel.
          // Sweep those up now that the session is genuinely usable.
          this.retryFailedMessages(tenantId).catch((err) => {
            console.error('WhatsApp retry-failed-messages error:', err?.message || err);
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            session.status = 'logged_out';
            session.qrDataUrl = undefined;
            fs.rmSync(this.authDir(tenantId), { recursive: true, force: true });
          } else {
            // Transient disconnect (network blip, server restart on
            // WhatsApp's side). Don't loop-reconnect automatically here —
            // that class of bug ("infinite retries") is exactly what the
            // spec calls out. Staff can call startSession again from the
            // UI, which is a deliberate, visible retry, not a silent loop.
            session.status = 'disconnected';
          }
        }
      });

      sock.ev.on('messages.upsert', ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
          if (m.key.fromMe) continue;
          const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
          if (!text) continue;
          const fromPhone = (m.key.remoteJid || '').split('@')[0];
          for (const handler of this.handlers) {
            handler({
              tenantId,
              fromPhone,
              text,
              providerMessageId: m.key.id || '',
              receivedAt: new Date(((m.messageTimestamp as number) || Date.now() / 1000) * 1000),
            });
          }
        }
      });

      // Give the socket a moment to either connect from saved creds or
      // produce a QR, so the first API response already has something
      // useful instead of always requiring a follow-up poll.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } finally {
      session.starting = false;
    }

    return { status: session.status, qrDataUrl: session.qrDataUrl };
  }

  async getStatus(tenantId: string): Promise<{ status: SessionStatus; qrDataUrl?: string }> {
    const session = this.sessions.get(tenantId);
    if (!session) return { status: 'disconnected' };
    return { status: session.status, qrDataUrl: session.qrDataUrl };
  }

  async logoutSession(tenantId: string): Promise<void> {
    const session = this.sessions.get(tenantId);
    if (session?.sock) {
      try { await session.sock.logout(); } catch { /* already gone */ }
    }
    fs.rmSync(this.authDir(tenantId), { recursive: true, force: true });
    this.sessions.delete(tenantId);
  }

  async sendText(tenantId: string, phone: string, text: string): Promise<SendResult> {
    const session = this.sessions.get(tenantId);
    if (!session || session.status !== 'connected' || !session.sock) {
      return { providerMessageId: null, status: 'failed', error: 'WhatsApp session not connected for this tenant' };
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return { providerMessageId: null, status: 'failed', error: 'Invalid phone number' };
    }
    const jid = `${digits}@s.whatsapp.net`;
    try {
      const result = await session.sock.sendMessage(jid, { text });
      return { providerMessageId: result?.key?.id || null, status: 'sent' };
    } catch (err: any) {
      return { providerMessageId: null, status: 'failed', error: err?.message || 'send failed' };
    }
  }

  async sendDocument(tenantId: string, phone: string, document: Buffer, opts: { fileName: string; mimetype: string; caption?: string }): Promise<SendResult> {
    const session = this.sessions.get(tenantId);
    if (!session || session.status !== 'connected' || !session.sock) {
      return { providerMessageId: null, status: 'failed', error: 'WhatsApp session not connected for this tenant' };
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return { providerMessageId: null, status: 'failed', error: 'Invalid phone number' };
    }
    const jid = `${digits}@s.whatsapp.net`;
    try {
      const result = await session.sock.sendMessage(jid, {
        document, mimetype: opts.mimetype, fileName: opts.fileName, caption: opts.caption,
      });
      return { providerMessageId: result?.key?.id || null, status: 'sent' };
    } catch (err: any) {
      return { providerMessageId: null, status: 'failed', error: err?.message || 'send failed' };
    }
  }

  onIncoming(handler: (msg: IncomingMessage) => void): void {
    this.handlers.push(handler);
  }

  // Only retries messages that failed specifically because the socket
  // wasn't ready yet — not messages that failed for a real reason (bad
  // phone number, WhatsApp-side rejection), which retrying forever
  // wouldn't fix and would just look like a silent duplicate-send risk.
  private async retryFailedMessages(tenantId: string): Promise<void> {
    const failed = await WhatsAppMessage.find({
      tenantId,
      status: 'failed',
      error: 'WhatsApp session not connected for this tenant',
    }).limit(50);

    for (const msg of failed) {
      const result = await this.sendText(tenantId, msg.recipientPhone, msg.content);
      msg.attemptCount = (msg.attemptCount || 0) + 1;
      msg.status = result.status === 'sent' ? 'sent' : 'failed';
      msg.providerMessageId = result.providerMessageId || undefined;
      msg.error = result.error || undefined;
      if (result.status === 'sent') msg.sentAt = new Date();
      await msg.save();
    }
  }
}
