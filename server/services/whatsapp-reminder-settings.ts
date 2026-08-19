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

    const collection = db.collection('whatsapp_reminder_settings');
    const now = new Date();

    const result = await collection.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          ...updates,
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
