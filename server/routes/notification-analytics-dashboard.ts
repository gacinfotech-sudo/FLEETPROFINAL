// Notification Analytics Dashboard API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationAnalytics } from '../utils/notificationAnalytics';
import { createLogger } from '../utils/logger';
import mongoose from 'mongoose';

const log = createLogger('NotificationAnalyticsDashboard');
const router = express.Router();

interface DateRange {
  startDate: Date;
  endDate: Date;
}

function getPeriodDateRange(period: string): DateRange {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 1);
  }

  return { startDate, endDate };
}

// GET /api/notification-analytics/summary
// Get summary statistics
router.get('/summary', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const metrics = await notificationAnalytics.getMetrics(startDate, endDate);

    res.json({
      success: true,
      period,
      metrics: {
        totalSent: metrics.totalSent,
        totalDelivered: metrics.totalDelivered,
        totalOpened: metrics.totalClicked,
        totalBounced: metrics.totalBounced,
        totalFailed: metrics.totalFailed,
        deliveryRate: parseFloat(metrics.deliveryRate.toFixed(2)),
        clickThroughRate: parseFloat(metrics.clickThroughRate.toFixed(2)),
        bounceRate: parseFloat(metrics.bounceRate.toFixed(2)),
        averageDeliveryTime: metrics.averageDeliveryTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get summary metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve summary metrics',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/by-channel
// Get metrics broken down by channel
router.get('/by-channel', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const channelMetrics = await notificationAnalytics.getChannelMetrics(startDate, endDate);

    res.json({
      success: true,
      period,
      channels: channelMetrics.map((channel) => ({
        channel: channel.channel,
        totalSent: channel.totalSent,
        totalDelivered: channel.totalDelivered,
        totalFailed: channel.totalFailed,
        totalBounced: channel.totalBounced,
        totalOpened: channel.totalClicked,
        deliveryRate: parseFloat(channel.deliveryRate.toFixed(2)),
        bounceRate: parseFloat(channel.bounceRate.toFixed(2)),
        clickThroughRate: parseFloat(channel.clickThroughRate.toFixed(2)),
        averageDeliveryTime: channel.averageDeliveryTime,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get channel metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve channel metrics',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/by-event-type
// Get metrics broken down by event type
router.get('/by-event-type', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const eventTypeMetrics = await notificationAnalytics.getEventTypeMetrics(startDate, endDate);

    res.json({
      success: true,
      period,
      eventTypes: eventTypeMetrics.map((eventType) => ({
        eventType: eventType.eventType,
        totalSent: eventType.totalSent,
        totalDelivered: eventType.totalDelivered,
        totalFailed: eventType.totalFailed,
        totalOpened: eventType.totalClicked,
        deliveryRate: parseFloat(eventType.deliveryRate.toFixed(2)),
        clickThroughRate: parseFloat(eventType.clickThroughRate.toFixed(2)),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get event type metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve event type metrics',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/engagement-trend
// Get engagement trend over time
router.get('/engagement-trend', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const timeSeries = await notificationAnalytics.getTimeSeriesData(startDate, endDate, 1440);

    res.json({
      success: true,
      period,
      trend: timeSeries.map((point) => ({
        date: point.timestamp,
        sent: point.sent,
        delivered: point.delivered,
        opened: point.delivered,
        clicked: point.clicked,
        bounced: point.bounced,
        failed: point.failed,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get engagement trend', { error });
    res.status(500).json({
      error: 'Failed to retrieve engagement trend',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/time-series
// Get detailed time series data
router.get('/time-series', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '24h', interval = '60' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);
    const intervalMinutes = parseInt(interval as string) || 60;

    const timeSeries = await notificationAnalytics.getTimeSeriesData(
      startDate,
      endDate,
      intervalMinutes
    );

    res.json({
      success: true,
      period,
      interval: intervalMinutes,
      data: timeSeries.map((point) => ({
        timestamp: point.timestamp,
        sent: point.sent,
        delivered: point.delivered,
        clicked: point.clicked,
        bounced: point.bounced,
        failed: point.failed,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get time series data', { error });
    res.status(500).json({
      error: 'Failed to retrieve time series data',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/user-engagement
// Get top engaged users
router.get('/user-engagement', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '7d', limit = '50' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);
    const limitNum = parseInt(limit as string) || 50;

    const userEngagement = await notificationAnalytics.getUserEngagementMetrics(
      startDate,
      endDate,
      limitNum
    );

    res.json({
      success: true,
      period,
      users: userEngagement.map((user) => ({
        userId: user.userId,
        totalReceived: user.totalReceived,
        totalOpened: user.totalOpened,
        totalClicked: user.totalClicked,
        engagementRate: parseFloat(user.engagementRate.toFixed(2)),
        lastEngagedAt: user.lastEngagedAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get user engagement metrics', { error });
    res.status(500).json({
      error: 'Failed to retrieve user engagement metrics',
      message: (error as Error).message,
    });
  }
});

// POST /api/notification-analytics/export
// Export analytics data to CSV
router.post('/export', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { format = 'csv', period = '7d', includeData = ['summary', 'channel', 'eventType'] } = req.body;

    const { startDate, endDate } = getPeriodDateRange(period as string);

    const data: Record<string, any> = {};

    if (includeData.includes('summary')) {
      data.summary = await notificationAnalytics.getMetrics(startDate, endDate);
    }

    if (includeData.includes('channel')) {
      data.channel = await notificationAnalytics.getChannelMetrics(startDate, endDate);
    }

    if (includeData.includes('eventType')) {
      data.eventType = await notificationAnalytics.getEventTypeMetrics(startDate, endDate);
    }

    if (includeData.includes('timeSeries')) {
      data.timeSeries = await notificationAnalytics.getTimeSeriesData(startDate, endDate);
    }

    if (includeData.includes('userEngagement')) {
      data.userEngagement = await notificationAnalytics.getUserEngagementMetrics(startDate, endDate);
    }

    if (format === 'csv') {
      let csv = '';

      if (data.summary) {
        csv += 'Summary Metrics\n';
        csv += 'Total Sent,Total Delivered,Total Opened,Total Bounced,Total Failed,Delivery Rate %,CTR %,Bounce Rate %\n';
        const s = data.summary;
        csv += `${s.totalSent},${s.totalDelivered},${s.totalClicked},${s.totalBounced},${s.totalFailed},${s.deliveryRate.toFixed(2)},${s.clickThroughRate.toFixed(2)},${s.bounceRate.toFixed(2)}\n\n`;
      }

      if (data.channel && data.channel.length > 0) {
        csv += 'Channel Metrics\n';
        csv += 'Channel,Total Sent,Total Delivered,Total Failed,Delivery Rate %,CTR %\n';
        data.channel.forEach((c: any) => {
          csv += `${c.channel},${c.totalSent},${c.totalDelivered},${c.totalFailed},${c.deliveryRate.toFixed(2)},${c.clickThroughRate.toFixed(2)}\n`;
        });
        csv += '\n';
      }

      if (data.eventType && data.eventType.length > 0) {
        csv += 'Event Type Metrics\n';
        csv += 'Event Type,Total Sent,Total Delivered,Total Failed,Delivery Rate %,CTR %\n';
        data.eventType.forEach((e: any) => {
          csv += `${e.eventType},${e.totalSent},${e.totalDelivered},${e.totalFailed},${e.deliveryRate.toFixed(2)},${e.clickThroughRate.toFixed(2)}\n`;
        });
        csv += '\n';
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="notification-analytics.csv"');
      res.send(csv);
    } else if (format === 'json') {
      res.json({
        success: true,
        period,
        data,
        exportedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    log.error('Failed to export analytics data', { error });
    res.status(500).json({
      error: 'Failed to export analytics data',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/delivery-success-rate
// Get delivery success rate over time (for line chart)
router.get('/delivery-success-rate', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const timeSeries = await notificationAnalytics.getTimeSeriesData(startDate, endDate, 1440);

    const successRateData = timeSeries.map((point) => ({
      date: point.timestamp,
      successRate:
        point.sent > 0 ? parseFloat(((point.delivered / point.sent) * 100).toFixed(2)) : 0,
      sent: point.sent,
      delivered: point.delivered,
    }));

    res.json({
      success: true,
      period,
      data: successRateData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get delivery success rate', { error });
    res.status(500).json({
      error: 'Failed to retrieve delivery success rate',
      message: (error as Error).message,
    });
  }
});

// GET /api/notification-analytics/peak-hours
// Get peak engagement hours
router.get('/peak-hours', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { period = '7d' } = req.query;
    const { startDate, endDate } = getPeriodDateRange(period as string);

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    const collection = db.collection('notification_logs');

    const peakHours = await collection
      .aggregate([
        { $match: { sentAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              $hour: '$sentAt',
            },
            totalNotifications: { $sum: 1 },
            totalClicks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const hour = peakHours.find((h: any) => h._id === i);
      return {
        hour: i,
        hourLabel: `${i.toString().padStart(2, '0')}:00`,
        notifications: hour?.totalNotifications || 0,
        clicks: hour?.totalClicks || 0,
        engagementRate: hour ? ((hour.totalClicks / hour.totalNotifications) * 100).toFixed(2) : '0',
      };
    });

    res.json({
      success: true,
      period,
      hourlyData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get peak hours', { error });
    res.status(500).json({
      error: 'Failed to retrieve peak hours',
      message: (error as Error).message,
    });
  }
});

export default router;
