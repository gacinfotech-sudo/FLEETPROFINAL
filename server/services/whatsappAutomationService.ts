import { Booking, Customer, Driver, WhatsAppMessage } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 9: WHATSAPP AUTOMATION (Simplified)
 */

const TEMPLATES = {
  booking_confirmation: { hi: 'Booking confirmed! Pickup: {pickup} at {time}. Driver: {driver}', en: 'Booking confirmed! Pickup: {pickup} at {time}. Driver: {driver}' },
  trip_started: { hi: 'Trip started! Driver {driver} on the way.', en: 'Trip started! Driver {driver} on the way.' },
  trip_completed: { hi: 'Trip completed! Fare: ₹{amount}', en: 'Trip completed! Fare: ₹{amount}' },
};

export async function sendAutomatedWhatsApp(
  tenantId: mongoose.Types.ObjectId,
  templateKey: string,
  phoneNumber: string,
  data: Record<string, string>,
  language: 'hi' | 'en' = 'hi'
): Promise<boolean> {
  try {
    const templates = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (!templates) return false;

    let message = templates[language];
    for (const [key, value] of Object.entries(data)) {
      message = message.replace(`{${key}}`, value);
    }

    const msg = new WhatsAppMessage({ tenantId, phoneNumber, message, templateKey, language, status: 'sent', sentAt: new Date() });
    await msg.save();
    return true;
  } catch (error) {
    return false;
  }
}

export async function triggerBookingConfirmation(tenantId: mongoose.Types.ObjectId, bookingId: mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const booking = await Booking.findById(bookingId);
    const customer = booking ? await Customer.findById(booking.customerId) : null;
    if (!customer) return false;

    await sendAutomatedWhatsApp(tenantId, 'booking_confirmation', customer.mobileNumber, {
      pickup: booking.pickupLocation,
      time: new Date(booking.pickupDate).toLocaleTimeString(),
      driver: 'TBD'
    });
    return true;
  } catch { return false; }
}

export async function triggerTripStarted(tenantId: mongoose.Types.ObjectId, bookingId: mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const booking = await Booking.findById(bookingId);
    const customer = booking ? await Customer.findById(booking.customerId) : null;
    if (!customer) return false;

    await sendAutomatedWhatsApp(tenantId, 'trip_started', customer.mobileNumber, { driver: 'Driver' });
    return true;
  } catch { return false; }
}

export async function triggerTripCompleted(tenantId: mongoose.Types.ObjectId, bookingId: mongoose.Types.ObjectId): Promise<boolean> {
  try {
    const booking = await Booking.findById(bookingId);
    const customer = booking ? await Customer.findById(booking.customerId) : null;
    if (!customer) return false;

    await sendAutomatedWhatsApp(tenantId, 'trip_completed', customer.mobileNumber, { amount: booking?.totalAmount?.toString() || '0' });
    return true;
  } catch { return false; }
}
