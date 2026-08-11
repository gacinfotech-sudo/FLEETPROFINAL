// Migration 010: Create notification templates collection with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration010');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_templates collection
    const templatesCollection = db.collection('notification_templates');

    // Create indexes for efficient template lookups
    await templatesCollection.createIndex(
      { name: 1 },
      { name: 'idx_templates_name', unique: false }
    );
    log.info('Created index: notification_templates (name)');

    await templatesCollection.createIndex(
      { category: 1, status: 1 },
      { name: 'idx_templates_category_status' }
    );
    log.info('Created index: notification_templates (category, status)');

    await templatesCollection.createIndex(
      { tags: 1 },
      { name: 'idx_templates_tags', sparse: true }
    );
    log.info('Created index: notification_templates (tags)');

    await templatesCollection.createIndex(
      { status: 1, category: 1, name: 1 },
      { name: 'idx_templates_status_category_name' }
    );
    log.info('Created index: notification_templates (status, category, name)');

    log.info('Migration 010: Notification templates collection and indexes created');
  } catch (error) {
    log.error('Migration 010 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;
    const templatesCollection = db.collection('notification_templates');

    // Drop indexes
    await templatesCollection.dropIndex('idx_templates_name').catch(() => {});
    await templatesCollection.dropIndex('idx_templates_category_status').catch(() => {});
    await templatesCollection.dropIndex('idx_templates_tags').catch(() => {});
    await templatesCollection.dropIndex('idx_templates_status_category_name').catch(() => {});

    log.info('Migration 010: Notification templates indexes dropped');
  } catch (error) {
    log.error('Migration 010 rollback failed', { error });
    throw error;
  }
}
