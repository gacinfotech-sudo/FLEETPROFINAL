// User-Facing Notification Routes
import express, { Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('UserNotificationsAPI');
const router = express.Router();

// GET /api/user/notifications
// Get user's notifications with filtering
router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { filter = 'all', limit = 50 } = req.query;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');
    const query: any = { userId };

    // Apply filters
    if (filter === 'unread') {
      query.read = { $ne: true };
    } else if (filter === 'failed') {
      query.status = 'failed';
    }

    const notifications = await collections
      .find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .toArray();

    log.info('Notifications retrieved', { userId, filter, count: notifications.length });

    res.json({
      success: true,
      notifications: notifications.map(n => ({
        _id: n._id,
        title: n.title,
        body: n.body,
        category: n.category,
        channel: n.channel,
        status: n.status,
        createdAt: n.createdAt,
        deliveredAt: n.deliveredAt,
        clickedAt: n.clickedAt,
        read: n.read || false
      })),
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to retrieve notifications', { error });
    res.status(500).json({
      error: 'Failed to retrieve notifications',
      message: (error as Error).message
    });
  }
});

// GET /api/user/notifications/stats
// Get user's notification statistics
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const stats = await collections
      .aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            read: {
              $sum: {
                $cond: [{ $eq: ['$read', true] }, 1, 0]
              }
            },
            unread: {
              $sum: {
                $cond: [{ $ne: ['$read', true] }, 1, 0]
              }
            },
            delivered: {
              $sum: {
                $cond: [{ $exists: ['$deliveredAt', true] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            },
            clicked: {
              $sum: {
                $cond: [{ $exists: ['$clickedAt', true] }, 1, 0]
              }
            }
          }
        }
      ])
      .toArray();

    const stat = stats[0] || {
      total: 0,
      read: 0,
      unread: 0,
      delivered: 0,
      failed: 0,
      clicked: 0
    };

    log.info('Notification stats retrieved', { userId, stats: stat });

    res.json({
      success: true,
      stats: stat,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to retrieve notification stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

// POST /api/user/notifications/:id/read
// Mark notification as read
router.post('/:id/read', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const result = await collections.updateOne(
      { _id: new (mongoose as any).Types.ObjectId(id), userId },
      { $set: { read: true, readAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Notification not found'
      });
    }

    log.info('Notification marked as read', { userId, notificationId: id });

    res.json({
      success: true,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to mark notification as read', { error });
    res.status(500).json({
      error: 'Failed to update notification',
      message: (error as Error).message
    });
  }
});

// POST /api/user/notifications/:id/click
// Record notification click
router.post('/:id/click', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const result = await collections.updateOne(
      { _id: new (mongoose as any).Types.ObjectId(id), userId },
      { $set: { clickedAt: new Date(), read: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Notification not found'
      });
    }

    log.info('Notification click recorded', { userId, notificationId: id });

    res.json({
      success: true,
      message: 'Click recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to record notification click', { error });
    res.status(500).json({
      error: 'Failed to record click',
      message: (error as Error).message
    });
  }
});

// DELETE /api/user/notifications/:id
// Delete a notification
router.delete('/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const result = await collections.updateOne(
      { _id: new (mongoose as any).Types.ObjectId(id), userId },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Notification not found'
      });
    }

    log.info('Notification deleted', { userId, notificationId: id });

    res.json({
      success: true,
      message: 'Notification deleted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to delete notification', { error });
    res.status(500).json({
      error: 'Failed to delete notification',
      message: (error as Error).message
    });
  }
});

// POST /api/user/notifications/bulk-delete
// Delete multiple notifications
router.post('/bulk-delete', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { ids = [] } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'ids array is required'
      });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const objectIds = ids.map((id: string) => new (mongoose as any).Types.ObjectId(id));

    const result = await collections.updateMany(
      { _id: { $in: objectIds }, userId },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    log.info('Notifications bulk deleted', { userId, count: result.modifiedCount });

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications deleted`,
      deleted: result.modifiedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to bulk delete notifications', { error });
    res.status(500).json({
      error: 'Failed to delete notifications',
      message: (error as Error).message
    });
  }
});

// POST /api/user/notifications/mark-all-read
// Mark all notifications as read
router.post('/mark-all-read', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const result = await collections.updateMany(
      { userId, read: { $ne: true } },
      { $set: { read: true, readAt: new Date() } }
    );

    log.info('All notifications marked as read', { userId, count: result.modifiedCount });

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      updated: result.modifiedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to mark all as read', { error });
    res.status(500).json({
      error: 'Failed to mark notifications as read',
      message: (error as Error).message
    });
  }
});

// GET /api/user/notifications/by-category
// Get notifications grouped by category
router.get('/by-category', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const results = await collections
      .aggregate([
        { $match: { userId, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            unread: {
              $sum: {
                $cond: [{ $ne: ['$read', true] }, 1, 0]
              }
            },
            lastNotification: { $max: '$createdAt' }
          }
        },
        { $sort: { lastNotification: -1 } }
      ])
      .toArray();

    log.info('Notifications by category retrieved', { userId, categories: results.length });

    res.json({
      success: true,
      categories: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to retrieve category breakdown', { error });
    res.status(500).json({
      error: 'Failed to retrieve category breakdown',
      message: (error as Error).message
    });
  }
});

export default router;
