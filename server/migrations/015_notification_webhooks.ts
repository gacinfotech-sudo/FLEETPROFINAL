// Migration 015: Create notification webhooks collections with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration015');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_webhook_subscriptions collection
    const subscriptionsCollection = db.collection('notification_webhook_subscriptions');

    await subscriptionsCollection.createIndex(
      { url: 1 },
      { name: 'idx_webhooks_subs_url' }
    );
    log.info('Created index: notification_webhook_subscriptions (url)');

    await subscriptionsCollection.createIndex(
      { active: 1, createdAt: -1 },
      { name: 'idx_webhooks_subs_active_createdAt' }
    );
    log.info('Created index: notification_webhook_subscriptions (active, createdAt)');

    // Create notification_webhook_events collection
    const eventsCollection = db.collection('notification_webhook_events');

    // Index 1: Find pending webhooks due for retry
    await eventsCollection.createIndex(
      { status: 1, nextRetryTime: 1 },
      { name: 'idx_webhooks_events_status_nextRetryTime' }
    );
    log.info('Created index: notification_webhook_events (status, nextRetryTime)');

    // Index 2: Subscription events
    await eventsCollection.createIndex(
      { subscriptionId: 1, status: 1 },
      { name: 'idx_webhooks_events_subscriptionId_status' }
    );
    log.info('Created index: notification_webhook_events (subscriptionId, status)');

    // Index 3: Event type queries
    await eventsCollection.createIndex(
      { event: 1, status: 1 },
      { name: 'idx_webhooks_events_event_status' }
    );
    log.info('Created index: notification_webhook_events (event, status)');

    // Index 4: Time-based queries
    await eventsCollection.createIndex(
      { createdAt: -1 },
      { name: 'idx_webhooks_events_createdAt' }
    );
    log.info('Created index: notification_webhook_events (createdAt)');

    // Index 5: TTL index for 30-day retention
    await eventsCollection.createIndex(
      { expiresAt: 1 },
      {
        name: 'idx_webhooks_events_ttl',
        expireAfterSeconds: 0
      }
    );
    log.info('Created TTL index: notification_webhook_events (expiresAt)');

    log.info('Migration 015: Webhook collections and indexes created');
  } catch (error) {
    log.error('Migration 015 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Drop subscription indexes
    const subscriptionsCollection = db.collection('notification_webhook_subscriptions');
    await subscriptionsCollection.dropIndex('idx_webhooks_subs_url').catch(() => {});
    await subscriptionsCollection.dropIndex('idx_webhooks_subs_active_createdAt').catch(() => {});
    log.info('Dropped notification_webhook_subscriptions indexes');

    // Drop event indexes
    const eventsCollection = db.collection('notification_webhook_events');
    await eventsCollection.dropIndex('idx_webhooks_events_status_nextRetryTime').catch(() => {});
    await eventsCollection.dropIndex('idx_webhooks_events_subscriptionId_status').catch(() => {});
    await eventsCollection.dropIndex('idx_webhooks_events_event_status').catch(() => {});
    await eventsCollection.dropIndex('idx_webhooks_events_createdAt').catch(() => {});
    await eventsCollection.dropIndex('idx_webhooks_events_ttl').catch(() => {});
    log.info('Dropped notification_webhook_events indexes');

    log.info('Migration 015: Webhook indexes dropped');
  } catch (error) {
    log.error('Migration 015 rollback failed', { error });
    throw error;
  }
}
