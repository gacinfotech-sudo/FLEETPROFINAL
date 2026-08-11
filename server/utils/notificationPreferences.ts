// Notification Preferences - User-controlled notification settings
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationPreferences');

export enum NotificationChannel {
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export interface CategoryPreference {
  enabled: boolean;
  channels: NotificationChannel[];
  frequencyCap?: number; // Max notifications per day (-1 for unlimited)
}

export interface NotificationPreference {
  _id?: string;
  userId: string;
  globalEnabled: boolean;
  globalChannels: NotificationChannel[];
  categories: Record<string, CategoryPreference>;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // "22:00" format
  quietHoursEnd?: string; // "08:00" format
  quietHoursTimezone?: string;
  dailyFrequencyCap?: number; // Max notifications per day (-1 for unlimited)
  hourlyFrequencyCap?: number; // Max notifications per hour (-1 for unlimited)
  unsubscribedFrom: string[]; // Unsubscribed notification types
  updatedAt: Date;
}

class NotificationPreferenceManager {
  private db = mongoose.connection.db!;

  async getPreferences(userId: string): Promise<NotificationPreference> {
    try {
      const collection = this.db.collection('notification_preferences');

      let prefs = await collection.findOne({ userId });

      // Return default if not found
      if (!prefs) {
        prefs = this.getDefaultPreferences(userId);
      }

      return prefs as NotificationPreference;
    } catch (error) {
      log.error('Failed to get preferences', { userId, error });
      throw error;
    }
  }

  async setPreferences(userId: string, preferences: Partial<NotificationPreference>): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $set: {
            userId,
            ...preferences,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      log.info('Preferences updated', { userId });
    } catch (error) {
      log.error('Failed to set preferences', { userId, error });
      throw error;
    }
  }

  async setCategoryPreference(
    userId: string,
    category: string,
    preference: CategoryPreference
  ): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $set: {
            [`categories.${category}`]: preference,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      log.info('Category preference updated', { userId, category });
    } catch (error) {
      log.error('Failed to set category preference', { userId, category, error });
      throw error;
    }
  }

  async enableCategory(userId: string, category: string, channels: NotificationChannel[] = [NotificationChannel.PUSH]): Promise<void> {
    await this.setCategoryPreference(userId, category, {
      enabled: true,
      channels
    });
  }

  async disableCategory(userId: string, category: string): Promise<void> {
    await this.setCategoryPreference(userId, category, {
      enabled: false,
      channels: []
    });
  }

  async setQuietHours(
    userId: string,
    start: string,
    end: string,
    timezone: string = 'UTC'
  ): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $set: {
            quietHoursEnabled: true,
            quietHoursStart: start,
            quietHoursEnd: end,
            quietHoursTimezone: timezone,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      log.info('Quiet hours set', { userId, start, end, timezone });
    } catch (error) {
      log.error('Failed to set quiet hours', { userId, error });
      throw error;
    }
  }

  async disableQuietHours(userId: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $set: {
            quietHoursEnabled: false,
            updatedAt: new Date()
          }
        }
      );

      log.info('Quiet hours disabled', { userId });
    } catch (error) {
      log.error('Failed to disable quiet hours', { userId, error });
      throw error;
    }
  }

  async setFrequencyCaps(
    userId: string,
    dailyCap?: number,
    hourlyCap?: number
  ): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      const updates: any = { updatedAt: new Date() };
      if (dailyCap !== undefined) updates.dailyFrequencyCap = dailyCap;
      if (hourlyCap !== undefined) updates.hourlyFrequencyCap = hourlyCap;

      await collection.updateOne(
        { userId },
        { $set: updates },
        { upsert: true }
      );

      log.info('Frequency caps set', { userId, dailyCap, hourlyCap });
    } catch (error) {
      log.error('Failed to set frequency caps', { userId, error });
      throw error;
    }
  }

  async canSendNotification(
    userId: string,
    category: string,
    channel: NotificationChannel = NotificationChannel.PUSH
  ): Promise<boolean> {
    try {
      const prefs = await this.getPreferences(userId);

      // Check global enable
      if (!prefs.globalEnabled) {
        return false;
      }

      // Check quiet hours
      if (prefs.quietHoursEnabled && this.isInQuietHours(prefs)) {
        return false;
      }

      // Check if unsubscribed from this type
      if (prefs.unsubscribedFrom.includes(category)) {
        return false;
      }

      // Check category preference
      const categoryPref = prefs.categories[category];
      if (categoryPref && !categoryPref.enabled) {
        return false;
      }

      if (categoryPref && !categoryPref.channels.includes(channel)) {
        return false;
      }

      // Check frequency caps would need tracking - return true for now
      // Frequency cap enforcement should be in a separate call

      return true;
    } catch (error) {
      log.error('Failed to check if can send notification', { userId, category, error });
      // Default to true if preference check fails (allow notification)
      return true;
    }
  }

  async unsubscribe(userId: string, category: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $addToSet: { unsubscribedFrom: category },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );

      log.info('Unsubscribed from category', { userId, category });
    } catch (error) {
      log.error('Failed to unsubscribe', { userId, category, error });
      throw error;
    }
  }

  async resubscribe(userId: string, category: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $pull: { unsubscribedFrom: category },
          $set: { updatedAt: new Date() }
        }
      );

      log.info('Resubscribed to category', { userId, category });
    } catch (error) {
      log.error('Failed to resubscribe', { userId, category, error });
      throw error;
    }
  }

  private isInQuietHours(prefs: NotificationPreference): boolean {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle case where end time is before start time (e.g., 22:00 to 08:00)
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  private getDefaultPreferences(userId: string): NotificationPreference {
    return {
      userId,
      globalEnabled: true,
      globalChannels: [NotificationChannel.PUSH],
      categories: {
        booking: { enabled: true, channels: [NotificationChannel.PUSH] },
        payment: { enabled: true, channels: [NotificationChannel.PUSH] },
        driver: { enabled: true, channels: [NotificationChannel.PUSH] },
        vehicle: { enabled: true, channels: [NotificationChannel.PUSH] },
        customer: { enabled: true, channels: [NotificationChannel.PUSH] },
        alert: { enabled: true, channels: [NotificationChannel.PUSH] },
        reminder: { enabled: true, channels: [NotificationChannel.PUSH] },
        promo: { enabled: false, channels: [] },
        system: { enabled: true, channels: [NotificationChannel.PUSH] }
      },
      quietHoursEnabled: false,
      dailyFrequencyCap: -1,
      hourlyFrequencyCap: -1,
      unsubscribedFrom: [],
      updatedAt: new Date()
    };
  }

  async resetToDefaults(userId: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_preferences');

      await collection.updateOne(
        { userId },
        {
          $set: {
            ...this.getDefaultPreferences(userId)
          }
        },
        { upsert: true }
      );

      log.info('Preferences reset to defaults', { userId });
    } catch (error) {
      log.error('Failed to reset preferences', { userId, error });
      throw error;
    }
  }
}

export const notificationPreferenceManager = new NotificationPreferenceManager();
