// Migration 011: Create notification preferences collection with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration011');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_preferences collection
    const prefsCollection = db.collection('notification_preferences');

    // Index for user preferences lookup
    await prefsCollection.createIndex(
      { userId: 1 },
      { name: 'idx_prefs_userId', unique: true }
    );
    log.info('Created unique index: notification_preferences (userId)');

    // Index for quiet hours queries (finding users in quiet hours)
    await prefsCollection.createIndex(
      { quietHoursEnabled: 1, quietHoursTimezone: 1 },
      { name: 'idx_prefs_quietHours' }
    );
    log.info('Created index: notification_preferences (quietHoursEnabled, quietHoursTimezone)');

    // Index for frequency cap queries
    await prefsCollection.createIndex(
      { dailyFrequencyCap: 1, hourlyFrequencyCap: 1 },
      { name: 'idx_prefs_frequencyCaps', sparse: true }
    );
    log.info('Created index: notification_preferences (dailyFrequencyCap, hourlyFrequencyCap)');

    // Index for unsubscribed categories
    await prefsCollection.createIndex(
      { unsubscribedFrom: 1 },
      { name: 'idx_prefs_unsubscribed', sparse: true }
    );
    log.info('Created index: notification_preferences (unsubscribedFrom)');

    // Index for update tracking
    await prefsCollection.createIndex(
      { updatedAt: -1 },
      { name: 'idx_prefs_updatedAt' }
    );
    log.info('Created index: notification_preferences (updatedAt)');

    log.info('Migration 011: Notification preferences collection and indexes created');
  } catch (error) {
    log.error('Migration 011 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;
    const prefsCollection = db.collection('notification_preferences');

    // Drop indexes
    await prefsCollection.dropIndex('idx_prefs_userId').catch(() => {});
    await prefsCollection.dropIndex('idx_prefs_quietHours').catch(() => {});
    await prefsCollection.dropIndex('idx_prefs_frequencyCaps').catch(() => {});
    await prefsCollection.dropIndex('idx_prefs_unsubscribed').catch(() => {});
    await prefsCollection.dropIndex('idx_prefs_updatedAt').catch(() => {});

    log.info('Migration 011: Notification preferences indexes dropped');
  } catch (error) {
    log.error('Migration 011 rollback failed', { error });
    throw error;
  }
}
