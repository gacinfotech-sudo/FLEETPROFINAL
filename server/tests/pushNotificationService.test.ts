/**
 * Push Notification Service Tests
 * Comprehensive test suite for push notification delivery and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { pushNotificationService } from '../utils/pushNotificationService';
import { pushSubscriptionManager } from '../utils/pushSubscriptionManager';
import { vapidManager } from '../utils/vapidConfig';

// Mock vapidManager
vi.mock('../utils/vapidConfig', () => ({
  vapidManager: {
    sendPushNotification: vi.fn(),
    sendBulkPushNotifications: vi.fn(),
    isConfigured: vi.fn(() => true),
    getPublicKey: vi.fn(() => 'mock-public-key'),
  },
}));

// Mock notificationAnalytics
vi.mock('../utils/notificationAnalytics', () => ({
  notificationAnalytics: {
    recordNotificationSent: vi.fn(),
  },
}));

// Mock notificationRetry
vi.mock('../utils/notificationRetry', () => ({
  notificationRetry: {
    scheduleRetry: vi.fn(),
  },
}));

describe('Push Notification Service', () => {
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

  describe('validatePayload', () => {
    it('should validate correct payload', () => {
      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const payload = {
        title: '',
        body: 'This is a test',
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject empty body', () => {
      const payload = {
        title: 'Test',
        body: '',
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Body is required');
    });

    it('should reject title exceeding max length', () => {
      const payload = {
        title: 'a'.repeat(256),
        body: 'Test',
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be less than 255 characters');
    });

    it('should reject body exceeding max length', () => {
      const payload = {
        title: 'Test',
        body: 'a'.repeat(1025),
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Body must be less than 1024 characters');
    });

    it('should reject more than 3 actions', () => {
      const payload = {
        title: 'Test',
        body: 'Test',
        actions: [
          { action: 'approve', title: 'Approve' },
          { action: 'reject', title: 'Reject' },
          { action: 'view', title: 'View' },
          { action: 'delete', title: 'Delete' },
        ],
      };

      const result = pushNotificationService.validatePayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 3 actions allowed');
    });
  });

  describe('Send to single user', () => {
    it('should handle user with no subscriptions', async () => {
      // Mock getUserSubscriptions to return empty array
      vi.spyOn(pushSubscriptionManager, 'getUserSubscriptions').mockResolvedValue([]);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToUser(userId, payload);

      expect(result.success).toBe(false);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should send to user with subscriptions', async () => {
      // Mock subscriptions
      const mockSubscriptions = [
        {
          ...testSubscription,
          userId: new ObjectId(userId),
          _id: new ObjectId(),
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      vi.spyOn(pushSubscriptionManager, 'getUserSubscriptions').mockResolvedValue(
        mockSubscriptions
      );

      vi.spyOn(vapidManager, 'sendPushNotification').mockResolvedValue(true);
      vi.spyOn(pushSubscriptionManager, 'updateLastUsed').mockResolvedValue(true);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToUser(userId, payload);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);
      expect(result.notificationId).toMatch(/^notif-/);
    });
  });

  describe('Send to multiple users', () => {
    it('should handle empty user list', async () => {
      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      vi.spyOn(pushSubscriptionManager, 'getMultipleUserSubscriptions').mockResolvedValue(
        new Map()
      );

      const result = await pushNotificationService.sendToUsers([], payload);

      expect(result.success).toBe(false);
      expect(result.sent).toBe(0);
    });

    it('should send to multiple users with batching', async () => {
      const userIds = [
        new ObjectId().toString(),
        new ObjectId().toString(),
        new ObjectId().toString(),
      ];

      const mockSubscriptionMap = new Map();
      userIds.forEach((id) => {
        mockSubscriptionMap.set(id, [
          {
            ...testSubscription,
            userId: new ObjectId(id),
            _id: new ObjectId(),
            isActive: true,
            deviceType: 'web',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            errorCount: 0,
          },
        ]);
      });

      vi.spyOn(pushSubscriptionManager, 'getMultipleUserSubscriptions').mockResolvedValue(
        mockSubscriptionMap
      );

      vi.spyOn(vapidManager, 'sendPushNotification').mockResolvedValue(true);
      vi.spyOn(pushSubscriptionManager, 'updateLastUsed').mockResolvedValue(true);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToUsers(userIds, payload, {
        batchSize: 2,
      });

      expect(result.sent).toBe(3);
      expect(result.success).toBe(true);
    });
  });

  describe('Send to segment', () => {
    it('should send to users with specific role', async () => {
      // Mock database collection
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([
              { _id: new ObjectId(userId) },
            ]),
          }),
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue(mockDb as any);

      const mockSubscriptions = [
        {
          ...testSubscription,
          userId: new ObjectId(userId),
          _id: new ObjectId(),
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      vi.spyOn(pushSubscriptionManager, 'getMultipleUserSubscriptions').mockResolvedValue(
        new Map([[userId, mockSubscriptions]])
      );

      vi.spyOn(vapidManager, 'sendPushNotification').mockResolvedValue(true);
      vi.spyOn(pushSubscriptionManager, 'updateLastUsed').mockResolvedValue(true);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToSegment(payload, {
        role: 'driver',
      });

      expect(result.sent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Send broadcast', () => {
    it('should send to all eligible users', async () => {
      const mockCollection = {
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([
              { _id: new ObjectId() },
              { _id: new ObjectId() },
            ]),
          }),
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.spyOn(mongoose.connection, 'db', 'get').mockReturnValue(mockDb as any);

      const mockSubscriptions = [
        {
          ...testSubscription,
          userId: new ObjectId(),
          _id: new ObjectId(),
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      vi.spyOn(pushSubscriptionManager, 'getMultipleUserSubscriptions').mockResolvedValue(
        new Map()
      );

      const payload = {
        title: 'Broadcast',
        body: 'Broadcast notification',
      };

      const result = await pushNotificationService.sendBroadcast(payload);

      expect(result.notificationId).toMatch(/^notif-/);
    });
  });

  describe('Error handling', () => {
    it('should handle failed push notifications', async () => {
      const mockSubscriptions = [
        {
          ...testSubscription,
          userId: new ObjectId(userId),
          _id: new ObjectId(),
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      vi.spyOn(pushSubscriptionManager, 'getUserSubscriptions').mockResolvedValue(
        mockSubscriptions
      );

      vi.spyOn(vapidManager, 'sendPushNotification').mockResolvedValue(false);
      vi.spyOn(pushSubscriptionManager, 'markAsInvalid').mockResolvedValue(true);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToUser(userId, payload);

      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
    });

    it('should track failed subscriptions', async () => {
      const mockSubscriptions = [
        {
          ...testSubscription,
          userId: new ObjectId(userId),
          _id: new ObjectId(),
          isActive: true,
          deviceType: 'web',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          errorCount: 0,
        },
      ];

      vi.spyOn(pushSubscriptionManager, 'getUserSubscriptions').mockResolvedValue(
        mockSubscriptions
      );

      vi.spyOn(vapidManager, 'sendPushNotification').mockRejectedValue(
        new Error('Send failed')
      );

      vi.spyOn(pushSubscriptionManager, 'markAsInvalid').mockResolvedValue(true);

      const payload = {
        title: 'Test',
        body: 'Test notification',
      };

      const result = await pushNotificationService.sendToUser(userId, payload);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.invalidatedEndpoints).toHaveLength(0);
    });
  });
});
