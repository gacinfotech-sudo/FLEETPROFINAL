// Tests for Notification Preferences API
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { notificationPreferenceManager } from '../utils/notificationPreferences';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationPreferencesTest');

describe('Notification Preferences API', () => {
  let app: express.Application;
  const testUserId = 'test-user-' + Date.now();

  beforeAll(async () => {
    // Setup express app with routes
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.userId = testUserId;
      next();
    });

    // Import and use notification preferences routes
    const router = (await import('../routes/notification-preferences')).default;
    app.use('/api/notification-preferences', router);
  });

  afterAll(async () => {
    // Cleanup
    try {
      const db = mongoose.connection.db!;
      const collection = db.collection('notification_preferences');
      await collection.deleteOne({ userId: testUserId });
    } catch (error) {
      log.error('Cleanup failed', { error });
    }
  });

  describe('GET /api/notification-preferences/:userId', () => {
    it('should fetch user preferences', async () => {
      const response = await request(app)
        .get(`/api/notification-preferences/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.preferences).toBeDefined();
      expect(response.body.preferences.userId).toBe(testUserId);
    });

    it('should return default preferences for new user', async () => {
      const response = await request(app)
        .get(`/api/notification-preferences/${testUserId}`)
        .expect(200);

      const prefs = response.body.preferences;
      expect(prefs.globalEnabled).toBe(true);
      expect(prefs.globalChannels).toContain('push');
      expect(prefs.unsubscribedFrom).toEqual([]);
    });

    it('should forbid accessing other user preferences', async () => {
      const otherUserId = 'other-user-' + Date.now();

      // Mock different user
      app.use((req: any, res, next) => {
        req.userId = 'different-user';
        next();
      });

      const response = await request(app)
        .get(`/api/notification-preferences/${otherUserId}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('PUT /api/notification-preferences/:userId', () => {
    it('should update global preferences', async () => {
      const updates = {
        globalEnabled: false,
        globalChannels: ['email', 'sms']
      };

      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.preferences.globalEnabled).toBe(false);
      expect(response.body.preferences.globalChannels).toContain('email');
    });

    it('should validate globalEnabled as boolean', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ globalEnabled: 'true' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should validate globalChannels as array', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ globalChannels: 'push' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should validate quietHoursStart format', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ quietHoursStart: '22-00' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should validate quietHoursEnd format', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ quietHoursEnd: '08:00:00' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should accept valid HH:MM format', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00'
        })
        .expect(200);

      const prefs = response.body.preferences;
      expect(prefs.quietHoursEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('22:00');
      expect(prefs.quietHoursEnd).toBe('08:00');
    });
  });

  describe('POST /api/notification-preferences/:userId/reset-defaults', () => {
    it('should reset preferences to defaults', async () => {
      // First, modify preferences
      await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ globalEnabled: false })
        .expect(200);

      // Then reset
      const response = await request(app)
        .post(`/api/notification-preferences/${testUserId}/reset-defaults`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.preferences.globalEnabled).toBe(true);
    });
  });

  describe('PUT /api/notification-preferences/:userId/quiet-hours', () => {
    it('should update quiet hours', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/quiet-hours`)
        .send({
          start: '23:00',
          end: '07:00',
          timezone: 'IST',
          enabled: true
        })
        .expect(200);

      const prefs = response.body.preferences;
      expect(prefs.quietHoursEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('23:00');
      expect(prefs.quietHoursEnd).toBe('07:00');
      expect(prefs.quietHoursTimezone).toBe('IST');
    });

    it('should disable quiet hours', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/quiet-hours`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.preferences.quietHoursEnabled).toBe(false);
    });

    it('should validate time format', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/quiet-hours`)
        .send({
          start: '23:60', // invalid minute
          end: '07:00',
          enabled: true
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('PUT /api/notification-preferences/:userId/category/:category', () => {
    it('should update category preferences', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/category/booking`)
        .send({
          enabled: false,
          channels: []
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.preferences.categories.booking.enabled).toBe(false);
    });

    it('should validate enabled is boolean', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/category/booking`)
        .send({ enabled: 'true' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should validate channels is array', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/category/booking`)
        .send({ enabled: true, channels: 'push' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should update category with multiple channels', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/category/payment`)
        .send({
          enabled: true,
          channels: ['push', 'email', 'sms']
        })
        .expect(200);

      const paymentCat = response.body.preferences.categories.payment;
      expect(paymentCat.channels).toContain('push');
      expect(paymentCat.channels).toContain('email');
      expect(paymentCat.channels).toContain('sms');
    });
  });

  describe('PUT /api/notification-preferences/:userId/frequency-caps', () => {
    it('should update daily frequency cap', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/frequency-caps`)
        .send({ dailyCap: 50 })
        .expect(200);

      expect(response.body.preferences.dailyFrequencyCap).toBe(50);
    });

    it('should update hourly frequency cap', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/frequency-caps`)
        .send({ hourlyCap: 10 })
        .expect(200);

      expect(response.body.preferences.hourlyFrequencyCap).toBe(10);
    });

    it('should update both caps', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/frequency-caps`)
        .send({ dailyCap: 100, hourlyCap: 20 })
        .expect(200);

      expect(response.body.preferences.dailyFrequencyCap).toBe(100);
      expect(response.body.preferences.hourlyFrequencyCap).toBe(20);
    });

    it('should validate dailyCap is number', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/frequency-caps`)
        .send({ dailyCap: '50' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    it('should validate hourlyCap is number', async () => {
      const response = await request(app)
        .put(`/api/notification-preferences/${testUserId}/frequency-caps`)
        .send({ hourlyCap: '10' })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('POST /api/notification-preferences/:userId/unsubscribe/:category', () => {
    it('should unsubscribe from category', async () => {
      const response = await request(app)
        .post(`/api/notification-preferences/${testUserId}/unsubscribe/promo`)
        .expect(200);

      expect(response.body.preferences.unsubscribedFrom).toContain('promo');
    });

    it('should prevent duplicate unsubscription', async () => {
      // First unsubscribe
      await request(app)
        .post(`/api/notification-preferences/${testUserId}/unsubscribe/alert`)
        .expect(200);

      // Second unsubscribe
      const response = await request(app)
        .post(`/api/notification-preferences/${testUserId}/unsubscribe/alert`)
        .expect(200);

      const count = (response.body.preferences.unsubscribedFrom as string[]).filter(
        c => c === 'alert'
      ).length;
      expect(count).toBe(1);
    });
  });

  describe('POST /api/notification-preferences/:userId/resubscribe/:category', () => {
    it('should resubscribe to category', async () => {
      // First unsubscribe
      await request(app)
        .post(`/api/notification-preferences/${testUserId}/unsubscribe/reminder`)
        .expect(200);

      // Then resubscribe
      const response = await request(app)
        .post(`/api/notification-preferences/${testUserId}/resubscribe/reminder`)
        .expect(200);

      expect(response.body.preferences.unsubscribedFrom).not.toContain('reminder');
    });
  });

  describe('Preference persistence', () => {
    it('should persist preferences across requests', async () => {
      // Set preferences
      const updates = {
        globalEnabled: false,
        dailyFrequencyCap: 100,
        quietHoursEnabled: true,
        quietHoursStart: '22:30',
        quietHoursEnd: '06:30'
      };

      await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send(updates)
        .expect(200);

      // Fetch and verify
      const response = await request(app)
        .get(`/api/notification-preferences/${testUserId}`)
        .expect(200);

      const prefs = response.body.preferences;
      expect(prefs.globalEnabled).toBe(false);
      expect(prefs.dailyFrequencyCap).toBe(100);
      expect(prefs.quietHoursEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('22:30');
      expect(prefs.quietHoursEnd).toBe('06:30');
    });

    it('should maintain other preferences when updating specific ones', async () => {
      // Set initial preferences
      await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({
          dailyFrequencyCap: 50,
          hourlyFrequencyCap: 10
        })
        .expect(200);

      // Update only daily cap
      await request(app)
        .put(`/api/notification-preferences/${testUserId}`)
        .send({ dailyFrequencyCap: 100 })
        .expect(200);

      // Verify hourly cap unchanged
      const response = await request(app)
        .get(`/api/notification-preferences/${testUserId}`)
        .expect(200);

      expect(response.body.preferences.hourlyFrequencyCap).toBe(10);
    });
  });
});
