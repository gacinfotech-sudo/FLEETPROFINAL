// Push Notifications API Endpoints
import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { vapidManager } from '../utils/vapidConfig';
import { notificationAnalytics } from '../utils/notificationAnalytics';
import { createLogger } from '../utils/logger';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const log = createLogger('NotificationsAPI');
const router = express.Router();

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// GET /api/notifications/config
// Returns VAPID public key for client subscription
router.get('/config', (_req: Request, res: Response) => {
  const publicKey = vapidManager.getPublicKey();

  if (!publicKey) {
    return res.status(503).json({
      error: 'Push notifications not configured',
      message: 'VAPID keys are not set up on the server',
    });
  }

  res.json({ publicKey });
  log.info('VAPID config requested');
});

// POST /api/notifications/subscribe
// Save push subscription for authenticated user
router.post('/subscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { endpoint, keys } = req.body as PushSubscription;
    const userId = (req as any).userId;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        error: 'Invalid subscription data',
        message: 'endpoint and keys (p256dh, auth) are required',
      });
    }

    const usersCollection = mongoose.connection.db!.collection('users');

    // Update user with push subscription
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          pushSubscription: {
            endpoint,
            keys: {
              p256dh: keys.p256dh,
              auth: keys.auth,
            },
            subscribedAt: new Date(),
          },
          notificationsEnabled: true,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    log.info('Push subscription registered', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...',
    });

    res.json({
      success: true,
      message: 'Subscription saved successfully',
    });
  } catch (error) {
    log.error('Failed to save subscription', { error });
    res.status(500).json({
      error: 'Failed to save subscription',
      message: (error as Error).message,
    });
  }
});

// POST /api/notifications/unsubscribe
// Remove push subscription for authenticated user
router.post('/unsubscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const usersCollection = mongoose.connection.db!.collection('users');

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: { pushSubscription: 1 },
        $set: { notificationsEnabled: false },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    log.info('Push subscription removed', { userId });

    res.json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (error) {
    log.error('Failed to unsubscribe', { error });
    res.status(500).json({
      error: 'Failed to unsubscribe',
      message: (error as Error).message,
    });
  }
});

// POST /api/notifications/send
// Send push notification to specific users (admin only)
router.post('/send', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userIds, title, body, icon, badge, tag, data } = req.body;
    const userId = (req as any).userId;

    const usersCollection = mongoose.connection.db!.collection('users');

    // Check if requester is admin
    const requester = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can send push notifications',
      });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userIds array is required',
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title and body are required',
      });
    }

    // Find all subscriptions for target users
    const objectIds = userIds.map((id: string) => new ObjectId(id));

    const users = await usersCollection
      .find({
        _id: { $in: objectIds },
        pushSubscription: { $exists: true },
        notificationsEnabled: true,
      })
      .toArray();

    if (users.length === 0) {
      return res.status(400).json({
        error: 'No valid subscriptions found',
        message: 'No users have active push subscriptions',
      });
    }

    const subscriptions = users.map((user: any) => user.pushSubscription);

    // Generate unique notification ID
    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare notification payload
    const payload = {
      title: title || 'FleetPro Notification',
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-192x192.png',
      tag: tag || 'fleetpro-notification',
      data: { ...data, notificationId },
      vibrate: [200, 100, 200],
    };

    // Record notifications in analytics (before sending)
    const analyticsRecords: { [key: string]: string } = {};
    for (const user of users) {
      try {
        const logId = await notificationAnalytics.recordNotificationSent(
          notificationId,
          user._id.toString(),
          title,
          body,
          'targeted',
          undefined,
          ['sent-via-api'],
          { tags: tag ? [tag] : [] }
        );
        analyticsRecords[user._id.toString()] = logId;
      } catch (err) {
        log.warn('Failed to record notification in analytics', { error: err });
      }
    }

    // Send notifications
    const results = await vapidManager.sendBulkPushNotifications(subscriptions, payload);

    // Mark invalid subscriptions for cleanup
    if (results.invalidated.length > 0) {
      await usersCollection.updateMany(
        { 'pushSubscription.endpoint': { $in: results.invalidated } },
        { $unset: { pushSubscription: 1 } }
      );

      log.info('Cleaned up invalid subscriptions', {
        count: results.invalidated.length,
      });
    }

    log.info('Push notifications sent', {
      requested: userIds.length,
      found: users.length,
      ...results,
    });

    res.json({
      success: true,
      message: 'Notifications sent',
      notificationId,
      results: {
        requested: userIds.length,
        found: users.length,
        sent: results.sent,
        failed: results.failed,
      },
      analytics: {
        recordedCount: Object.keys(analyticsRecords).length,
        trackingUrl: `/api/notification-analytics/notifications/${notificationId}`,
      },
    });
  } catch (error) {
    log.error('Failed to send notifications', { error });
    res.status(500).json({
      error: 'Failed to send notifications',
      message: (error as Error).message,
    });
  }
});

// POST /api/notifications/broadcast
// Send push notification to all users (admin only)
router.post('/broadcast', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, icon, badge, tag, data, targetRole } = req.body;
    const userId = (req as any).userId;

    const usersCollection = mongoose.connection.db!.collection('users');

    // Check if requester is admin
    const requester = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can broadcast notifications',
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title and body are required',
      });
    }

    // Build filter
    const filter: any = {
      pushSubscription: { $exists: true },
      notificationsEnabled: true,
    };

    if (targetRole) {
      filter.role = targetRole;
    }

    // Find all subscriptions
    const users = await usersCollection.find(filter).toArray();

    if (users.length === 0) {
      return res.status(400).json({
        error: 'No valid subscriptions found',
        message: 'No users have active push subscriptions',
      });
    }

    const subscriptions = users.map((user: any) => user.pushSubscription);

    // Generate unique notification ID
    const notificationId = `notif-broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare notification payload
    const payload = {
      title: title || 'FleetPro Notification',
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-192x192.png',
      tag: tag || 'fleetpro-broadcast',
      data: { ...data, notificationId },
      vibrate: [200, 100, 200],
    };

    // Record notifications in analytics (before sending)
    const analyticsRecords: { [key: string]: string } = {};
    for (const user of users) {
      try {
        const logId = await notificationAnalytics.recordNotificationSent(
          notificationId,
          user._id.toString(),
          title,
          body,
          'broadcast',
          targetRole,
          ['broadcast'],
          { tags: tag ? [tag] : [] }
        );
        analyticsRecords[user._id.toString()] = logId;
      } catch (err) {
        log.warn('Failed to record notification in analytics', { error: err });
      }
    }

    // Send notifications
    const results = await vapidManager.sendBulkPushNotifications(subscriptions, payload);

    // Mark invalid subscriptions for cleanup
    if (results.invalidated.length > 0) {
      await usersCollection.updateMany(
        { 'pushSubscription.endpoint': { $in: results.invalidated } },
        { $unset: { pushSubscription: 1 } }
      );
    }

    log.info('Broadcast notification sent', {
      total: users.length,
      targetRole: targetRole || 'all',
      ...results,
    });

    res.json({
      success: true,
      message: 'Broadcast notification sent',
      notificationId,
      results: {
        total: users.length,
        targetRole: targetRole || 'all',
        sent: results.sent,
        failed: results.failed,
      },
      analytics: {
        recordedCount: Object.keys(analyticsRecords).length,
        trackingUrl: `/api/notification-analytics/notifications/${notificationId}`,
      },
    });
  } catch (error) {
    log.error('Failed to broadcast notification', { error });
    res.status(500).json({
      error: 'Failed to broadcast notification',
      message: (error as Error).message,
    });
  }
});

// GET /api/notifications/status
// Get push notification status for authenticated user
router.get('/status', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const usersCollection = mongoose.connection.db!.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      notificationsEnabled: user.notificationsEnabled || false,
      subscribed: !!user.pushSubscription,
      subscribedAt: user.pushSubscription?.subscribedAt || null,
      vpaidConfigured: !!vapidManager.isConfigured(),
    });

    log.info('Notification status requested', { userId });
  } catch (error) {
    log.error('Failed to get notification status', { error });
    res.status(500).json({
      error: 'Failed to get status',
      message: (error as Error).message,
    });
  }
});

export default router;
