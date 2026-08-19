import mongoose from 'mongoose';

export interface ReminderSettings {
  tenantId: string;
  enabled: boolean;
  reminderIntervals: number[]; // in minutes
  recipients: {
    driver: boolean;
    customer: boolean;
    officeStaff: boolean;
  };
  messageTemplates: {
    driver: string;
    customer: string;
    officeStaff: string;
  };
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: Omit<ReminderSettings, 'tenantId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  reminderIntervals: [5, 10, 20, 30, 60, 120, 300], // 5, 10, 20, 30 min, 1hr, 2hrs, 5hrs
  recipients: {
    driver: true,
    customer: true,
    officeStaff: true,
  },
  messageTemplates: {
    driver: `📍 Pickup Reminder: You have a booking in {MINUTES} minutes\n🚗 Booking: {BOOKING_ID}\n📍 Pickup: {PICKUP_LOCATION}\n🚩 Drop: {DROP_LOCATION}\n💰 Amount: ₹{AMOUNT}`,
    customer: `✅ Your Booking Reminder\nYour pickup is in {MINUTES} minutes\n🚗 Booking: {BOOKING_ID}\n📍 Location: {PICKUP_LOCATION}\n⏰ Arriving soon!`,
    officeStaff: `📋 Booking Update: {BOOKING_ID}\n📍 Pickup in {MINUTES} minutes\n👤 Customer: {CUSTOMER_NAME}\n📞 {CUSTOMER_PHONE}\n📍 {PICKUP_LOCATION}`,
  },
  timezone: 'Asia/Kolkata',
};

export async function getSettings(tenantId: string): Promise<ReminderSettings> {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const collection = db.collection('whatsapp_reminder_settings');
    const settings = await collection.findOne({ tenantId });

    if (!settings) {
      return {
        tenantId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return settings as ReminderSettings;
  } catch (error: any) {
    console.error('Error getting reminder settings:', error);
    return {
      tenantId,
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function updateSettings(
  tenantId: string,
  updates: Partial<Omit<ReminderSettings, 'tenantId' | 'createdAt' | 'updatedAt'>>
): Promise<ReminderSettings> {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    // Validate updates
    const validatedUpdates: any = {};

    if (updates.enabled !== undefined) {
      validatedUpdates.enabled = Boolean(updates.enabled);
    }

    if (updates.reminderIntervals !== undefined) {
      if (!Array.isArray(updates.reminderIntervals)) {
        throw new Error('reminderIntervals must be an array');
      }
      // Validate all intervals are positive numbers between 1 and 1440 (1 day)
      validatedUpdates.reminderIntervals = updates.reminderIntervals
        .filter(i => typeof i === 'number' && i > 0 && i <= 1440)
        .sort((a, b) => a - b);

      if (validatedUpdates.reminderIntervals.length === 0) {
        throw new Error('At least one valid reminder interval is required (1-1440 minutes)');
      }
    }

    if (updates.recipients !== undefined) {
      if (typeof updates.recipients !== 'object') {
        throw new Error('recipients must be an object');
      }
      validatedUpdates.recipients = {
        driver: Boolean(updates.recipients.driver),
        customer: Boolean(updates.recipients.customer),
        officeStaff: Boolean(updates.recipients.officeStaff),
      };
    }

    if (updates.timezone !== undefined) {
      const validTimezones = ['Asia/Kolkata', 'UTC', 'Asia/Dubai', 'America/New_York'];
      if (!validTimezones.includes(updates.timezone)) {
        throw new Error(`Invalid timezone. Valid options: ${validTimezones.join(', ')}`);
      }
      validatedUpdates.timezone = updates.timezone;
    }

    if (updates.messageTemplates !== undefined) {
      if (typeof updates.messageTemplates !== 'object') {
        throw new Error('messageTemplates must be an object');
      }
      validatedUpdates.messageTemplates = {
        driver: updates.messageTemplates.driver?.substring(0, 1000) || DEFAULT_SETTINGS.messageTemplates.driver,
        customer: updates.messageTemplates.customer?.substring(0, 1000) || DEFAULT_SETTINGS.messageTemplates.customer,
        officeStaff: updates.messageTemplates.officeStaff?.substring(0, 1000) || DEFAULT_SETTINGS.messageTemplates.officeStaff,
      };
    }

    const collection = db.collection('whatsapp_reminder_settings');
    const now = new Date();

    const result = await collection.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          ...validatedUpdates,
          updatedAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    return (result.value || {
      tenantId,
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    }) as ReminderSettings;
  } catch (error: any) {
    console.error('Error updating reminder settings:', error);
    throw error;
  }
}

export async function resetSettings(tenantId: string): Promise<ReminderSettings> {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const collection = db.collection('whatsapp_reminder_settings');
    const now = new Date();

    await collection.deleteOne({ tenantId });

    return {
      tenantId,
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error: any) {
    console.error('Error resetting reminder settings:', error);
    throw error;
  }
}
