// Notification Analytics API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationAnalyticsAPI');
const router = express.Router();

// GET /api/notification-analytics/metrics
// Get comprehensive analytics metrics (admin only)
router.get('/metrics', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h' } = req.query;

    const hoursAgo = period === '24h' ? 24 : period === '7d' ? 168 : 24;
    const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    // Get total sent and delivered
    const totalSent = await collections.countDocuments({ createdAt: { $gte: cutoffDate } });
    const totalDelivered = await collections.countDocuments({
      createdAt: { $gte: cutoffDate },
      deliveredAt: { $exists: true }
    });
    const totalFailed = await collections.countDocuments({
      createdAt: { $gte: cutoffDate },
      status: 'failed'
    });

    // Get average delivery time
    const deliveryTimePipeline = [
      {
        $match: {
          createdAt: { $gte: cutoffDate },
          deliveredAt: { $exists: true }
        }
      },
      {
        $addFields: {
          deliveryTime: {
            $subtract: ['$deliveredAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDeliveryTime: { $avg: '$deliveryTime' },
          maxDeliveryTime: { $max: '$deliveryTime' },
          minDeliveryTime: { $min: '$deliveryTime' },
          p99DeliveryTime: { $percentile: ['$deliveryTime', [0.99]] }
        }
      }
    ];

    const deliveryTimeResults = await collections
      .aggregate(deliveryTimePipeline)
      .toArray();
    const deliveryMetrics = deliveryTimeResults[0] || {
      avgDeliveryTime: 0,
      maxDeliveryTime: 0,
      minDeliveryTime: 0,
      p99DeliveryTime: 0
    };

    // Get by category breakdown
    const categoryBreakdown = await collections
      .aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        {
          $group: {
            _id: '$category',
            sent: { $sum: 1 },
            delivered: {
              $sum: {
                $cond: [{ $exists: ['$deliveredAt', true] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            }
          }
        }
      ])
      .toArray();

    // Get by channel breakdown
    const channelBreakdown = await collections
      .aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        { $unwind: '$channels' },
        {
          $group: {
            _id: '$channels',
            sent: { $sum: 1 },
            delivered: {
              $sum: {
                $cond: [{ $exists: ['$deliveredAt', true] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            }
          }
        }
      ])
      .toArray();

    const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    log.info('Analytics metrics retrieved', {
      period,
      totalSent,
      totalDelivered,
      successRate: successRate.toFixed(2)
    });

    res.json({
      success: true,
      metrics: {
        period,
        summary: {
          totalSent,
          totalDelivered,
          totalFailed,
          successRate: successRate.toFixed(2)
        },
        timing: {
          averageDeliveryTime: Math.round(deliveryMetrics.avgDeliveryTime || 0),
          maxDeliveryTime: Math.round(deliveryMetrics.maxDeliveryTime || 0),
          minDeliveryTime: Math.round(deliveryMetrics.minDeliveryTime || 0),
          p99DeliveryTime: Math.round(deliveryMetrics.p99DeliveryTime || 0)
        },
        byCategory: categoryBreakdown.map(cat => ({
          category: cat._id,
          sent: cat.sent,
          delivered: cat.delivered,
          failed: cat.failed,
          deliveryRate: cat.sent > 0 ? ((cat.delivered / cat.sent) * 100).toFixed(2) : '0'
        })),
        byChannel: channelBreakdown.map(ch => ({
          channel: ch._id,
          sent: ch.sent,
          delivered: ch.delivered,
          failed: ch.failed,
          deliveryRate: ch.sent > 0 ? ((ch.delivered / ch.sent) * 100).toFixed(2) : '0'
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get analytics metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve analytics metrics',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-analytics/timeline
// Get timeline data for charts (admin only)
router.get('/timeline', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h', interval = 'hour' } = req.query;

    const hoursAgo = period === '24h' ? 24 : period === '7d' ? 168 : 24;
    const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const dateFormat =
      interval === 'hour'
        ? '%Y-%m-%d %H:00'
        : interval === 'day'
          ? '%Y-%m-%d'
          : '%Y-%m-%d';

    const timeline = await collections
      .aggregate([
        { $match: { createdAt: { $gte: cutoffDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$createdAt' }
            },
            sent: { $sum: 1 },
            delivered: {
              $sum: {
                $cond: [{ $exists: ['$deliveredAt', true] }, 1, 0]
              }
            },
            failed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();

    res.json({
      success: true,
      timeline: timeline.map(point => ({
        timestamp: point._id,
        sent: point.sent,
        delivered: point.delivered,
        failed: point.failed
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get timeline data', { error });
    res.status(500).json({
      error: 'Failed to retrieve timeline data',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-analytics/user-engagement
// Get per-user engagement metrics (admin only)
router.get('/user-engagement', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.query;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const engagement = await collections
      .aggregate([
        {
          $group: {
            _id: '$userId',
            sent: { $sum: 1 },
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
            lastSentAt: { $max: '$createdAt' }
          }
        },
        {
          $project: {
            userId: '$_id',
            sent: 1,
            delivered: 1,
            failed: 1,
            deliveryRate: {
              $cond: [
                { $gt: ['$sent', 0] },
                { $round: [{ $multiply: [{ $divide: ['$delivered', '$sent'] }, 100] }, 2] },
                0
              ]
            },
            lastSentAt: 1,
            _id: 0
          }
        },
        { $sort: { sent: -1 } },
        { $limit: parseInt(limit as string) }
      ])
      .toArray();

    res.json({
      success: true,
      engagement,
      count: engagement.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get user engagement metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve user engagement metrics',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-analytics/top-categories
// Get top performing categories (admin only)
router.get('/top-categories', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collections = db.collection('notification_logs');

    const topCategories = await collections
      .aggregate([
        {
          $group: {
            _id: '$category',
            sent: { $sum: 1 },
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
            avgDeliveryTime: {
              $avg: {
                $subtract: ['$deliveredAt', '$createdAt']
              }
            }
          }
        },
        {
          $project: {
            category: '$_id',
            sent: 1,
            delivered: 1,
            failed: 1,
            deliveryRate: {
              $cond: [
                { $gt: ['$sent', 0] },
                { $round: [{ $multiply: [{ $divide: ['$delivered', '$sent'] }, 100] }, 2] },
                0
              ]
            },
            avgDeliveryTime: { $round: ['$avgDeliveryTime', 0] },
            _id: 0
          }
        },
        { $sort: { sent: -1 } },
        { $limit: parseInt(limit as string) }
      ])
      .toArray();

    res.json({
      success: true,
      topCategories,
      count: topCategories.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get top categories', { error });
    res.status(500).json({
      error: 'Failed to retrieve top categories',
      message: (error as Error).message
    });
  }
});

export default router;
