import { Booking, WhatsAppMessage } from '../models/index';
import { storage } from '../storage-mongodb';
import { buildMessage, type MessageType } from './templates';
import { normalizeIndianPhone } from './phone';
import { whatsappProvider } from './index';
import { getAndSubstituteTemplate, substituteVariables } from '../services/template-substitution-service';

export interface SendBookingMessageParams {
  tenantId: string;
  bookingId: string;
  messageType: MessageType;
  actor: { userId: string; role: string };
  force?: boolean;
}

export type SendBookingMessageResult =
  | { ok: true; messageDoc: any }
  | { ok: false; code: 'NOT_FOUND' | 'CANCELLED' | 'NO_DRIVER' | 'INVALID_PHONE' | 'TENANT_NOT_FOUND' | 'ALREADY_SENT' | 'SEND_FAILED'; message: string; messageDoc?: any; previousMessage?: any };

/**
 * Single implementation of "generate a booking message and send it,
 * respecting idempotency" — used by both the manual Send button in the
 * Booking Communication panel and the automatic post-booking-creation
 * trigger, so the duplicate-prevention and validation rules can't drift
 * between the two call sites.
 */
export async function sendBookingMessage(params: SendBookingMessageParams): Promise<SendBookingMessageResult> {
  const { tenantId, bookingId, messageType, actor, force } = params;

  const booking: any = await Booking.findOne({ _id: bookingId, tenantId })
    .populate('vehicleId')
    .populate('driverId');
  if (!booking) {
    return { ok: false, code: 'NOT_FOUND', message: 'Booking not found' };
  }
  if (['cancelled', 'no_show'].includes(booking.status)) {
    return { ok: false, code: 'CANCELLED', message: 'Cannot send messages for a cancelled booking.' };
  }
  if (messageType === 'driver_duty' && !booking.driverId) {
    return { ok: false, code: 'NO_DRIVER', message: 'Driver is not assigned to this booking yet.' };
  }

  const recipientType = messageType === 'driver_duty' ? 'driver' : 'customer';
  const rawPhone = messageType === 'driver_duty' ? booking.driverId?.phone : booking.customerPhone;
  const recipientPhone = normalizeIndianPhone(rawPhone);
  if (!recipientPhone) {
    return { ok: false, code: 'INVALID_PHONE', message: `Invalid ${recipientType} phone number: "${rawPhone || ''}"` };
  }

  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { ok: false, code: 'TENANT_NOT_FOUND', message: 'Tenant not found' };
  }

  const baseKey = `${tenantId}_${booking._id}_${messageType}_${recipientPhone}_v${booking.__v}`;

  if (!force) {
    const existing = await WhatsAppMessage.findOne({
      idempotencyKey: baseKey,
      status: { $in: ['queued', 'sent'] },
    });
    if (existing) {
      return {
        ok: false,
        code: 'ALREADY_SENT',
        message: 'This message was already sent for the current booking details. Send again?',
        previousMessage: { id: existing._id, status: existing.status, sentAt: existing.sentAt },
      };
    }
  }

  const idempotencyKey = force ? `${baseKey}_resend_${Date.now()}` : baseKey;

  // Check if payment collection is disabled
  const collectPayment = booking.collectPayment !== false;

  // If driver message and payment collection is disabled, send a different message
  if (messageType === 'driver_duty' && !collectPayment) {
    const noPaymentTemplate = `✅ *नो पेमेंट कलेक्शन | {{companyName}} Services*\n\nनमस्कार {{driverName}},\n\nयह बुकिंग {{bookingId}} के लिए आपको ग्राहक से कोई भुगतान नहीं लेना है।\n\nकृपया सामान्य तरीके से ड्यूटी पूरी करें।\n\n📞 किसी भी समस्या में ऑफिस से संपर्क करें: {{supportPhone}}`;
    const noPaymentMessage = substituteVariables(noPaymentTemplate, { booking, tenant });

    let messageDoc;
    try {
      messageDoc = await WhatsAppMessage.create({
        tenantId,
        bookingId: booking._id,
        recipientType: 'driver',
        recipientPhone,
        messageType: 'driver_no_payment_collection',
        content: noPaymentMessage,
        provider: whatsappProvider.kind,
        status: 'queued',
        attemptCount: 0,
        createdBy: actor,
        idempotencyKey,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        return { ok: false, code: 'ALREADY_SENT', message: 'This message was already sent' };
      }
      throw error;
    }

    const result = await whatsappProvider.sendText(tenantId, recipientPhone, noPaymentMessage);
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

  // Try to use custom template from database first
  const templateType = messageType === 'driver_duty' ? 'driver' : 'customer';
  const { body: content, found: templateFound } = await getAndSubstituteTemplate(
    tenantId,
    templateType,
    messageType,
    { booking, tenant },
    messageType === 'driver_duty' ? 'driver' : 'customer'
  );

  console.log(`[SEND_MSG] messageType=${messageType}, templateFound=${templateFound}, contentLen=${content?.length || 0}`);
  console.log(`[SEND_MSG] booking.driverId:`, booking.driverId ? `{ id: ${booking.driverId._id}, name: ${booking.driverId.name} }` : 'null');
  console.log(`[SEND_MSG] booking.bookingId=${booking.bookingId}`);
  console.log(`[SEND_MSG] booking.customerName=${booking.customerName}`);
  console.log(`[SEND_MSG] tenant.businessName=${tenant?.businessName}`);

  // If no template found in database, use hardcoded fallback with variable substitution
  let finalContent = content;
  if (!content) {
    const fallbackTemplate = buildMessage(messageType, booking, tenant);
    console.log(`[SEND_MSG] Using fallback template, before subst length=${fallbackTemplate.length}`);
    finalContent = substituteVariables(fallbackTemplate, { booking, tenant });
    console.log(`[SEND_MSG] After subst length=${finalContent.length}`);
  }

  if (!finalContent) {
    return { ok: false, code: 'SEND_FAILED', message: 'No template available for this message type' };
  }

  let messageDoc;
  try {
    messageDoc = await WhatsAppMessage.create({
      tenantId,
      bookingId: booking._id,
      recipientType,
      recipientPhone,
      messageType,
      content: finalContent,
      provider: whatsappProvider.kind,
      status: 'queued',
      attemptCount: 0,
      createdBy: actor,
      idempotencyKey,
      templateFound,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return { ok: false, code: 'ALREADY_SENT', message: 'This message was already sent for the current booking details. Send again?' };
    }
    throw error;
  }

  const result = await whatsappProvider.sendText(tenantId, recipientPhone, finalContent);
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
