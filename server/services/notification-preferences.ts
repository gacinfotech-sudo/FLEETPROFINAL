import { Db } from 'mongodb';

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  timezone: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  tenantId: string;
  categories: {
    [category: string]: boolean;
  };
  channels: {
    PUSH: boolean;
    EMAIL: boolean;
    SMS: boolean;
    IN_APP: boolean;
  };
  frequencyCap?: {
    enabled: boolean;
    maxPerDay: number;
    maxPerWeek: number;
  };
  quietHours: QuietHours;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class NotificationPreferencesManager {
  private db: Db | null = null;
  private preferences: Map<string, NotificationPreference> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[PreferencesManager] Database not initialized, running in memory mode');
        return;
      }

      const prefs = await this.db.collection('userNotificationPreferences')
        .find({})
        .toArray();

      for (const pref of prefs) {
        this.preferences.set(pref.id, pref as NotificationPreference);
      }

      console.log(`[PreferencesManager] Initialized with ${prefs.length} preference records`);
    } catch (error) {
      console.error('[PreferencesManager] Initialization error:', error);
    }
  }

  async getOrCreatePreferences(userId: string, tenantId: string): Promise<NotificationPreference> {
    const key = `${userId}-${tenantId}`;
    let prefs = this.preferences.get(key);

    if (!prefs && this.db) {
      try {
        const result = await this.db.collection('userNotificationPreferences')
          .findOne({ userId, tenantId });
        if (result) {
          prefs = result as NotificationPreference;
          this.preferences.set(key, prefs);
          return prefs;
        }
      } catch (e) {
        console.warn('[PreferencesManager] Failed to fetch preferences:', e);
      }
    }

    if (prefs) return prefs;

    // Create default preferences
    const defaultPrefs: NotificationPreference = {
      id: `pref-${userId}-${tenantId}`,
      userId,
      tenantId,
      categories: {
        'promotions': true,
        'updates': true,
        'alerts': true,
        'reminders': true,
        'newsletters': false,
      },
      channels: {
        PUSH: true,
        EMAIL: true,
        SMS: false,
        IN_APP: true,
      },
      frequencyCap: {
        enabled: false,
        maxPerDay: 20,
        maxPerWeek: 100,
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.preferences.set(key, defaultPrefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').insertOne(defaultPrefs);
      } catch (e) {
        console.warn('[PreferencesManager] Failed to persist preferences:', e);
      }
    }

    return defaultPrefs;
  }

  async updateCategoryPreference(
    userId: string,
    tenantId: string,
    category: string,
    enabled: boolean
  ): Promise<NotificationPreference | null> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);
    prefs.categories[category] = enabled;
    prefs.updatedAt = new Date();

    const key = `${userId}-${tenantId}`;
    this.preferences.set(key, prefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').updateOne(
          { id: prefs.id },
          { $set: { categories: prefs.categories, updatedAt: prefs.updatedAt } }
        );
      } catch (e) {
        console.warn('[PreferencesManager] Failed to update category:', e);
      }
    }

    return prefs;
  }

  async updateChannelPreference(
    userId: string,
    tenantId: string,
    channel: string,
    enabled: boolean
  ): Promise<NotificationPreference | null> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);
    (prefs.channels as any)[channel] = enabled;
    prefs.updatedAt = new Date();

    const key = `${userId}-${tenantId}`;
    this.preferences.set(key, prefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').updateOne(
          { id: prefs.id },
          { $set: { channels: prefs.channels, updatedAt: prefs.updatedAt } }
        );
      } catch (e) {
        console.warn('[PreferencesManager] Failed to update channel:', e);
      }
    }

    return prefs;
  }

  async updateQuietHours(
    userId: string,
    tenantId: string,
    quietHours: QuietHours
  ): Promise<NotificationPreference | null> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);
    prefs.quietHours = quietHours;
    prefs.updatedAt = new Date();

    const key = `${userId}-${tenantId}`;
    this.preferences.set(key, prefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').updateOne(
          { id: prefs.id },
          { $set: { quietHours: prefs.quietHours, updatedAt: prefs.updatedAt } }
        );
      } catch (e) {
        console.warn('[PreferencesManager] Failed to update quiet hours:', e);
      }
    }

    return prefs;
  }

  async updateFrequencyCap(
    userId: string,
    tenantId: string,
    frequencyCap: { enabled: boolean; maxPerDay: number; maxPerWeek: number }
  ): Promise<NotificationPreference | null> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);
    prefs.frequencyCap = frequencyCap;
    prefs.updatedAt = new Date();

    const key = `${userId}-${tenantId}`;
    this.preferences.set(key, prefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').updateOne(
          { id: prefs.id },
          { $set: { frequencyCap: prefs.frequencyCap, updatedAt: prefs.updatedAt } }
        );
      } catch (e) {
        console.warn('[PreferencesManager] Failed to update frequency cap:', e);
      }
    }

    return prefs;
  }

  async unsubscribe(userId: string, tenantId: string): Promise<boolean> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);
    prefs.unsubscribedAt = new Date();
    prefs.channels = {
      PUSH: false,
      EMAIL: false,
      SMS: false,
      IN_APP: false,
    };
    prefs.updatedAt = new Date();

    const key = `${userId}-${tenantId}`;
    this.preferences.set(key, prefs);

    if (this.db) {
      try {
        await this.db.collection('userNotificationPreferences').updateOne(
          { id: prefs.id },
          { $set: { unsubscribedAt: prefs.unsubscribedAt, channels: prefs.channels, updatedAt: prefs.updatedAt } }
        );
        return true;
      } catch (e) {
        console.warn('[PreferencesManager] Failed to unsubscribe:', e);
        return false;
      }
    }

    return true;
  }

  async shouldSendNotification(
    userId: string,
    tenantId: string,
    category: string,
    channel: string
  ): Promise<boolean> {
    const prefs = await this.getOrCreatePreferences(userId, tenantId);

    // Check if unsubscribed
    if (prefs.unsubscribedAt) return false;

    // Check category
    if (prefs.categories[category] === false) return false;

    // Check channel
    if ((prefs.channels as any)[channel] === false) return false;

    // Check quiet hours
    if (prefs.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (currentTime >= prefs.quietHours.startTime && currentTime <= prefs.quietHours.endTime) {
        return false;
      }
    }

    return true;
  }

  getPreferenceCount(): number {
    return this.preferences.size;
  }

  getStatus() {
    return {
      preferencesLoaded: this.preferences.size,
      timestamp: new Date(),
    };
  }
}

export const preferencesManager = new NotificationPreferencesManager();
