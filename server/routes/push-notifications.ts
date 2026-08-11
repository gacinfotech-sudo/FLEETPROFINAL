/**
 * Push Notifications API Routes
 * Comprehensive REST API for managing push subscriptions and sending notifications
 */

import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import { pushSubscriptionManager } from '../utils/pushSubscriptionManager';
import { pushNotificationService } from '../utils/pushNotificationService';
import { vapidManager } from '../utils/vapidConfig';
import { createLogger } from '../utils/logger';
import { authenticateUser, requireAdmin } from '../middleware/auth';

const log = createLogger('PushNotificationsAPI');
const router = express.Router();

/**
 * GET /api/push-notifications/config
 * Get VAPID configuration (public key)
 */
router.get('/config', (_req: Request, res: Response) => {
  try {
    const publicKey = vapidManager.getPublicKey();

    if (!publicKey) {
      return res.status(503).json({
        error: 'Push notifications not configured',
        message: 'VAPID keys are not set up on the server',
      });
    }

    res.json({ publicKey });
    log.debug('VAPID config requested');
  } catch (error) {
    log.error('Failed to get VAPID config', { error });
    res.status(500).json({
      error: 'Failed to get VAPID configuration',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/push-notifications/subscribe
 * Register a push subscription for the authenticated user
 */
router.post('/subscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { endpoint, keys, expirationTime, deviceInfo } = req.body;

    // Validate input
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        error: 'Invalid subscription data',
        message: 'endpoint and keys (p256dh, auth) are required',
      });
    }

    // Register subscription
    const subscription = await pushSubscriptionManager.subscribe(
      userId,
      {
        endpoint,
        keys,
        expirationTime: expirationTime || null,
      },
      deviceInfo
    );

    res.json({
      success: true,
      message: 'Subscription registered successfully',
      subscription,
    });

    log.info('Push subscription registered', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...',
      deviceType: deviceInfo?.type,
    });
  } catch (error) {
    log.error('Failed to register subscription', { error });
    res.status(500).json({
      error: 'Failed to register subscription',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/push-notifications/unsubscribe
 * Remove push subscription
 */
router.delete('/unsubscribe', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'endpoint is required',
      });
    }

    const removed = await pushSubscriptionManager.unsubscribe(userId, endpoint);

    if (!removed) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'No subscription found for this endpoint',
      });
    }

    res.json({
      success: true,
      message: 'Unsubscribed successfully',
    });

    log.info('Push subscription removed', {
      userId,
      endpoint: endpoint.substring(0, 50) + '...',
    });
  } catch (error) {
    log.error('Failed to unsubscribe', { error });
    res.status(500).json({
      error: 'Failed to unsubscribe',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/push-notifications/unsubscribe-all
 * Remove all push subscriptions for user
 */
router.post('/unsubscribe-all', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const count = await pushSubscriptionManager.unsubscribeAll(userId);

    res.json({
      success: true,
      message: 'All subscriptions removed',
      count,
    });

    log.info('All push subscriptions removed', { userId, count });
  } catch (error) {
    log.error('Failed to unsubscribe all', { error });
    res.status(500).json({
      error: 'Failed to unsubscribe all',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/push-notifications/subscriptions
 * Get user's registered subscriptions
 */
router.get('/subscriptions', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const subscriptions =
      await pushSubscriptionManager.getUserSubscriptions(userId);

    res.json({
      success: true,
      subscriptions: subscriptions.map((sub) => ({
        id: sub._id,
        deviceType: sub.deviceType,
        deviceName: sub.deviceName,
        browser: sub.browser,
        platform: sub.platform,
        createdAt: sub.createdAt,
        lastUsedAt: sub.lastUsedAt,
        isActive: sub.isActive,
      })),
    });
  } catch (error) {
    log.error('Failed to get subscriptions', { error });
    res.status(500).json({
      error: 'Failed to get subscriptions',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/push-notifications/send
 * Send push notification to specific users (admin only)
 */
router.post('/send', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userIds, title, body, icon, badge, tag, data, actions } = req.body;

    // Validate input
    const validation = pushNotificationService.validatePayload({
      title,
      body,
      icon,
      badge,
      tag,
      data,
      actions,
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid notification payload',
        errors: validation.errors,
      });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userIds array is required',
      });
    }

    // Send notifications
    const result = await pushNotificationService.sendToUsers(
      userIds,
      {
        title,
        body,
        icon,
        badge,
        tag,
        data,
        actions,
      },
      { trackAnalytics: true }
    );

    res.json({
      success: result.success,
      message: 'Notifications sent',
      notificationId: result.notificationId,
      results: {
        sent: result.sent,
        failed: result.failed,
      },
    });

    log.info('Push notifications sent', {
      notificationId: result.notificationId,
      userCount: userIds.length,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    log.error('Failed to send notifications', { error });
    res.status(500).json({
      error: 'Failed to send notifications',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/push-notifications/broadcast
 * Send broadcast notification to all users or user segment (admin only)
 */
router.post(
  '/broadcast',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        title,
        body,
        icon,
        badge,
        tag,
        data,
        actions,
        targetRole,
        targetTags,
      } = req.body;

      // Validate input
      const validation = pushNotificationService.validatePayload({
        title,
        body,
        icon,
        badge,
        tag,
        data,
        actions,
      });

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid notification payload',
          errors: validation.errors,
        });
      }

      // Send broadcast
      const result = await pushNotificationService.sendBroadcast(
        {
          title,
          body,
          icon,
          badge,
          tag,
          data,
          actions,
        },
        {
          targetRole,
          trackAnalytics: true,
        }
      );

      res.json({
        success: result.success,
        message: 'Broadcast notification sent',
        notificationId: result.notificationId,
        results: {
          sent: result.sent,
          failed: result.failed,
        },
      });

      log.info('Broadcast notification sent', {
        notificationId: result.notificationId,
        sent: result.sent,
        failed: result.failed,
        targetRole,
      });
    } catch (error) {
      log.error('Failed to broadcast notification', { error });
      res.status(500).json({
        error: 'Failed to broadcast notification',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * POST /api/push-notifications/response
 * Record user response to notification action
 */
router.post('/response', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { notificationId, action, respondedAt } = req.body;

    if (!notificationId || !action) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'notificationId and action are required',
      });
    }

    // Record response in database
    const db = mongoose.connection.db;
    if (db) {
      const collection = db.collection('notification_responses');

      await collection.insertOne({
        notificationId,
        userId: new ObjectId(userId),
        action,
        respondedAt: new Date(respondedAt || Date.now()),
        createdAt: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'Response recorded',
    });

    log.info('Notification response recorded', {
      notificationId,
      userId,
      action,
    });
  } catch (error) {
    log.error('Failed to record notification response', { error });
    res.status(500).json({
      error: 'Failed to record response',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/push-notifications/unread-count
 * Get count of unread notifications for user
 */
router.get('/unread-count', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const db = mongoose.connection.db;

    if (!db) {
      return res.json({ count: 0 });
    }

    const collection = db.collection('notifications');

    const count = await collection.countDocuments({
      userId: new ObjectId(userId),
      read: false,
    });

    res.json({ count });
  } catch (error) {
    log.error('Failed to get unread count', { error });
    res.json({ count: 0 });
  }
});

/**
 * GET /api/push-notifications/stats
 * Get subscription statistics (admin only)
 */
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await pushSubscriptionManager.getStatistics();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    log.error('Failed to get subscription statistics', { error });
    res.status(500).json({
      error: 'Failed to get statistics',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/push-notifications/cleanup
 * Clean up invalid subscriptions (admin only)
 */
router.post('/cleanup', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = await pushSubscriptionManager.cleanupInvalidSubscriptions();

    res.json({
      success: true,
      message: 'Cleanup completed',
      removedCount: count,
    });

    log.info('Cleaned up invalid subscriptions', { count });
  } catch (error) {
    log.error('Failed to cleanup subscriptions', { error });
    res.status(500).json({
      error: 'Failed to cleanup subscriptions',
      message: (error as Error).message,
    });
  }
});

export default router;
