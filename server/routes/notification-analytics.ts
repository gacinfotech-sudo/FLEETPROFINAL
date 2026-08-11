// Notification Analytics API Endpoints
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationAnalytics } from '../utils/notificationAnalytics';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationAnalyticsAPI');
const router = express.Router();

// GET /api/notification-analytics/metrics
// Get overall notification metrics (admin only)
router.get('/metrics', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const notificationType = (type as 'targeted' | 'broadcast') || undefined;

    const metrics = await notificationAnalytics.getMetrics(start, end, notificationType);

    log.info('Metrics requested', { startDate: start, endDate: end, type: notificationType });

    res.json({
      success: true,
      metrics,
      period: {
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/notifications/:notificationId
// Get performance of specific notification (admin only)
router.get(
  '/notifications/:notificationId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;

      const performance = await notificationAnalytics.getNotificationPerformance(notificationId);

      if (!performance) {
        return res.status(404).json({
          error: 'Notification not found',
          message: 'No records found for this notification',
        });
      }

      log.info('Notification performance requested', { notificationId });

      res.json({
        success: true,
        data: performance,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to get notification performance', { error });
      res.status(500).json({
        error: 'Failed to retrieve performance data',
        message: (error as Error).message,
      });
    }
  }
);

// GET /api/notification-analytics/user/:userId/history
// Get user's notification history (authenticated)
router.get('/user/:userId/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;
    const requestingUserId = (req as any).userId;

    // Users can only view their own history, admins can view any
    const userRole = (req as any).userRole;
    if (userRole !== 'admin' && userId !== requestingUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own notification history',
      });
    }

    const historyLimit = Math.min(parseInt(limit as string) || 50, 100);

    const history = await notificationAnalytics.getUserNotificationHistory(userId, historyLimit);

    log.info('User history requested', { userId, count: history.length });

    res.json({
      success: true,
      userId,
      history,
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get user history', { error });
    res.status(500).json({
      error: 'Failed to retrieve history',
      message: (error as Error).message,
    });
  }
});

// POST /api/notification-analytics/delivery
// Record notification delivery (called from service worker on push event)
router.post('/delivery', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'notificationId is required',
      });
    }

    const collection = mongoose.connection.db!.collection('notification_logs');

    // Find all logs for this notification
    const logs = await collection.find({ notificationId }).toArray();

    let deliveredCount = 0;
    for (const log of logs) {
      const success = await notificationAnalytics.recordDelivery(log._id, 'service-worker');
      if (success) deliveredCount++;
    }

    log.info('Notification delivery recorded', {
      notificationId,
      deliveredCount,
    });

    res.json({
      success: true,
      message: `Delivery recorded for ${deliveredCount} notification(s)`,
      deliveredCount,
    });
  } catch (error) {
    log.error('Failed to record delivery', { error });
    res.status(500).json({
      error: 'Failed to record delivery',
      message: (error as Error).message,
    });
  }
});

// POST /api/notification-analytics/dismissal
// Record notification dismissal (called from service worker on close event)
router.post('/dismissal', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'notificationId is required',
      });
    }

    const collection = mongoose.connection.db!.collection('notification_logs');

    // Find all logs for this notification
    const logs = await collection.find({ notificationId }).toArray();

    let dismissedCount = 0;
    for (const log of logs) {
      const success = await notificationAnalytics.recordDismissal(log._id);
      if (success) dismissedCount++;
    }

    log.info('Notification dismissal recorded', {
      notificationId,
      dismissedCount,
    });

    res.json({
      success: true,
      message: `Dismissal recorded for ${dismissedCount} notification(s)`,
      dismissedCount,
    });
  } catch (error) {
    log.error('Failed to record dismissal', { error });
    res.status(500).json({
      error: 'Failed to record dismissal',
      message: (error as Error).message,
    });
  }
});

// POST /api/notification-analytics/click
// Record notification click (called from service worker)
router.post('/click', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'notificationId is required',
      });
    }

    const collection = mongoose.connection.db!.collection('notification_logs');

    // Find all logs for this notification (multiple users may have received it)
    const logs = await collection.find({ notificationId }).toArray();

    let clickedCount = 0;
    for (const log of logs) {
      const success = await notificationAnalytics.recordClick(log._id);
      if (success) clickedCount++;
    }

    log.info('Notification click recorded', {
      notificationId,
      clickedCount,
    });

    res.json({
      success: true,
      message: `Click recorded for ${clickedCount} notification(s)`,
      clickedCount,
    });
  } catch (error) {
    log.error('Failed to record click', { error });
    res.status(500).json({
      error: 'Failed to record click',
      message: (error as Error).message,
    });
  }
});

// POST /api/notification-analytics/cleanup
// Cleanup old notification records (admin only)
router.post('/cleanup', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { daysOld } = req.body;

    if (!daysOld || daysOld < 1) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'daysOld must be at least 1',
      });
    }

    const deleted = await notificationAnalytics.cleanupOldRecords(daysOld);

    log.info('Cleanup executed', { daysOld, deleted });

    res.json({
      success: true,
      message: `${deleted} old notification records deleted`,
      deleted,
      cutoffDays: daysOld,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to cleanup records', { error });
    res.status(500).json({
      error: 'Failed to cleanup records',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/summary
// Get summary statistics (admin only)
router.get('/summary', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get metrics for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const metricsLast7Days = await notificationAnalytics.getMetrics(sevenDaysAgo);

    // Get metrics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const metricsLast30Days = await notificationAnalytics.getMetrics(thirtyDaysAgo);

    log.info('Summary statistics requested');

    res.json({
      success: true,
      summary: {
        last7Days: metricsLast7Days,
        last30Days: metricsLast30Days,
        improvement: {
          deliveryRate:
            metricsLast30Days.deliveryRate - metricsLast7Days.deliveryRate > 0 ? 'up' : 'down',
          clickThroughRate:
            metricsLast30Days.clickThroughRate - metricsLast7Days.clickThroughRate > 0
              ? 'up'
              : 'down',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get summary', { error });
    res.status(500).json({
      error: 'Failed to retrieve summary',
      message: (error as Error).message,
    });
  }
});

export default router;
