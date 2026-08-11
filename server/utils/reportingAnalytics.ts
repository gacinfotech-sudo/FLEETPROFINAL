// Reporting Analytics - Provider Usage Analytics & Metrics
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('ReportingAnalytics');

export interface ProviderUsageMetrics {
  providerId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  messages: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
  };
  calls: {
    totalInitiated: number;
    totalCompleted: number;
    totalFailed: number;
    completionRate: number;
    avgDuration: number;
  };
  events: {
    totalEvents: number;
    byType: Record<string, number>;
  };
  successRate: number;
  errorRate: number;
  trendAnalysis: {
    daily: Array<{ date: string; sent: number; delivered: number; failed: number }>;
    weekly: Array<{ week: string; sent: number; delivered: number; failed: number }>;
    monthly: Array<{ month: string; sent: number; delivered: number; failed: number }>;
  };
  forecastingData?: {
    predictedVolume: number;
    confidence: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

export class ReportingAnalytics {
  private db: mongoose.Connection;

  constructor() {
    this.db = mongoose.connection;
  }

  async getProviderUsageMetrics(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderUsageMetrics> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    // Get message metrics
    const messagePipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
          eventType: 'message_sent',
        },
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
    ];

    const messageMetrics = await notificationLogs.aggregate(messagePipeline).toArray();
    const messages = messageMetrics[0] || { totalSent: 0, totalDelivered: 0, totalFailed: 0 };
    const deliveryRate =
      messages.totalSent > 0
        ? (messages.totalDelivered / messages.totalSent) * 100
        : 0;

    // Get call metrics
    const callPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
          eventType: 'call_initiated',
        },
      },
      {
        $group: {
          _id: null,
          totalInitiated: { $sum: 1 },
          totalCompleted: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgDuration: { $avg: '$duration' },
        },
      },
    ];

    const callMetrics = await notificationLogs.aggregate(callPipeline).toArray();
    const calls = callMetrics[0] || {
      totalInitiated: 0,
      totalCompleted: 0,
      totalFailed: 0,
      avgDuration: 0,
    };
    const completionRate =
      calls.totalInitiated > 0
        ? (calls.totalCompleted / calls.totalInitiated) * 100
        : 0;

    // Get event metrics
    const eventPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
    ];

    const eventMetrics = await notificationLogs.aggregate(eventPipeline).toArray();
    const eventsByType: Record<string, number> = {};
    let totalEvents = 0;

    eventMetrics.forEach((item) => {
      eventsByType[item._id] = item.count;
      totalEvents += item.count;
    });

    // Get success and error rates
    const ratesPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
    ];

    const ratesData = await notificationLogs.aggregate(ratesPipeline).toArray();
    const rates = ratesData[0] || { totalNotifications: 0, successCount: 0, failureCount: 0 };

    const successRate =
      rates.totalNotifications > 0
        ? (rates.successCount / rates.totalNotifications) * 100
        : 0;
    const errorRate = 100 - successRate;

    // Get trend analysis
    const trendData = await this.analyzeTrends(
      notificationLogs,
      providerId,
      startDate,
      endDate
    );

    // Get forecasting data
    const forecastingData = await this.predictFutureVolume(
      notificationLogs,
      providerId,
      startDate,
      endDate
    );

    return {
      providerId,
      period: { startDate, endDate },
      messages: {
        totalSent: messages.totalSent,
        totalDelivered: messages.totalDelivered,
        totalFailed: messages.totalFailed,
        deliveryRate: parseFloat(deliveryRate.toFixed(2)),
      },
      calls: {
        totalInitiated: calls.totalInitiated,
        totalCompleted: calls.totalCompleted,
        totalFailed: calls.totalFailed,
        completionRate: parseFloat(completionRate.toFixed(2)),
        avgDuration: calls.avgDuration || 0,
      },
      events: {
        totalEvents,
        byType: eventsByType,
      },
      successRate: parseFloat(successRate.toFixed(2)),
      errorRate: parseFloat(errorRate.toFixed(2)),
      trendAnalysis: trendData,
      forecastingData,
    };
  }

  private async analyzeTrends(
    collection: any,
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    daily: Array<{ date: string; sent: number; delivered: number; failed: number }>;
    weekly: Array<{ week: string; sent: number; delivered: number; failed: number }>;
    monthly: Array<{ month: string; sent: number; delivered: number; failed: number }>;
  }> {
    // Daily trend
    const dailyPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sent: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const daily = await collection.aggregate(dailyPipeline).toArray();

    // Weekly trend
    const weeklyPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-W%U', date: '$createdAt' },
          },
          sent: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const weekly = await collection.aggregate(weeklyPipeline).toArray();

    // Monthly trend
    const monthlyPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          sent: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const monthly = await collection.aggregate(monthlyPipeline).toArray();

    return {
      daily: daily.map((d) => ({ date: d._id, ...d })),
      weekly: weekly.map((w) => ({ week: w._id, ...w })),
      monthly: monthly.map((m) => ({ month: m._id, ...m })),
    };
  }

  private async predictFutureVolume(
    collection: any,
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ predictedVolume: number; confidence: number; trendDirection: 'up' | 'down' | 'stable' }> {
    // Get last 30 days of data for prediction
    const thirtyDaysAgo = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const historicalPipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: thirtyDaysAgo, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const historicalData = await collection.aggregate(historicalPipeline).toArray();

    if (historicalData.length < 7) {
      // Not enough data for prediction
      return {
        predictedVolume: 0,
        confidence: 0,
        trendDirection: 'stable',
      };
    }

    // Simple linear regression for forecasting
    const dataPoints = historicalData.map((d) => d.count);
    const n = dataPoints.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = dataPoints.reduce((a, b) => a + b, 0);
    const sumXY = dataPoints.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next day
    const predictedVolume = Math.round(intercept + slope * (n + 1));

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssTotal = dataPoints.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssRes = dataPoints.reduce(
      (sum, y, i) => sum + Math.pow(y - (intercept + slope * (i + 1)), 2),
      0
    );
    const rSquared = 1 - ssRes / ssTotal;
    const confidence = Math.max(0, Math.min(100, rSquared * 100));

    // Determine trend direction
    const trendDirection: 'up' | 'down' | 'stable' =
      slope > 5 ? 'up' : slope < -5 ? 'down' : 'stable';

    return {
      predictedVolume: Math.max(0, predictedVolume),
      confidence: parseFloat(confidence.toFixed(2)),
      trendDirection,
    };
  }

  async getErrorRootCauses(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      reason: string;
      count: number;
      percentage: number;
      mitigation: string;
    }>
  > {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          provider: providerId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'failed',
          failureReason: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$failureReason',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ];

    const errorReasons = await notificationLogs.aggregate(pipeline).toArray();

    const totalErrors = errorReasons.reduce((sum, r) => sum + r.count, 0);

    const errorMitigations: Record<string, string> = {
      'Timeout': 'Increase timeout threshold and implement exponential backoff',
      'Network error': 'Improve network resilience and add retry logic',
      'Authentication failed': 'Verify API credentials and implement token refresh',
      'Rate limit exceeded': 'Implement rate limiting and queue management',
      'Invalid parameters': 'Add input validation and parameter verification',
      'Service unavailable': 'Implement fallback providers and load balancing',
    };

    return errorReasons.map((reason) => ({
      reason: reason._id,
      count: reason.count,
      percentage: (reason.count / totalErrors) * 100,
      mitigation: errorMitigations[reason._id] || 'Investigate and implement mitigation',
    }));
  }

  async getTenantUsageAttribution(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      tenantId: string;
      totalMessages: number;
      totalCalls: number;
      totalEvents: number;
      byProvider: Record<string, { messages: number; calls: number }>;
    }>
  > {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$tenantId',
          totalNotifications: { $sum: 1 },
          byProvider: {
            $push: {
              provider: '$provider',
              eventType: '$eventType',
            },
          },
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();

    return results.map((result) => {
      const byProvider: Record<string, { messages: number; calls: number }> = {};

      result.byProvider.forEach((item: any) => {
        if (!byProvider[item.provider]) {
          byProvider[item.provider] = { messages: 0, calls: 0 };
        }

        if (item.eventType.includes('message')) {
          byProvider[item.provider].messages++;
        } else if (item.eventType.includes('call')) {
          byProvider[item.provider].calls++;
        }
      });

      return {
        tenantId: result._id,
        totalMessages: result.byProvider.filter((p: any) => p.eventType.includes('message')).length,
        totalCalls: result.byProvider.filter((p: any) => p.eventType.includes('call')).length,
        totalEvents: result.totalNotifications,
        byProvider,
      };
    });
  }
}

export default new ReportingAnalytics();
