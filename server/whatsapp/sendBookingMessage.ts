import { Booking, WhatsAppMessage } from '../models/index';
import { storage } from '../storage-mongodb';
import { buildMessage, type MessageType } from './templates';
import { normalizeIndianPhone } from './phone';
import { whatsappProvider } from './index';

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
  const content = buildMessage(messageType, booking, tenant);

  let messageDoc;
  try {
    messageDoc = await WhatsAppMessage.create({
      tenantId,
      bookingId: booking._id,
      recipientType,
      recipientPhone,
      messageType,
      content,
      provider: whatsappProvider.kind,
      status: 'queued',
      attemptCount: 0,
      createdBy: actor,
      idempotencyKey,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return { ok: false, code: 'ALREADY_SENT', message: 'This message was already sent for the current booking details. Send again?' };
    }
    throw error;
  }

  const result = await whatsappProvider.sendText(tenantId, recipientPhone, content);
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
