/**
 * Push Subscription Manager
 * Manages registration, storage, and lifecycle of push subscriptions
 * Handles multiple subscriptions per user (web, mobile, tablet)
 */

import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { createLogger } from './logger';

const log = createLogger('PushSubscriptionManager');

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SubscriptionRecord {
  _id?: ObjectId;
  userId: ObjectId | string;
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceType?: 'web' | 'mobile' | 'tablet';
  deviceName?: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt: Date;
  lastError?: string;
  errorCount: number;
  platform?: string;
  browser?: string;
}

class PushSubscriptionManager {
  private collectionName = 'push_subscriptions';

  /**
   * Get or create subscriptions collection with indexes
   */
  private async getCollection() {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not initialized');
    }

    const collection = db.collection<SubscriptionRecord>(this.collectionName);

    // Create indexes if they don't exist
    await collection.createIndex({ userId: 1, endpoint: 1 }, { unique: true });
    await collection.createIndex({ endpoint: 1 });
    await collection.createIndex({ userId: 1, isActive: 1 });
    await collection.createIndex({ createdAt: 1 });
    await collection.createIndex({ lastUsedAt: 1 });
    await collection.createIndex({ errorCount: 1 });

    return collection;
  }

  /**
   * Register or update a push subscription
   */
  async subscribe(
    userId: string,
    subscription: PushSubscription,
    deviceInfo?: {
      type?: 'web' | 'mobile' | 'tablet';
      name?: string;
      userAgent?: string;
      platform?: string;
      browser?: string;
    }
  ): Promise<SubscriptionRecord> {
    try {
      const collection = await this.getCollection();
      const objectUserId = new ObjectId(userId);

      const record: SubscriptionRecord = {
        userId: objectUserId,
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: subscription.keys,
        deviceType: deviceInfo?.type || 'web',
        deviceName: deviceInfo?.name,
        userAgent: deviceInfo?.userAgent,
        platform: deviceInfo?.platform,
        browser: deviceInfo?.browser,
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        errorCount: 0,
      };

      // Upsert subscription (update if exists, insert if not)
      const result = await collection.updateOne(
        { userId: objectUserId, endpoint: subscription.endpoint },
        {
          $set: {
            ...record,
            lastUsedAt: new Date(),
            errorCount: 0,
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      log.info('Push subscription registered', {
        userId,
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        deviceType: deviceInfo?.type,
        upserted: result.upsertedId ? 'new' : 'updated',
      });

      return record;
    } catch (error) {
      log.error('Failed to register subscription', { error, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe and remove a push subscription
   */
  async unsubscribe(
    userId: string,
    endpoint: string
  ): Promise<boolean> {
    try {
      const collection = await this.getCollection();
      const objectUserId = new ObjectId(userId);

      const result = await collection.deleteOne({
        userId: objectUserId,
        endpoint,
      });

      if (result.deletedCount > 0) {
        log.info('Push subscription removed', {
          userId,
          endpoint: endpoint.substring(0, 50) + '...',
        });
        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to unsubscribe', { error, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe all devices for a user
   */
  async unsubscribeAll(userId: string): Promise<number> {
    try {
      const collection = await this.getCollection();
      const objectUserId = new ObjectId(userId);

      const result = await collection.deleteMany({
        userId: objectUserId,
      });

      log.info('Unsubscribed all devices', {
        userId,
        count: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      log.error('Failed to unsubscribe all', { error, userId });
      throw error;
    }
  }

  /**
   * Get all active subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    try {
      const collection = await this.getCollection();
      const objectUserId = new ObjectId(userId);

      const subscriptions = await collection
        .find({
          userId: objectUserId,
          isActive: true,
        })
        .toArray();

      return subscriptions;
    } catch (error) {
      log.error('Failed to get user subscriptions', { error, userId });
      throw error;
    }
  }

  /**
   * Get single subscription by endpoint
   */
  async getSubscriptionByEndpoint(
    endpoint: string
  ): Promise<SubscriptionRecord | null> {
    try {
      const collection = await this.getCollection();

      const subscription = await collection.findOne({
        endpoint,
        isActive: true,
      });

      return subscription || null;
    } catch (error) {
      log.error('Failed to get subscription by endpoint', { error });
      throw error;
    }
  }

  /**
   * Mark subscription as invalid and deactivate
   */
  async markAsInvalid(
    endpoint: string,
    error?: string
  ): Promise<boolean> {
    try {
      const collection = await this.getCollection();

      const result = await collection.updateOne(
        { endpoint },
        {
          $set: {
            isActive: false,
            lastError: error,
          },
          $inc: { errorCount: 1 },
        }
      );

      if (result.modifiedCount > 0) {
        log.warn('Subscription marked as invalid', {
          endpoint: endpoint.substring(0, 50) + '...',
          error,
        });
        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to mark subscription as invalid', { error });
      throw error;
    }
  }

  /**
   * Update last used timestamp for a subscription
   */
  async updateLastUsed(endpoint: string): Promise<boolean> {
    try {
      const collection = await this.getCollection();

      const result = await collection.updateOne(
        { endpoint },
        {
          $set: { lastUsedAt: new Date() },
          $inc: { errorCount: -1 }, // Clear error count on successful use
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to update last used', { error });
      throw error;
    }
  }

  /**
   * Get all subscriptions for a list of users
   */
  async getMultipleUserSubscriptions(
    userIds: string[]
  ): Promise<Map<string, SubscriptionRecord[]>> {
    try {
      const collection = await this.getCollection();
      const objectIds = userIds.map((id) => new ObjectId(id));

      const subscriptions = await collection
        .find({
          userId: { $in: objectIds },
          isActive: true,
        })
        .toArray();

      // Group by userId
      const result = new Map<string, SubscriptionRecord[]>();
      subscriptions.forEach((sub) => {
        const userId = sub.userId.toString();
        if (!result.has(userId)) {
          result.set(userId, []);
        }
        result.get(userId)!.push(sub);
      });

      return result;
    } catch (error) {
      log.error('Failed to get multiple user subscriptions', { error });
      throw error;
    }
  }

  /**
   * Clean up expired or invalid subscriptions
   */
  async cleanupInvalidSubscriptions(): Promise<number> {
    try {
      const collection = await this.getCollection();
      const now = Date.now();

      // Remove subscriptions that are inactive or have expired
      const result = await collection.deleteMany({
        $or: [
          { isActive: false },
          { errorCount: { $gt: 5 } }, // More than 5 errors
          {
            expirationTime: { $gt: 0, $lt: now },
          },
        ],
      });

      log.info('Cleaned up invalid subscriptions', {
        count: result.deletedCount,
      });

      return result.deletedCount;
    } catch (error) {
      log.error('Failed to cleanup invalid subscriptions', { error });
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getStatistics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    inactiveSubscriptions: number;
    byDeviceType: Record<string, number>;
    byBrowser: Record<string, number>;
  }> {
    try {
      const collection = await this.getCollection();

      const stats = await collection
        .aggregate([
          {
            $facet: {
              total: [{ $count: 'count' }],
              active: [{ $match: { isActive: true } }, { $count: 'count' }],
              inactive: [{ $match: { isActive: false } }, { $count: 'count' }],
              byDeviceType: [
                {
                  $group: {
                    _id: '$deviceType',
                    count: { $sum: 1 },
                  },
                },
              ],
              byBrowser: [
                {
                  $group: {
                    _id: '$browser',
                    count: { $sum: 1 },
                  },
                },
              ],
            },
          },
        ])
        .toArray();

      const result = stats[0];

      return {
        totalSubscriptions: result.total[0]?.count || 0,
        activeSubscriptions: result.active[0]?.count || 0,
        inactiveSubscriptions: result.inactive[0]?.count || 0,
        byDeviceType: result.byDeviceType.reduce(
          (acc: Record<string, number>, item: any) => {
            acc[item._id || 'unknown'] = item.count;
            return acc;
          },
          {}
        ),
        byBrowser: result.byBrowser.reduce(
          (acc: Record<string, number>, item: any) => {
            acc[item._id || 'unknown'] = item.count;
            return acc;
          },
          {}
        ),
      };
    } catch (error) {
      log.error('Failed to get subscription statistics', { error });
      throw error;
    }
  }

  /**
   * Get subscriptions with high error rates
   */
  async getProblematicSubscriptions(
    errorThreshold: number = 3
  ): Promise<SubscriptionRecord[]> {
    try {
      const collection = await this.getCollection();

      const subscriptions = await collection
        .find({
          errorCount: { $gte: errorThreshold },
        })
        .sort({ errorCount: -1 })
        .toArray();

      return subscriptions;
    } catch (error) {
      log.error('Failed to get problematic subscriptions', { error });
      throw error;
    }
  }
}

export const pushSubscriptionManager = new PushSubscriptionManager();

export default PushSubscriptionManager;
