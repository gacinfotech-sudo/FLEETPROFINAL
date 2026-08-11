// Notification System Index Management
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationIndexes');

export interface IndexDefinition {
  name: string;
  keys: Record<string, 1 | -1>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
    partialFilterExpression?: Record<string, any>;
  };
}

export class NotificationIndexManager {
  private get db() {
    return mongoose.connection.db;
  }

  // Scheduled notifications indexes
  private scheduledNotificationsIndexes: IndexDefinition[] = [
    {
      name: 'idx_scheduled_status_scheduledFor',
      keys: { status: 1, scheduledFor: 1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_scheduled_scheduledFor',
      keys: { scheduledFor: 1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_scheduled_recurrenceEndDate_status',
      keys: { recurrenceEndDate: 1, status: 1 },
      options: {
        sparse: true
      }
    },
    {
      name: 'idx_scheduled_ttl_90days',
      keys: { createdAt: 1 },
      options: {
        expireAfterSeconds: 7776000, // 90 days
        partialFilterExpression: { status: { $in: ['cancelled', 'failed'] } }
      }
    }
  ];

  // Notification logs indexes
  private notificationLogsIndexes: IndexDefinition[] = [
    {
      name: 'idx_logs_notificationId',
      keys: { notificationId: 1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_logs_userId_sentAt',
      keys: { userId: 1, sentAt: -1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_logs_status_sentAt',
      keys: { status: 1, sentAt: -1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_logs_sentAt',
      keys: { sentAt: 1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_logs_notificationType_sentAt',
      keys: { notificationType: 1, sentAt: -1 },
      options: {
        sparse: false
      }
    },
    {
      name: 'idx_logs_ttl_30days',
      keys: { sentAt: 1 },
      options: {
        expireAfterSeconds: 2592000 // 30 days
      }
    },
    {
      name: 'idx_logs_analytics',
      keys: { sentAt: -1, status: 1, notificationType: 1 },
      options: {
        sparse: false
      }
    }
  ];

  async ensureIndexes(): Promise<void> {
    try {
      if (!this.db) {
        log.warn('Database not initialized yet, skipping index creation');
        return;
      }

      log.info('Ensuring notification system indexes');

      // Ensure scheduled notifications indexes
      await this.ensureCollectionIndexes('scheduled_notifications', this.scheduledNotificationsIndexes);

      // Ensure notification logs indexes
      await this.ensureCollectionIndexes('notification_logs', this.notificationLogsIndexes);

      log.info('All notification indexes verified');
    } catch (error) {
      log.error('Failed to ensure indexes', { error });
      throw error;
    }
  }

  private async ensureCollectionIndexes(
    collectionName: string,
    indexes: IndexDefinition[]
  ): Promise<void> {
    try {
      const collection = this.db.collection(collectionName);

      for (const index of indexes) {
        try {
          await collection.createIndex(index.keys, {
            name: index.name,
            ...index.options
          });
          log.info(`Index created/verified`, {
            collection: collectionName,
            index: index.name
          });
        } catch (error) {
          // Index may already exist, check if it matches
          const existingIndexes = await collection.indexes();
          const exists = existingIndexes.some(idx => idx.name === index.name);

          if (exists) {
            log.info(`Index already exists`, {
              collection: collectionName,
              index: index.name
            });
          } else {
            log.warn(`Failed to create index`, {
              collection: collectionName,
              index: index.name,
              error
            });
          }
        }
      }
    } catch (error) {
      log.error(`Failed to ensure indexes for collection`, {
        collection: collectionName,
        error
      });
      throw error;
    }
  }

  async getIndexes(collectionName: string): Promise<any[]> {
    try {
      const collection = this.db.collection(collectionName);
      const indexes = await collection.indexes();
      return indexes;
    } catch (error) {
      log.error('Failed to get indexes', { collectionName, error });
      throw error;
    }
  }

  async dropIndex(collectionName: string, indexName: string): Promise<void> {
    try {
      const collection = this.db.collection(collectionName);
      await collection.dropIndex(indexName);
      log.info('Index dropped', { collection: collectionName, index: indexName });
    } catch (error) {
      log.warn('Failed to drop index', { collectionName, indexName, error });
    }
  }

  async rebuildIndexes(): Promise<void> {
    try {
      log.info('Rebuilding notification system indexes');

      const scheduledCollection = this.db.collection('scheduled_notifications');
      const logsCollection = this.db.collection('notification_logs');

      // Drop all indexes except _id
      const scheduledIndexes = await scheduledCollection.indexes();
      for (const index of scheduledIndexes) {
        if (index.name !== '_id_') {
          await this.dropIndex('scheduled_notifications', index.name);
        }
      }

      const logsIndexes = await logsCollection.indexes();
      for (const index of logsIndexes) {
        if (index.name !== '_id_') {
          await this.dropIndex('notification_logs', index.name);
        }
      }

      // Recreate all indexes
      await this.ensureIndexes();

      log.info('Indexes rebuilt successfully');
    } catch (error) {
      log.error('Failed to rebuild indexes', { error });
      throw error;
    }
  }

  async getIndexStats(): Promise<Record<string, any>> {
    try {
      const scheduledIndexes = await this.getIndexes('scheduled_notifications');
      const logsIndexes = await this.getIndexes('notification_logs');

      return {
        scheduledNotifications: {
          count: scheduledIndexes.length,
          indexes: scheduledIndexes.map(idx => ({
            name: idx.name,
            keys: idx.key,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            expireAfterSeconds: idx.expireAfterSeconds
          }))
        },
        notificationLogs: {
          count: logsIndexes.length,
          indexes: logsIndexes.map(idx => ({
            name: idx.name,
            keys: idx.key,
            unique: idx.unique || false,
            sparse: idx.sparse || false,
            expireAfterSeconds: idx.expireAfterSeconds
          }))
        }
      };
    } catch (error) {
      log.error('Failed to get index stats', { error });
      throw error;
    }
  }
}

export const notificationIndexManager = new NotificationIndexManager();
