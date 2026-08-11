// Notification Archive & Retention Management - Phase 39
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationArchive');

export interface RetentionPolicy {
  _id?: string;
  tenantId: string;
  eventType: string;
  retentionDays: number;
  archiveAfterDays: number;
  allowExport: boolean;
  createdAt: Date;
}

class NotificationArchiveManager {
  private db = mongoose.connection.db!;

  async archiveOldNotifications(tenantId: string, daysOld: number = 90): Promise<{ archived: number; exported: number }> {
    try {
      const collection = this.db.collection('in_app_notifications');
      const archiveCollection = this.db.collection('notification_archive');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Find notifications to archive
      const toArchive = await collection
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          createdAt: { $lt: cutoffDate }
        })
        .toArray();

      if (toArchive.length === 0) {
        return { archived: 0, exported: 0 };
      }

      // Archive them
      await archiveCollection.insertMany(toArchive as any);

      // Delete from active collection
      await collection.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        createdAt: { $lt: cutoffDate }
      });

      log.info('Notifications archived', {
        tenantId,
        count: toArchive.length,
        daysOld
      });

      return { archived: toArchive.length, exported: 0 };
    } catch (error) {
      log.error('Failed to archive notifications', { error });
      return { archived: 0, exported: 0 };
    }
  }

  async deleteExpiredNotifications(tenantId: string, retentionDays: number = 365): Promise<number> {
    try {
      const archiveCollection = this.db.collection('notification_archive');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await archiveCollection.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        createdAt: { $lt: cutoffDate }
      });

      log.info('Expired notifications deleted', {
        tenantId,
        count: result.deletedCount,
        retentionDays
      });

      return result.deletedCount;
    } catch (error) {
      log.error('Failed to delete expired notifications', { error });
      return 0;
    }
  }

  async exportNotifications(tenantId: string, userId: string, format: 'csv' | 'json' = 'json'): Promise<string> {
    try {
      const collection = this.db.collection('in_app_notifications');

      const notifications = await collection
        .find({
          userId: new mongoose.Types.ObjectId(userId),
          tenantId: new mongoose.Types.ObjectId(tenantId)
        })
        .toArray();

      let data: string;

      if (format === 'json') {
        data = JSON.stringify(notifications, null, 2);
      } else {
        // CSV format
        if (notifications.length === 0) {
          data = '';
        } else {
          const headers = Object.keys(notifications[0]).join(',');
          const rows = notifications.map(n =>
            Object.values(n)
              .map(v => `"${String(v).replace(/"/g, '""')}"`)
              .join(',')
          );
          data = [headers, ...rows].join('\n');
        }
      }

      log.info('Notifications exported', {
        userId,
        format,
        count: notifications.length
      });

      return data;
    } catch (error) {
      log.error('Failed to export notifications', { error });
      throw error;
    }
  }

  async setRetentionPolicy(tenantId: string, policy: Omit<RetentionPolicy, '_id' | 'createdAt'>): Promise<void> {
    try {
      const collection = this.db.collection('retention_policies');

      await collection.updateOne(
        { tenantId, eventType: policy.eventType },
        {
          $set: {
            ...policy,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      log.info('Retention policy set', {
        tenantId,
        eventType: policy.eventType,
        retentionDays: policy.retentionDays
      });
    } catch (error) {
      log.error('Failed to set retention policy', { error });
      throw error;
    }
  }

  async getRetentionPolicy(tenantId: string, eventType: string): Promise<RetentionPolicy | null> {
    try {
      const collection = this.db.collection('retention_policies');

      return await collection.findOne({
        tenantId,
        eventType
      }) as any;
    } catch (error) {
      log.error('Failed to get retention policy', { error });
      return null;
    }
  }

  async searchArchive(tenantId: string, query: string, limit: number = 100): Promise<any[]> {
    try {
      const archiveCollection = this.db.collection('notification_archive');

      return await archiveCollection
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { body: { $regex: query, $options: 'i' } }
          ]
        })
        .limit(limit)
        .toArray() as any;
    } catch (error) {
      log.error('Failed to search archive', { error });
      return [];
    }
  }

  async getArchiveStats(tenantId: string): Promise<{ total: number; byEventType: Record<string, number> }> {
    try {
      const archiveCollection = this.db.collection('notification_archive');

      const total = await archiveCollection.countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId)
      });

      const stats = await archiveCollection
        .aggregate([
          {
            $match: { tenantId: new mongoose.Types.ObjectId(tenantId) }
          },
          {
            $group: {
              _id: '$eventType',
              count: { $sum: 1 }
            }
          }
        ])
        .toArray();

      const byEventType: Record<string, number> = {};
      for (const stat of stats) {
        byEventType[stat._id] = stat.count;
      }

      return { total, byEventType };
    } catch (error) {
      log.error('Failed to get archive stats', { error });
      return { total: 0, byEventType: {} };
    }
  }
}

export const notificationArchiveManager = new NotificationArchiveManager();
