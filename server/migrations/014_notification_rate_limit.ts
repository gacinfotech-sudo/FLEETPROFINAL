// Migration 014: Create notification rate limiting collections with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration014');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_rate_limit_policies collection
    const policiesCollection = db.collection('notification_rate_limit_policies');

    await policiesCollection.createIndex(
      { name: 1 },
      { name: 'idx_rl_policies_name', unique: true }
    );
    log.info('Created index: notification_rate_limit_policies (name)');

    await policiesCollection.createIndex(
      { scope: 1, status: 1 },
      { name: 'idx_rl_policies_scope_status' }
    );
    log.info('Created index: notification_rate_limit_policies (scope, status)');

    // Create notification_rate_limit_buckets collection
    const bucketsCollection = db.collection('notification_rate_limit_buckets');

    // Index 1: Fast bucket lookup
    await bucketsCollection.createIndex(
      { policyId: 1, scopeId: 1 },
      { name: 'idx_rl_buckets_policyId_scopeId' }
    );
    log.info('Created index: notification_rate_limit_buckets (policyId, scopeId)');

    // Index 2: User buckets (for user-scoped rate limits)
    await bucketsCollection.createIndex(
      { scope: 1, scopeId: 1 },
      { name: 'idx_rl_buckets_scope_scopeId', sparse: true }
    );
    log.info('Created index: notification_rate_limit_buckets (scope, scopeId)');

    // Index 3: TTL index for auto-cleanup
    await bucketsCollection.createIndex(
      { expiresAt: 1 },
      { name: 'idx_rl_buckets_ttl', expireAfterSeconds: 0 }
    );
    log.info('Created TTL index: notification_rate_limit_buckets (expiresAt)');

    // Create notification_rate_limit_blocks collection (for analytics)
    const blocksCollection = db.collection('notification_rate_limit_blocks');

    // Index 1: User blocks
    await blocksCollection.createIndex(
      { userId: 1, blockedAt: -1 },
      { name: 'idx_rl_blocks_userId_blockedAt' }
    );
    log.info('Created index: notification_rate_limit_blocks (userId, blockedAt)');

    // Index 2: Category blocks
    await blocksCollection.createIndex(
      { category: 1, blockedAt: -1 },
      { name: 'idx_rl_blocks_category_blockedAt' }
    );
    log.info('Created index: notification_rate_limit_blocks (category, blockedAt)');

    // Index 3: Time-based queries
    await blocksCollection.createIndex(
      { blockedAt: -1 },
      { name: 'idx_rl_blocks_blockedAt' }
    );
    log.info('Created index: notification_rate_limit_blocks (blockedAt)');

    // Index 4: TTL index for 30-day retention
    await blocksCollection.createIndex(
      { blockedAt: 1 },
      {
        name: 'idx_rl_blocks_ttl',
        expireAfterSeconds: 2592000 // 30 days
      }
    );
    log.info('Created TTL index: notification_rate_limit_blocks (blockedAt)');

    log.info('Migration 014: Rate limiting collections and indexes created');
  } catch (error) {
    log.error('Migration 014 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Drop policy indexes
    const policiesCollection = db.collection('notification_rate_limit_policies');
    await policiesCollection.dropIndex('idx_rl_policies_name').catch(() => {});
    await policiesCollection.dropIndex('idx_rl_policies_scope_status').catch(() => {});
    log.info('Dropped notification_rate_limit_policies indexes');

    // Drop bucket indexes
    const bucketsCollection = db.collection('notification_rate_limit_buckets');
    await bucketsCollection.dropIndex('idx_rl_buckets_policyId_scopeId').catch(() => {});
    await bucketsCollection.dropIndex('idx_rl_buckets_scope_scopeId').catch(() => {});
    await bucketsCollection.dropIndex('idx_rl_buckets_ttl').catch(() => {});
    log.info('Dropped notification_rate_limit_buckets indexes');

    // Drop block indexes
    const blocksCollection = db.collection('notification_rate_limit_blocks');
    await blocksCollection.dropIndex('idx_rl_blocks_userId_blockedAt').catch(() => {});
    await blocksCollection.dropIndex('idx_rl_blocks_category_blockedAt').catch(() => {});
    await blocksCollection.dropIndex('idx_rl_blocks_blockedAt').catch(() => {});
    await blocksCollection.dropIndex('idx_rl_blocks_ttl').catch(() => {});
    log.info('Dropped notification_rate_limit_blocks indexes');

    log.info('Migration 014: Rate limiting indexes dropped');
  } catch (error) {
    log.error('Migration 014 rollback failed', { error });
    throw error;
  }
}
