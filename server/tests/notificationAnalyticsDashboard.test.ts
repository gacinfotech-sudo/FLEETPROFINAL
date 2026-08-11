import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  notificationAnalytics,
  DeliveryStatus,
  NotificationRecord,
  AnalyticsMetrics,
  ChannelMetrics,
  EventTypeMetrics,
  TimeSeriesPoint,
  EngagementTrend,
  UserEngagement,
} from '../utils/notificationAnalytics';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationAnalyticsTest');

describe('Notification Analytics Dashboard', () => {
  let db: any;

  beforeEach(async () => {
    // Mock database connection
    db = mongoose.connection.db;
    if (!db) {
      log.warn('Database not available for tests');
    }
  });

  afterEach(async () => {
    // Cleanup
    if (db) {
      try {
        const collection = db.collection('notification_logs');
        await collection.deleteMany({});
      } catch (error) {
        log.warn('Cleanup error', { error });
      }
    }
  });

  describe('Metrics Calculation', () => {
    it('should calculate delivery success rate', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      // Insert test data
      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.FAILED,
          channel: 'sms',
          eventType: 'test',
          sentAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const metrics = await notificationAnalytics.getMetrics();

      expect(metrics.totalSent).toBe(2);
      expect(metrics.totalDelivered).toBe(1);
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.deliveryRate).toBe(50);
    });

    it('should calculate bounce rate', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.BOUNCED,
          channel: 'email',
          eventType: 'test',
          sentAt: new Date(),
          bouncedAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const metrics = await notificationAnalytics.getMetrics();

      expect(metrics.totalBounced).toBe(1);
      expect(metrics.bounceRate).toBe(50);
    });

    it('should calculate click-through rate', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.CLICKED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          clickedAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const metrics = await notificationAnalytics.getMetrics();

      expect(metrics.totalClicked).toBe(1);
      expect(metrics.totalDelivered).toBe(2);
      expect(metrics.clickThroughRate).toBe(50);
    });

    it('should calculate average delivery time', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      const sentAt1 = new Date('2024-01-01T00:00:00Z');
      const deliveredAt1 = new Date('2024-01-01T00:00:05Z'); // 5 seconds
      const sentAt2 = new Date('2024-01-01T00:01:00Z');
      const deliveredAt2 = new Date('2024-01-01T00:01:15Z'); // 15 seconds

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: sentAt1,
          deliveredAt: deliveredAt1,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: sentAt2,
          deliveredAt: deliveredAt2,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const metrics = await notificationAnalytics.getMetrics();

      // Average of 5000ms and 15000ms = 10000ms
      expect(metrics.averageDeliveryTime).toBe(10000);
    });

    it('should calculate retry success rate', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.DELIVERED,
          channel: 'sms',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 2, // Was retried
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.FAILED,
          channel: 'sms',
          eventType: 'test',
          sentAt: new Date(),
          retryCount: 3, // Was retried to max
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const metrics = await notificationAnalytics.getMetrics();

      // 1 successful out of 2 retried
      expect(metrics.retrySuccessRate).toBe(50);
    });
  });

  describe('Channel Metrics', () => {
    it('should calculate metrics per channel', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.FAILED,
          channel: 'sms',
          eventType: 'test',
          sentAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const channels = await notificationAnalytics.getChannelMetrics();

      expect(channels.length).toBe(2);

      const emailChannel = channels.find((c) => c.channel === 'email');
      expect(emailChannel?.totalSent).toBe(1);
      expect(emailChannel?.totalDelivered).toBe(1);
      expect(emailChannel?.deliveryRate).toBe(100);

      const smsChannel = channels.find((c) => c.channel === 'sms');
      expect(smsChannel?.totalSent).toBe(1);
      expect(smsChannel?.totalFailed).toBe(1);
      expect(smsChannel?.deliveryRate).toBe(0);
    });

    it('should calculate click-through rate per channel', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.CLICKED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          clickedAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const channels = await notificationAnalytics.getChannelMetrics();

      const pushChannel = channels.find((c) => c.channel === 'push');
      expect(pushChannel?.totalClicked).toBe(1);
      expect(pushChannel?.clickThroughRate).toBe(50);
    });
  });

  describe('Event Type Metrics', () => {
    it('should calculate metrics per event type', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Booking',
          body: 'New booking',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'booking_confirmation',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Payment',
          body: 'Payment received',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'payment_confirmation',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const eventTypes = await notificationAnalytics.getEventTypeMetrics();

      expect(eventTypes.length).toBe(2);
      expect(eventTypes.find((e) => e.eventType === 'booking_confirmation')).toBeDefined();
      expect(eventTypes.find((e) => e.eventType === 'payment_confirmation')).toBeDefined();
    });
  });

  describe('Time Series Data', () => {
    it('should generate time series data', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: yesterday,
          deliveredAt: yesterday,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: yesterday,
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'email',
          eventType: 'test',
          sentAt: now,
          deliveredAt: now,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: now,
        },
      ]);

      const timeSeries = await notificationAnalytics.getTimeSeriesData(
        new Date(now.getTime() - 48 * 60 * 60 * 1000),
        now,
        1440
      );

      expect(timeSeries.length).toBeGreaterThan(0);
      expect(timeSeries[0]).toHaveProperty('timestamp');
      expect(timeSeries[0]).toHaveProperty('sent');
      expect(timeSeries[0]).toHaveProperty('delivered');
    });
  });

  describe('User Engagement Metrics', () => {
    it('should calculate user engagement metrics', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Test 1',
          body: 'Body 1',
          status: DeliveryStatus.CLICKED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          clickedAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
        {
          notificationId: '2',
          userId: 'user1',
          title: 'Test 2',
          body: 'Body 2',
          status: DeliveryStatus.DELIVERED,
          channel: 'push',
          eventType: 'test',
          sentAt: new Date(),
          deliveredAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
          createdAt: new Date(),
        },
      ]);

      const engagement = await notificationAnalytics.getUserEngagementMetrics(
        undefined,
        undefined,
        10
      );

      expect(engagement.length).toBe(1);
      expect(engagement[0].userId).toBe('user1');
      expect(engagement[0].totalReceived).toBe(2);
      expect(engagement[0].totalClicked).toBe(1);
      expect(engagement[0].engagementRate).toBe(50);
    });
  });

  describe('Recording Events', () => {
    it('should record notification sent', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const id = await notificationAnalytics.recordNotificationSent(
        'notif-1',
        'user-1',
        'Test Title',
        'Test Body',
        'targeted',
        'admin',
        ['test'],
        { custom: 'data' },
        'email',
        'booking_confirmation'
      );

      expect(id).toBeTruthy();

      const collection = db.collection('notification_logs');
      const record = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

      expect(record?.notificationId).toBe('notif-1');
      expect(record?.userId).toBe('user-1');
      expect(record?.channel).toBe('email');
      expect(record?.eventType).toBe('booking_confirmation');
      expect(record?.status).toBe('sent');
    });

    it('should record delivery', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const id = await notificationAnalytics.recordNotificationSent(
        'notif-1',
        'user-1',
        'Test',
        'Body',
        'targeted',
        undefined,
        [],
        {},
        'sms'
      );

      const success = await notificationAnalytics.recordDelivery(id, 'endpoint@example.com');

      expect(success).toBe(true);

      const collection = db.collection('notification_logs');
      const record = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

      expect(record?.status).toBe('delivered');
      expect(record?.deliveredAt).toBeTruthy();
    });

    it('should record click', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const id = await notificationAnalytics.recordNotificationSent(
        'notif-1',
        'user-1',
        'Test',
        'Body',
        'targeted'
      );

      await notificationAnalytics.recordDelivery(id);
      const success = await notificationAnalytics.recordClick(id);

      expect(success).toBe(true);

      const collection = db.collection('notification_logs');
      const record = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

      expect(record?.status).toBe('clicked');
      expect(record?.clickedAt).toBeTruthy();
    });

    it('should record bounce', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const id = await notificationAnalytics.recordNotificationSent(
        'notif-1',
        'user-1',
        'Test',
        'Body',
        'targeted',
        undefined,
        [],
        {},
        'email'
      );

      const success = await notificationAnalytics.recordBounce(id, 'Hard bounce');

      expect(success).toBe(true);

      const collection = db.collection('notification_logs');
      const record = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

      expect(record?.status).toBe('bounced');
      expect(record?.bouncedAt).toBeTruthy();
      expect(record?.failureReason).toBe('Hard bounce');
    });

    it('should record failure with retry', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const id = await notificationAnalytics.recordNotificationSent(
        'notif-1',
        'user-1',
        'Test',
        'Body',
        'targeted'
      );

      const success = await notificationAnalytics.recordFailure(id, 'Connection timeout', true);

      expect(success).toBe(true);

      const collection = db.collection('notification_logs');
      const record = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });

      expect(record?.status).toBe('pending'); // Should retry
      expect(record?.retryCount).toBe(1);
    });
  });

  describe('Data Cleanup', () => {
    it('should cleanup old records', async () => {
      if (!db) {
        log.warn('Skipping test - no database');
        return;
      }

      const collection = db.collection('notification_logs');

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      await collection.insertMany([
        {
          notificationId: '1',
          userId: 'user1',
          title: 'Old',
          body: 'Body',
          status: 'delivered',
          channel: 'email',
          eventType: 'test',
          sentAt: oldDate,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
        },
        {
          notificationId: '2',
          userId: 'user2',
          title: 'Recent',
          body: 'Body',
          status: 'delivered',
          channel: 'email',
          eventType: 'test',
          sentAt: recentDate,
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          metadata: {},
        },
      ]);

      const deleted = await notificationAnalytics.cleanupOldRecords(30);

      expect(deleted).toBe(1);

      const remaining = await collection.countDocuments({});
      expect(remaining).toBe(1);
    });
  });
});
