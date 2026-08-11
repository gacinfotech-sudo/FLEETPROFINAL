// Scheduled Notifications API Endpoints
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationScheduler } from '../utils/notificationScheduler';
import { createLogger } from '../utils/logger';

const log = createLogger('ScheduledNotificationsAPI');
const router = express.Router();

// POST /api/scheduled-notifications/schedule
// Schedule a new notification
router.post('/schedule', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      title,
      body,
      userIds,
      targetRole,
      scheduledFor,
      recurrence,
      recurrenceEndDate,
      timezone,
      metadata,
    } = req.body;
    const userId = (req as any).userId;

    // Validate required fields
    if (!title || !body || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title, body, and userIds array are required',
      });
    }

    if (!scheduledFor) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'scheduledFor date is required',
      });
    }

    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'scheduledFor must be a valid ISO date',
      });
    }

    // Schedule the notification
    const notificationId = await notificationScheduler.scheduleNotification(
      title,
      body,
      userIds,
      scheduledDate,
      userId,
      timezone || 'UTC',
      recurrence,
      recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
      metadata || {}
    );

    log.info('Notification scheduled via API', {
      notificationId,
      userCount: userIds.length,
      scheduledFor: scheduledDate,
    });

    res.json({
      success: true,
      message: 'Notification scheduled successfully',
      notificationId,
      scheduledFor: scheduledDate.toISOString(),
    });
  } catch (error) {
    log.error('Failed to schedule notification', { error });
    res.status(500).json({
      error: 'Failed to schedule notification',
      message: (error as Error).message,
    });
  }
});

// GET /api/scheduled-notifications/list
// Get list of scheduled notifications (admin only)
router.get('/list', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;

    const notifications = await notificationScheduler.getScheduledNotifications(
      status as string,
      parseInt(limit as string) || 100
    );

    log.info('Scheduled notifications retrieved', { count: notifications.length });

    res.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get scheduled notifications', { error });
    res.status(500).json({
      error: 'Failed to get scheduled notifications',
      message: (error as Error).message,
    });
  }
});

// POST /api/scheduled-notifications/cancel/:notificationId
// Cancel a scheduled notification (admin only)
router.post(
  '/cancel/:notificationId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;

      const success = await notificationScheduler.cancelNotification(notificationId);

      if (!success) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Scheduled notification not found',
        });
      }

      log.info('Notification cancelled', { notificationId });

      res.json({
        success: true,
        message: 'Notification cancelled successfully',
        notificationId,
      });
    } catch (error) {
      log.error('Failed to cancel notification', { error });
      res.status(500).json({
        error: 'Failed to cancel notification',
        message: (error as Error).message,
      });
    }
  }
);

export default router;
