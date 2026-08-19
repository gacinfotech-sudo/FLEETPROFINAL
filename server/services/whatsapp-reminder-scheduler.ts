import mongoose from 'mongoose';
import { Booking, Driver, Customer, User, WhatsAppTemplate } from '../models/index';

// Reminder intervals in minutes before pickup
const REMINDER_INTERVALS = [5, 10, 20, 30, 60, 120, 300]; // 5, 10, 20, 30 min, 1hr, 2hrs, 5hrs

interface ReminderSchedule {
  bookingId: string;
  tenantId: string;
  pickupTime: Date;
  reminderIntervals: number[]; // in minutes
  recipientType: 'driver' | 'customer' | 'office_staff';
  scheduled: boolean;
}

export async function scheduleBookingReminders(
  tenantId: string,
  bookingId: string,
  pickupDate: Date,
  driverId?: string,
  customerId?: string
) {
  try {
    // Validate inputs
    if (!tenantId || !bookingId || !pickupDate) {
      console.error('Missing required parameters for reminder scheduling:', { tenantId, bookingId, pickupDate });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      console.error('Invalid tenant ID format:', tenantId);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      console.error('Invalid booking ID format:', bookingId);
      return;
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const booking = await Booking.findById(new mongoose.Types.ObjectId(bookingId)).lean();

    if (!booking) {
      console.error('Booking not found for reminder scheduling:', bookingId);
      return;
    }

    if (!(pickupDate instanceof Date) || isNaN(pickupDate.getTime())) {
      console.error('Invalid pickup date:', pickupDate);
      return;
    }

    const schedules: ReminderSchedule[] = [];

    // Schedule reminders for DRIVER
    if (driverId) {
      for (const interval of REMINDER_INTERVALS) {
        const reminderTime = new Date(pickupDate.getTime() - interval * 60000);

        if (reminderTime > new Date()) {
          schedules.push({
            bookingId,
            tenantId,
            pickupTime: pickupDate,
            reminderIntervals: [interval],
            recipientType: 'driver',
            scheduled: false
          });
        }
      }
    }

    // Schedule reminders for CUSTOMER
    if (customerId) {
      for (const interval of REMINDER_INTERVALS) {
        const reminderTime = new Date(pickupDate.getTime() - interval * 60000);

        if (reminderTime > new Date()) {
          schedules.push({
            bookingId,
            tenantId,
            pickupTime: pickupDate,
            reminderIntervals: [interval],
            recipientType: 'customer',
            scheduled: false
          });
        }
      }
    }

    // Schedule reminders for OFFICE STAFF (manager/admin)
    const admins = await User.find({
      tenantId: tenantObjectId,
      role: { $in: ['tenant_owner', 'manager', 'admin'] }
    }).select('_id phone primaryMobile').lean();

    if (admins.length > 0) {
      for (const interval of REMINDER_INTERVALS) {
        const reminderTime = new Date(pickupDate.getTime() - interval * 60000);

        if (reminderTime > new Date()) {
          schedules.push({
            bookingId,
            tenantId,
            pickupTime: pickupDate,
            reminderIntervals: [interval],
            recipientType: 'office_staff',
            scheduled: false
          });
        }
      }
    }

    // Store schedules in a collection for processing
    if (schedules.length > 0) {
      await storeReminderSchedules(schedules, booking);
      console.log(`✅ Scheduled ${schedules.length} WhatsApp reminders for booking ${bookingId}`);
    }
  } catch (error: any) {
    console.error('Error scheduling WhatsApp reminders:', error);
  }
}

async function storeReminderSchedules(schedules: ReminderSchedule[], booking: any) {
  const db = mongoose.connection.db;
  if (!db) return;

  const collection = db.collection('whatsapp_reminders');

  const documents = schedules.map(schedule => ({
    ...schedule,
    bookingDetails: {
      bookingId: booking.bookingId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropoffLocation,
      totalAmount: booking.totalAmount,
      vehicleInfo: booking.vehicleInfo,
      driverInfo: booking.driverInfo,
    },
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  try {
    const result = await collection.insertMany(documents);
    console.log(`📱 Stored ${result.insertedCount} reminder schedules`);
  } catch (error: any) {
    console.error('Error storing reminder schedules:', error);
  }
}

// Background job to process and send reminders
export async function processWhatsAppReminders() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection('whatsapp_reminders');
    const now = new Date();

    // Find due reminders
    const dueReminders = await collection.find({
      status: 'pending',
      pickupTime: { $lte: new Date(now.getTime() + 60000) }, // Within 1 minute
      $expr: {
        $lte: [
          { $subtract: ['$pickupTime', '$reminderIntervals[0] * 60000'] },
          now
        ]
      }
    }).limit(50).toArray();

    for (const reminder of dueReminders) {
      await sendReminderMessage(reminder);

      // Mark as sent
      await collection.updateOne(
        { _id: reminder._id },
        { $set: { status: 'sent', sentAt: new Date() } }
      );
    }

    if (dueReminders.length > 0) {
      console.log(`✅ Sent ${dueReminders.length} WhatsApp reminders`);
    }
  } catch (error: any) {
    console.error('Error processing reminders:', error);
  }
}

async function sendReminderMessage(reminder: any) {
  try {
    const { recipientType, bookingDetails, reminderIntervals } = reminder;
    const minutesBefore = reminderIntervals[0];
    const recipient = recipientType === 'driver' ? bookingDetails.driverInfo :
                     recipientType === 'customer' ? bookingDetails.customerPhone :
                     'admin'; // office staff

    // Build reminder message
    let message = '';
    if (recipientType === 'driver') {
      message = `📍 Pickup Reminder: You have a booking in ${minutesBefore} minutes\n`;
      message += `🚗 Booking: ${bookingDetails.bookingId}\n`;
      message += `📍 Pickup: ${bookingDetails.pickupLocation}\n`;
      message += `🚩 Drop: ${bookingDetails.dropLocation}\n`;
      message += `💰 Amount: ₹${bookingDetails.totalAmount}`;
    } else if (recipientType === 'customer') {
      message = `✅ Your Booking Reminder\n`;
      message += `Your pickup is in ${minutesBefore} minutes\n`;
      message += `🚗 Booking: ${bookingDetails.bookingId}\n`;
      message += `📍 Location: ${bookingDetails.pickupLocation}\n`;
      message += `⏰ Arriving soon!`;
    } else {
      message = `📋 Booking Update: ${bookingDetails.bookingId}\n`;
      message += `📍 Pickup in ${minutesBefore} minutes\n`;
      message += `👤 Customer: ${bookingDetails.customerName}\n`;
      message += `📞 ${bookingDetails.customerPhone}\n`;
      message += `📍 ${bookingDetails.pickupLocation}`;
    }

    console.log(`📱 Sending reminder to ${recipientType}:`, message.substring(0, 50));

    // Here you would integrate with your WhatsApp API
    // For now, just log the message
    // TODO: Integrate with WhatsApp Business API or your WhatsApp service

  } catch (error: any) {
    console.error('Error sending reminder message:', error);
  }
}

// Start the reminder processor
let reminderProcessorInterval: NodeJS.Timeout | null = null;

export function startReminderProcessor() {
  if (reminderProcessorInterval) return;

  // Process reminders every minute
  reminderProcessorInterval = setInterval(() => {
    processWhatsAppReminders().catch(err => console.error('Reminder processor error:', err));
  }, 60000);

  console.log('✅ WhatsApp Reminder Processor started (runs every 60 seconds)');
}

export function stopReminderProcessor() {
  if (reminderProcessorInterval) {
    clearInterval(reminderProcessorInterval);
    reminderProcessorInterval = null;
  }
}
