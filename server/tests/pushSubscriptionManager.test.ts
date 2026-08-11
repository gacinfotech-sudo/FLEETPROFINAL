/**
 * Push Subscription Manager Tests
 * Test suite for subscription registration, storage, and lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { pushSubscriptionManager } from '../utils/pushSubscriptionManager';
import mongoose from 'mongoose';

describe('Push Subscription Manager', () => {
  let userId: string;
  let testSubscription: any;

  beforeEach(() => {
    userId = new ObjectId().toString();
    testSubscription = {
      endpoint: 'https://fcm.googleapis.com/test-endpoint',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
      },
      expirationTime: null,
    };
  });

  describe('Subscribe', () => {
    it('should register a new subscription', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({
          matchedCount: 1,
          upsertedId: null,
          modifiedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.subscribe(
        userId,
        testSubscription,
        {
          type: 'web',
          browser: 'Chrome',
          platform: 'Windows',
        }
      );

      expect(result.userId.toString()).toBe(userId);
      expect(result.endpoint).toBe(testSubscription.endpoint);
      expect(result.isActive).toBe(true);
      expect(result.deviceType).toBe('web');
    });

    it('should update existing subscription', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({
          matchedCount: 1,
          upsertedId: null,
          modifiedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.subscribe(
        userId,
        testSubscription
      );

      expect(result.endpoint).toBe(testSubscription.endpoint);
      expect(mockCollection.updateOne).toHaveBeenCalled();
    });

    it('should track device information', async () => {
      const deviceInfo = {
        type: 'mobile' as const,
        name: 'iPhone 12',
        userAgent: 'Mozilla/5.0...',
        platform: 'iOS',
        browser: 'Safari',
      };

      const mockCollection = {
        createIndex: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({
          matchedCount: 1,
          upsertedId: null,
          modifiedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.subscribe(
        userId,
        testSubscription,
        deviceInfo
      );

      expect(result.deviceType).toBe('mobile');
      expect(result.deviceName).toBe('iPhone 12');
      expect(result.platform).toBe('iOS');
    });
  });

  describe('Unsubscribe', () => {
    it('should remove subscription by endpoint', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        deleteOne: vi.fn().mockResolvedValue({
          deletedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.unsubscribe(
        userId,
        testSubscription.endpoint
      );

      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalled();
    });

    it('should handle non-existent subscription', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        deleteOne: vi.fn().mockResolvedValue({
          deletedCount: 0,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.unsubscribe(
        userId,
        'non-existent-endpoint'
      );

      expect(result).toBe(false);
    });
  });

  describe('Unsubscribe All', () => {
    it('should remove all subscriptions for user', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({
          deletedCount: 3,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.unsubscribeAll(userId);

      expect(result).toBe(3);
    });

    it('should return 0 if no subscriptions exist', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({
          deletedCount: 0,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.unsubscribeAll(userId);

      expect(result).toBe(0);
    });
  });

  describe('Get User Subscriptions', () => {
    it('should retrieve all active subscriptions for user', async () => {
      const mockSubscriptions = [
        {
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          endpoint: 'https://fcm.googleapis.com/endpoint1',
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
        {
          _id: new ObjectId(),
          userId: new ObjectId(userId),
          endpoint: 'https://fcm.googleapis.com/endpoint2',
          isActive: true,
          deviceType: 'mobile',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      const mockCollection = {
        createIndex: vi.fn(),
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockSubscriptions),
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getUserSubscriptions(userId);

      expect(result).toHaveLength(2);
      expect(result[0].deviceType).toBe('web');
      expect(result[1].deviceType).toBe('mobile');
    });

    it('should return empty array if no subscriptions exist', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getUserSubscriptions(userId);

      expect(result).toHaveLength(0);
    });
  });

  describe('Get Subscription by Endpoint', () => {
    it('should retrieve subscription by endpoint', async () => {
      const mockSubscription = {
        _id: new ObjectId(),
        endpoint: testSubscription.endpoint,
        userId: new ObjectId(userId),
        isActive: true,
        keys: testSubscription.keys,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        errorCount: 0,
      };

      const mockCollection = {
        createIndex: vi.fn(),
        findOne: vi.fn().mockResolvedValue(mockSubscription),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getSubscriptionByEndpoint(
        testSubscription.endpoint
      );

      expect(result?.endpoint).toBe(testSubscription.endpoint);
      expect(result?.isActive).toBe(true);
    });

    it('should return null if subscription not found', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        findOne: vi.fn().mockResolvedValue(null),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getSubscriptionByEndpoint(
        'non-existent'
      );

      expect(result).toBeNull();
    });
  });

  describe('Mark as Invalid', () => {
    it('should mark subscription as inactive', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({
          modifiedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.markAsInvalid(
        testSubscription.endpoint,
        'Test error'
      );

      expect(result).toBe(true);
    });
  });

  describe('Update Last Used', () => {
    it('should update last used timestamp', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({
          modifiedCount: 1,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.updateLastUsed(
        testSubscription.endpoint
      );

      expect(result).toBe(true);
    });
  });

  describe('Get Statistics', () => {
    it('should return subscription statistics', async () => {
      const mockStats = [
        {
          total: [{ count: 100 }],
          active: [{ count: 85 }],
          inactive: [{ count: 15 }],
          byDeviceType: [
            { _id: 'web', count: 60 },
            { _id: 'mobile', count: 25 },
          ],
          byBrowser: [
            { _id: 'Chrome', count: 50 },
            { _id: 'Safari', count: 35 },
          ],
        },
      ];

      const mockCollection = {
        createIndex: vi.fn(),
        aggregate: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockStats),
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getStatistics();

      expect(result.totalSubscriptions).toBe(100);
      expect(result.activeSubscriptions).toBe(85);
      expect(result.inactiveSubscriptions).toBe(15);
      expect(result.byDeviceType['web']).toBe(60);
    });
  });

  describe('Cleanup Invalid Subscriptions', () => {
    it('should remove invalid and expired subscriptions', async () => {
      const mockCollection = {
        createIndex: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({
          deletedCount: 5,
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.cleanupInvalidSubscriptions();

      expect(result).toBe(5);
    });
  });

  describe('Get Multiple User Subscriptions', () => {
    it('should retrieve subscriptions for multiple users', async () => {
      const userIds = [
        new ObjectId().toString(),
        new ObjectId().toString(),
      ];

      const mockSubscriptions = [
        {
          _id: new ObjectId(),
          userId: new ObjectId(userIds[0]),
          endpoint: 'https://fcm.googleapis.com/endpoint1',
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
        {
          _id: new ObjectId(),
          userId: new ObjectId(userIds[1]),
          endpoint: 'https://fcm.googleapis.com/endpoint2',
          isActive: true,
          deviceType: 'mobile',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      const mockCollection = {
        createIndex: vi.fn(),
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockSubscriptions),
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getMultipleUserSubscriptions(userIds);

      expect(result.size).toBe(2);
      expect(result.get(userIds[0])).toHaveLength(1);
      expect(result.get(userIds[1])).toHaveLength(1);
    });
  });

  describe('Get Problematic Subscriptions', () => {
    it('should retrieve subscriptions with high error rates', async () => {
      const mockSubscriptions = [
        {
          _id: new ObjectId(),
          endpoint: 'https://fcm.googleapis.com/endpoint1',
          isActive: false,
          errorCount: 5,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
        {
          _id: new ObjectId(),
          endpoint: 'https://fcm.googleapis.com/endpoint2',
          isActive: false,
          errorCount: 4,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        },
      ];

      const mockCollection = {
        createIndex: vi.fn(),
        find: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(mockSubscriptions),
          }),
        }),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue({
        collection: vi.fn().mockReturnValue(mockCollection),
      } as any);

      const result = await pushSubscriptionManager.getProblematicSubscriptions(3);

      expect(result).toHaveLength(2);
      expect(result[0].errorCount).toBe(5);
    });
  });
});
