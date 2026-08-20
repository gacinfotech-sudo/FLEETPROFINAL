/**
 * CUSTOMER UPDATE NOTIFICATIONS SERVICE
 * Send WhatsApp notifications when booking details change
 * - Driver change
 * - Vehicle change
 * - Booking details update
 * - Generic updates
 */

import { Booking, Driver, WhatsAppMessage } from '../models/index';
import { whatsappProvider } from '../whatsapp/index';
import { normalizeIndianPhone } from '../whatsapp/phone';
import mongoose from 'mongoose';

export interface UpdateNotificationParams {
  tenantId: string;
  bookingId: string;
  updateType: 'driver_change' | 'vehicle_change' | 'booking_update' | 'custom';
  newDetails?: {
    driverName?: string;
    driverPhone?: string;
    vehicleName?: string;
    vehicleNumber?: string;
    customMessage?: string;
  };
}

export interface SendUpdateResult {
  success: boolean;
  messageId?: string;
  error?: string;
  message?: string;
}

export async function sendCustomerUpdateNotification(
  params: UpdateNotificationParams
): Promise<SendUpdateResult> {
  try {
    const { tenantId, bookingId, updateType, newDetails } = params;

    console.log(`[UPDATE] Sending ${updateType} notification for booking ${bookingId}`);

    // Fetch booking
    const booking = await Booking.findOne({ _id: bookingId, tenantId })
      .populate('driverId', 'name phone')
      .populate('vehicleId')
      .lean();

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Get customer phone
    const customerPhone = normalizeIndianPhone(booking.customerPhone);
    if (!customerPhone) {
      return { success: false, error: `Invalid customer phone: ${booking.customerPhone}` };
    }

    // Build notification message based on update type
    let messageContent = '';

    if (updateType === 'driver_change' && newDetails?.driverName) {
      messageContent = buildDriverChangeMessage(booking, newDetails);
    } else if (updateType === 'vehicle_change' && newDetails?.vehicleName) {
      messageContent = buildVehicleChangeMessage(booking, newDetails);
    } else if (updateType === 'booking_update') {
      messageContent = buildBookingUpdateMessage(booking, newDetails);
    } else if (updateType === 'custom' && newDetails?.customMessage) {
      messageContent = buildCustomMessage(booking, newDetails.customMessage);
    } else {
      return { success: false, error: 'Invalid update type or missing details' };
    }

    if (!messageContent) {
      return { success: false, error: 'Failed to build message content' };
    }

    console.log(`[UPDATE] Message built (${messageContent.length} chars)`);

    // Save message log
    let messageDoc;
    try {
      messageDoc = await WhatsAppMessage.create({
        tenantId,
        bookingId: booking._id,
        recipientType: 'customer',
        recipientPhone: customerPhone,
        messageType: `update_${updateType}`,
        content: messageContent,
        provider: whatsappProvider.kind,
        status: 'queued',
        attemptCount: 0,
        createdBy: { userId: 'system', role: 'system' },
      });
    } catch (error: any) {
      console.error(`[UPDATE] Failed to create message log:`, error?.message);
      return { success: false, error: 'Failed to log message' };
    }

    // Send via WhatsApp
    try {
      console.log(`[UPDATE] Sending to ${customerPhone}...`);
      const result = await whatsappProvider.sendText(tenantId, customerPhone, messageContent);

      messageDoc.attemptCount = 1;
      messageDoc.status = result.status === 'sent' ? 'sent' : 'failed';
      messageDoc.providerMessageId = result.providerMessageId || undefined;
      messageDoc.error = result.error || undefined;
      if (result.status === 'sent') messageDoc.sentAt = new Date();
      await messageDoc.save();

      if (result.status !== 'sent') {
        console.warn(`[UPDATE] ❌ Failed to send: ${result.error}`);
        return { success: false, error: result.error || 'Send failed' };
      }

      console.log(`[UPDATE] ✅ Sent successfully - Message ID: ${result.providerMessageId}`);
      return {
        success: true,
        messageId: result.providerMessageId,
        message: `${updateType} notification sent to ${customerPhone}`,
      };
    } catch (error: any) {
      messageDoc.status = 'failed';
      messageDoc.error = error?.message;
      await messageDoc.save();
      console.error(`[UPDATE] Error sending message:`, error?.message);
      return { success: false, error: error?.message || 'Send failed' };
    }
  } catch (error: any) {
    console.error(`[UPDATE] Unhandled error:`, error?.message);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

function buildDriverChangeMessage(booking: any, newDetails: any): string {
  const lines = [
    `✅ *ड्राइवर में परिवर्तन*`,
    ``,
    `नमस्कार *${booking.customerName}*,`,
    ``,
    `आपकी बुकिंग ${booking.bookingId} के लिए ड्राइवर में परिवर्तन हुआ है।`,
    ``,
    `👨‍✈️ *नया ड्राइवर*`,
    `नाम: *${newDetails.driverName || 'TBD'}*`,
    `📱 मोबाइल: *${newDetails.driverPhone || 'TBD'}*`,
    ``,
    `📍 पिकअप: *${booking.pickupLocation}*`,
    `🏁 ड्रॉप: *${booking.dropoffLocation || 'Local'}*`,
    `📅 तारीख: *${new Date(booking.pickupDate).toLocaleDateString('en-IN')}*`,
    ``,
    `कोई सवाल हो तो हमसे संपर्क करें।`,
    ``,
    `धन्यवाद!`,
  ];

  return lines.join('\n');
}

function buildVehicleChangeMessage(booking: any, newDetails: any): string {
  const lines = [
    `🚗 *गाड़ी में परिवर्तन | ${booking.tenantId}*`,
    ``,
    `नमस्कार *${booking.customerName}*,`,
    ``,
    `आपकी बुकिंग ${booking.bookingId} के लिए गाड़ी में परिवर्तन हुआ है।`,
    ``,
    `🚘 *नई गाड़ी*`,
    `नाम: *${newDetails.vehicleName || 'TBD'}*`,
    `नंबर प्लेट: *${newDetails.vehicleNumber || 'TBD'}*`,
    ``,
    `📍 पिकअप: *${booking.pickupLocation}*`,
    `🏁 ड्रॉप: *${booking.dropoffLocation || 'Local'}*`,
    `📅 तारीख: *${new Date(booking.pickupDate).toLocaleDateString('en-IN')}*`,
    ``,
    `कोई सवाल हो तो हमसे संपर्क करें।`,
    ``,
    `धन्यवाद!`,
  ];

  return lines.join('\n');
}

function buildBookingUpdateMessage(booking: any, newDetails?: any): string {
  const lines = [
    `📝 *बुकिंग में अपडेट | ${booking.tenantId}*`,
    ``,
    `नमस्कार *${booking.customerName}*,`,
    ``,
    `आपकी बुकिंग ${booking.bookingId} में कुछ विवरण अपडेट किए गए हैं।`,
    ``,
    `📋 *बुकिंग विवरण*`,
    `🔖 बुकिंग आईडी: *${booking.bookingId}*`,
    `📍 पिकअप: *${booking.pickupLocation}*`,
    `🏁 ड्रॉप: *${booking.dropoffLocation || 'Local'}*`,
    `📅 तारीख: *${new Date(booking.pickupDate).toLocaleDateString('en-IN')}*`,
    `💰 कुल किराया: *₹${booking.totalAmount}*`,
    ``,
    `कोई सवाल हो तो हमसे संपर्क करें।`,
    ``,
    `धन्यवाद!`,
  ];

  return lines.join('\n');
}

function buildCustomMessage(booking: any, customMessage: string): string {
  const lines = [
    `📢 *अपडेट | ${booking.tenantId}*`,
    ``,
    `नमस्कार *${booking.customerName}*,`,
    ``,
    `${customMessage}`,
    ``,
    `बुकिंग ID: ${booking.bookingId}`,
    ``,
    `धन्यवाद!`,
  ];

  return lines.join('\n');
}

/**
 * Batch send updates to multiple customers
 */
export async function sendBatchUpdateNotifications(
  tenantId: string,
  bookingIds: string[],
  updateType: 'driver_change' | 'vehicle_change' | 'booking_update',
  newDetails?: any
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  console.log(`[UPDATE] Batch sending ${updateType} to ${bookingIds.length} bookings`);

  for (const bookingId of bookingIds) {
    const result = await sendCustomerUpdateNotification({
      tenantId,
      bookingId,
      updateType,
      newDetails,
    });

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${bookingId}: ${result.error}`);
    }
  }

  console.log(
    `[UPDATE] Batch complete - Sent: ${results.sent}, Failed: ${results.failed}`
  );

  return results;
}
