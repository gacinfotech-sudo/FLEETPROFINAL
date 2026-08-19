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
    console.log(`📅 scheduleBookingReminders called: bookingId=${bookingId}, pickupDate=${pickupDate}`);

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

  // Extract phone numbers for each recipient type
  const getPhoneNumber = async (schedule: ReminderSchedule, booking: any) => {
    console.log(`🔍 getPhoneNumber: type=${schedule.recipientType}, customerPhone=${booking.customerPhone || 'MISSING'}`);

    if (schedule.recipientType === 'customer') {
      console.log(`   → Returning customer phone: ${booking.customerPhone}`);
      return booking.customerPhone;
    } else if (schedule.recipientType === 'driver' && booking.driverId) {
      try {
        const driver = await Driver.findById(booking.driverId).lean();
        return driver?.phone || null;
      } catch {
        return null;
      }
    } else if (schedule.recipientType === 'office_staff') {
      // Get staff WhatsApp numbers from User collection
      try {
        // First try to find someone with WhatsApp number set
        const staffWithWhatsApp = await User.findOne({
          tenantId: schedule.tenantId,
          role: { $in: ['admin', 'manager'] },
          'whatsappInternalPhone': { $type: 'string', $ne: '' }
        }).lean();

        if (staffWithWhatsApp?.whatsappInternalPhone) {
          return staffWithWhatsApp.whatsappInternalPhone;
        }

        // Fallback: try to find any staff member's phone
        const staffWithPhone = await User.findOne({
          tenantId: schedule.tenantId,
          role: { $in: ['admin', 'manager'] },
          'phone': { $type: 'string', $ne: '' }
        }).lean();

        if (staffWithPhone?.phone) {
          return staffWithPhone.phone;
        }

        return null;
      } catch (error) {
        console.error('Error getting staff phone:', error);
        return null;
      }
    }
    return null;
  };

  const documents = await Promise.all(schedules.map(async (schedule) => {
    const phoneNumber = await getPhoneNumber(schedule, booking);
    const skipReason = !phoneNumber ? `No ${schedule.recipientType} phone found` : null;

    return {
      ...schedule,
      phoneNumber,
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
      status: phoneNumber ? 'pending' : 'skipped_no_phone',
      skipReason,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }));

  try {
    const result = await collection.insertMany(documents);
    console.log(`📱 Stored ${result.insertedCount} reminder schedules (${documents.filter(d => d.status === 'pending').length} pending)`);
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
    // A reminder is due when: now >= (pickupTime - minutesBefore * 60000)
    // Which means: pickupTime - (minutesBefore * 60000) <= now
    const dueReminders = await collection.find({
      status: 'pending',
      createdAt: { $exists: true }
    }).toArray().then((reminders: any[]) => {
      return reminders.filter(reminder => {
        const minutesBefore = reminder.reminderIntervals?.[0] || 5;
        const reminderTime = new Date(reminder.pickupTime).getTime() - (minutesBefore * 60 * 1000);
        return reminderTime <= now.getTime() && !reminder.sentAt;
      }).slice(0, 50);
    });

    let successCount = 0;
    let failedCount = 0;

    if (dueReminders.length > 0) {
      console.log(`📋 Processing ${dueReminders.length} due WhatsApp reminders...`);
    }

    for (const reminder of dueReminders) {
      const result = await sendReminderMessage(reminder);

      if (result.success) {
        // Mark as sent only if actually sent
        await collection.updateOne(
          { _id: reminder._id },
          { $set: { status: 'sent', sentAt: new Date() } }
        );
        successCount++;
        console.log(`✅ Reminder sent: ${reminder.recipientType} → ${reminder.phoneNumber}`);
      } else {
        // Mark as failed, will retry next iteration
        await collection.updateOne(
          { _id: reminder._id },
          {
            $set: {
              status: 'failed',
              lastError: result.error,
              failureCount: (reminder.failureCount || 0) + 1,
              lastAttempt: new Date()
            }
          }
        );
        failedCount++;
        console.warn(`⚠️ Reminder failed for ${reminder.recipientType} to ${reminder.phoneNumber}: ${result.error}`);
      }
    }

    if (dueReminders.length > 0) {
      console.log(`📊 WhatsApp reminders: ${successCount} sent ✅, ${failedCount} failed ⚠️`);
    }
  } catch (error: any) {
    console.error('Error processing reminders:', error);
  }
}

async function sendReminderMessage(reminder: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { recipientType, bookingDetails, reminderIntervals, tenantId, phoneNumber } = reminder;
    const minutesBefore = reminderIntervals[0];

    // Skip if no phone number
    if (!phoneNumber) {
      return { success: false, error: `No ${recipientType} phone number available` };
    }

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
      // Staff/Admin message with detailed booking info
      const vehicleInfo = bookingDetails.vehicleInfo ?
        `${bookingDetails.vehicleInfo.registrationNumber} (${bookingDetails.vehicleInfo.model})` :
        'N/A';
      const driverName = bookingDetails.driverInfo?.name || 'N/A';

      message = `📋 Booking Alert: ${minutesBefore} min\n\n`;
      message += `📌 Booking ID: ${bookingDetails.bookingId}\n`;
      message += `👤 Customer: ${bookingDetails.customerName}\n`;
      message += `📱 Phone: ${bookingDetails.customerPhone}\n`;
      message += `🚗 Vehicle: ${vehicleInfo}\n`;
      message += `👨‍💼 Driver: ${driverName}\n`;
      message += `📍 Pickup: ${bookingDetails.pickupLocation}\n`;
      message += `🚩 Drop: ${bookingDetails.dropLocation}\n`;
      message += `💰 Amount: ₹${bookingDetails.totalAmount}`;
    }

    console.log(`📱 Sending ${recipientType} reminder to ${phoneNumber}: ${minutesBefore}min before`);

    // ACTUAL WhatsApp sending via whatsappProvider
    try {
      const { whatsappProvider } = await import('../whatsapp/index');
      const sendResult = await whatsappProvider.sendText(tenantId, phoneNumber, message);

      if (sendResult.status === 'sent') {
        console.log(`✅ WhatsApp reminder sent to ${phoneNumber} (Message ID: ${sendResult.providerMessageId})`);
        return { success: true };
      } else {
        console.warn(`⚠️ WhatsApp reminder failed to ${phoneNumber}: ${sendResult.error || 'Unknown error'}`);
        return { success: false, error: sendResult.error || 'Send failed' };
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`❌ Error sending WhatsApp reminder to ${phoneNumber}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error';
    console.error('Error building reminder message:', errorMsg);
    return { success: false, error: errorMsg };
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
