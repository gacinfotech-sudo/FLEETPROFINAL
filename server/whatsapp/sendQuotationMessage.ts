import { Quotation, Lead, Inquiry, WhatsAppMessage } from '../models/index';
import { storage } from '../storage-mongodb';
import { buildQuotationMessage } from './quotationTemplates';
import { normalizeIndianPhone } from './phone';
import { whatsappProvider } from './index';

export type SendQuotationMessageResult =
  | { ok: true; messageDoc: any }
  | { ok: false; code: 'NOT_FOUND' | 'INVALID_PHONE' | 'TENANT_NOT_FOUND' | 'ALREADY_SENT' | 'SEND_FAILED'; message: string; messageDoc?: any };

// Mirrors sendBookingMessage.ts's structure and idempotency pattern
// exactly. Text-only by default (the message includes the full option
// breakdown, so it's genuinely useful standalone). Pass `pdf` to instead
// send the actual Quotation PDF as a document, with this same text as its
// caption — WhatsAppProvider.sendDocument() (BaileysProvider/MockProvider)
// closes the gap explicitly deferred when this file was first built (see
// docs/INQUIRY_LEAD_EXISTING_AUDIT.md §10). Text-send and PDF-send are
// independently idempotent (distinct messageType/idempotencyKey) — sending
// one doesn't block later sending the other for the same quotation version.
export async function sendQuotationMessage(params: {
  tenantId: string; quotationId: string; actor: { userId: string; role: string }; force?: boolean;
  pdf?: { buffer: Buffer; fileName: string };
}): Promise<SendQuotationMessageResult> {
  const { tenantId, quotationId, actor, force, pdf } = params;

  const quotation: any = await Quotation.findOne({ _id: quotationId, tenantId });
  if (!quotation) return { ok: false, code: 'NOT_FOUND', message: 'Quotation not found' };

  const lead: any = await Lead.findOne({ _id: quotation.leadId, tenantId });
  if (!lead) return { ok: false, code: 'NOT_FOUND', message: 'Linked lead not found' };

  const inquiry: any = await Inquiry.findOne({ _id: lead.inquiryId, tenantId });
  if (!inquiry) return { ok: false, code: 'NOT_FOUND', message: 'Linked inquiry not found' };

  const recipientPhone = normalizeIndianPhone(inquiry.whatsappNumber || inquiry.primaryMobile);
  if (!recipientPhone) {
    return { ok: false, code: 'INVALID_PHONE', message: `Invalid customer phone number: "${inquiry.primaryMobile || ''}"` };
  }

  const tenant = await storage.getTenant(tenantId);
  if (!tenant) return { ok: false, code: 'TENANT_NOT_FOUND', message: 'Tenant not found' };

  const messageType = pdf ? 'quotation_share_pdf' : 'quotation_share';
  const baseKey = `${tenantId}_${quotation._id}_${messageType}_${recipientPhone}_v${quotation.version}`;
  if (!force) {
    const existing = await WhatsAppMessage.findOne({ idempotencyKey: baseKey, status: { $in: ['queued', 'sent'] } });
    if (existing) {
      return { ok: false, code: 'ALREADY_SENT', message: 'This quotation version was already sent to this number. Send again?' };
    }
  }
  const idempotencyKey = force ? `${baseKey}_resend_${Date.now()}` : baseKey;

  const content = buildQuotationMessage(quotation, inquiry, tenant);

  let messageDoc;
  try {
    messageDoc = await WhatsAppMessage.create({
      tenantId, leadId: lead._id, quotationId: quotation._id,
      recipientType: 'customer', recipientPhone, messageType, content,
      provider: whatsappProvider.kind, status: 'queued', attemptCount: 0, createdBy: actor, idempotencyKey,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return { ok: false, code: 'ALREADY_SENT', message: 'This quotation version was already sent to this number.' };
    }
    throw error;
  }

  const result = pdf
    ? await whatsappProvider.sendDocument(tenantId, recipientPhone, pdf.buffer, { fileName: pdf.fileName, mimetype: 'application/pdf', caption: content })
    : await whatsappProvider.sendText(tenantId, recipientPhone, content);
  messageDoc.attemptCount = 1;
  messageDoc.status = result.status === 'sent' ? 'sent' : 'failed';
  messageDoc.providerMessageId = result.providerMessageId || undefined;
  messageDoc.error = result.error || undefined;
  if (result.status === 'sent') messageDoc.sentAt = new Date();
  await messageDoc.save();

  if (result.status !== 'sent') {
    return { ok: false, code: 'SEND_FAILED', message: result.error || 'Failed to send WhatsApp message', messageDoc };
  }
  return { ok: true, messageDoc };
}
