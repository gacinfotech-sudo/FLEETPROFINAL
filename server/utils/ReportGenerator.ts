// Report Generator - Dynamic Report Builder with 10+ Report Types
import mongoose from 'mongoose';
import { createLogger } from './logger';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';

const log = createLogger('ReportGenerator');

export enum ReportType {
  PERFORMANCE = 'performance',
  USAGE = 'usage',
  ERROR_ANALYSIS = 'error_analysis',
  RELIABILITY = 'reliability',
  CHANNEL_METRICS = 'channel_metrics',
  USER_ENGAGEMENT = 'user_engagement',
  DELIVERY_TRENDS = 'delivery_trends',
  COST_ANALYSIS = 'cost_analysis',
  SLA_COMPLIANCE = 'sla_compliance',
  PROVIDER_COMPARISON = 'provider_comparison',
  HISTORICAL_COMPARISON = 'historical_comparison',
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  HTML = 'html',
}

export interface ReportParams {
  type: ReportType;
  startDate: Date;
  endDate: Date;
  providerId?: string;
  tenantId?: string;
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  filters?: Record<string, any>;
  compareWith?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface ReportData {
  title: string;
  type: ReportType;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: Record<string, any>;
  details: Record<string, any>;
  charts?: Array<{
    type: string;
    title: string;
    data: any[];
  }>;
  recommendations?: string[];
}

export class ReportGenerator {
  private db: mongoose.Connection;

  constructor() {
    this.db = mongoose.connection;
  }

  async generateReport(params: ReportParams): Promise<ReportData> {
    log.info(`Generating ${params.type} report`, { params });

    switch (params.type) {
      case ReportType.PERFORMANCE:
        return this.generatePerformanceReport(params);
      case ReportType.USAGE:
        return this.generateUsageReport(params);
      case ReportType.ERROR_ANALYSIS:
        return this.generateErrorAnalysisReport(params);
      case ReportType.RELIABILITY:
        return this.generateReliabilityReport(params);
      case ReportType.CHANNEL_METRICS:
        return this.generateChannelMetricsReport(params);
      case ReportType.USER_ENGAGEMENT:
        return this.generateUserEngagementReport(params);
      case ReportType.DELIVERY_TRENDS:
        return this.generateDeliveryTrendsReport(params);
      case ReportType.COST_ANALYSIS:
        return this.generateCostAnalysisReport(params);
      case ReportType.SLA_COMPLIANCE:
        return this.generateSLAComplianceReport(params);
      case ReportType.PROVIDER_COMPARISON:
        return this.generateProviderComparisonReport(params);
      case ReportType.HISTORICAL_COMPARISON:
        return this.generateHistoricalComparisonReport(params);
      default:
        throw new Error(`Unknown report type: ${params.type}`);
    }
  }

  private async generatePerformanceReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                totalSent: { $sum: 1 },
                totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                avgDeliveryTime: {
                  $avg: {
                    $cond: [
                      { $and: [{ $exists: ['$deliveredAt', true] }, { $exists: ['$createdAt', true] }] },
                      { $subtract: ['$deliveredAt', '$createdAt'] },
                      null,
                    ],
                  },
                },
                successRate: {
                  $multiply: [
                    {
                      $divide: [
                        { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                        { $sum: 1 },
                      ],
                    },
                    100,
                  ],
                },
              },
            },
          ],
          byChannel: [
            { $group: { _id: '$channel', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          timeSeries: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: params.granularity === 'hourly' ? '%Y-%m-%d %H:00' : '%Y-%m-%d',
                    date: '$createdAt',
                  },
                },
                sent: { $sum: 1 },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();
    const reportData = results[0];

    const metrics = reportData.metrics[0] || {};
    const recommendations: string[] = [];

    if (metrics.successRate < 95) {
      recommendations.push('Success rate is below 95%. Consider investigating failed deliveries.');
    }
    if (metrics.avgDeliveryTime > 5000) {
      recommendations.push('Average delivery time exceeds 5 seconds. Consider optimizing delivery pipeline.');
    }

    return {
      title: 'Performance Report',
      type: ReportType.PERFORMANCE,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalSent: metrics.totalSent || 0,
        totalDelivered: metrics.totalDelivered || 0,
        totalFailed: metrics.totalFailed || 0,
        successRate: (metrics.successRate || 0).toFixed(2) + '%',
        avgDeliveryTime: (metrics.avgDeliveryTime || 0).toFixed(0) + 'ms',
      },
      details: {
        byChannel: reportData.byChannel,
        byStatus: reportData.byStatus,
        timeSeries: reportData.timeSeries,
      },
      charts: [
        {
          type: 'line',
          title: 'Delivery Trend',
          data: reportData.timeSeries,
        },
        {
          type: 'pie',
          title: 'Channel Distribution',
          data: reportData.byChannel,
        },
      ],
      recommendations,
    };
  }

  private async generateUsageReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $facet: {
          totalUsage: [
            {
              $group: {
                _id: null,
                totalNotifications: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueChannels: { $addToSet: '$channel' },
                uniqueEventTypes: { $addToSet: '$eventType' },
              },
            },
          ],
          byEventType: [
            { $group: { _id: '$eventType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ],
          byUser: [
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();
    const reportData = results[0];

    const totalUsage = reportData.totalUsage[0] || {};

    return {
      title: 'Usage Report',
      type: ReportType.USAGE,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalNotifications: totalUsage.totalNotifications || 0,
        uniqueUsers: totalUsage.uniqueUsers?.length || 0,
        uniqueChannels: totalUsage.uniqueChannels?.length || 0,
        uniqueEventTypes: totalUsage.uniqueEventTypes?.length || 0,
        avgPerUser: ((totalUsage.totalNotifications || 0) / (totalUsage.uniqueUsers?.length || 1)).toFixed(2),
      },
      details: {
        byEventType: reportData.byEventType,
        topUsers: reportData.byUser,
        dailyTrend: reportData.daily,
      },
      charts: [
        {
          type: 'bar',
          title: 'Top Event Types',
          data: reportData.byEventType,
        },
        {
          type: 'line',
          title: 'Daily Usage Trend',
          data: reportData.daily,
        },
      ],
    };
  }

  private async generateErrorAnalysisReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          status: 'failed',
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $facet: {
          errorSummary: [
            {
              $group: {
                _id: null,
                totalErrors: { $sum: 1 },
                avgRetries: { $avg: '$retryCount' },
              },
            },
          ],
          byErrorReason: [
            { $group: { _id: '$failureReason', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byChannel: [
            { $group: { _id: '$channel', errorCount: { $sum: 1 } } },
            { $sort: { errorCount: -1 } },
          ],
          byEventType: [
            { $group: { _id: '$eventType', errorCount: { $sum: 1 } } },
            { $sort: { errorCount: -1 } },
          ],
          timeSeries: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();
    const reportData = results[0];

    const errorSummary = reportData.errorSummary[0] || {};

    return {
      title: 'Error Analysis Report',
      type: ReportType.ERROR_ANALYSIS,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalErrors: errorSummary.totalErrors || 0,
        avgRetries: (errorSummary.avgRetries || 0).toFixed(2),
        topErrorReason: reportData.byErrorReason[0]?._id || 'N/A',
      },
      details: {
        byErrorReason: reportData.byErrorReason,
        byChannel: reportData.byChannel,
        byEventType: reportData.byEventType,
        timeSeries: reportData.timeSeries,
      },
      charts: [
        {
          type: 'bar',
          title: 'Error Reasons',
          data: reportData.byErrorReason,
        },
        {
          type: 'line',
          title: 'Error Trend',
          data: reportData.timeSeries,
        },
      ],
      recommendations: [
        `Top error reason: ${reportData.byErrorReason[0]?._id}. Investigate and implement mitigation.`,
        'Consider implementing additional retry logic for transient errors.',
      ],
    };
  }

  private async generateReliabilityReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                uptime: {
                  $multiply: [
                    {
                      $divide: [
                        { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                        { $sum: 1 },
                      ],
                    },
                    100,
                  ],
                },
              },
            },
          ],
          byChannel: [
            {
              $group: {
                _id: '$channel',
                total: { $sum: 1 },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                reliability: {
                  $multiply: [
                    {
                      $divide: [
                        { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                        { $sum: 1 },
                      ],
                    },
                    100,
                  ],
                },
              },
            },
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                total: { $sum: 1 },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();
    const reportData = results[0];

    const overall = reportData.overall[0] || {};

    return {
      title: 'Reliability Report',
      type: ReportType.RELIABILITY,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        uptime: (overall.uptime || 0).toFixed(2) + '%',
        totalNotifications: overall.total || 0,
        deliveredCount: overall.delivered || 0,
        failedCount: overall.failed || 0,
      },
      details: {
        byChannel: reportData.byChannel,
        dailyUptime: reportData.daily,
      },
      charts: [
        {
          type: 'bar',
          title: 'Channel Reliability',
          data: reportData.byChannel,
        },
      ],
    };
  }

  private async generateChannelMetricsReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: '$channel',
          totalSent: { $sum: 1 },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $and: [{ $exists: ['$deliveredAt', true] }, { $exists: ['$createdAt', true] }] },
                { $subtract: ['$deliveredAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          deliveryRate: {
            $multiply: [
              { $divide: ['$totalDelivered', '$totalSent'] },
              100,
            ],
          },
          failureRate: {
            $multiply: [
              { $divide: ['$totalFailed', '$totalSent'] },
              100,
            ],
          },
        },
      },
    ];

    const channelMetrics = await notificationLogs.aggregate(pipeline).toArray();

    return {
      title: 'Channel Metrics Report',
      type: ReportType.CHANNEL_METRICS,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalChannels: channelMetrics.length,
        totalNotifications: channelMetrics.reduce((sum, c) => sum + c.totalSent, 0),
      },
      details: {
        channels: channelMetrics,
      },
      charts: [
        {
          type: 'bar',
          title: 'Delivery Rate by Channel',
          data: channelMetrics,
        },
      ],
    };
  }

  private async generateUserEngagementReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: '$userId',
          totalReceived: { $sum: 1 },
          totalOpened: { $sum: { $cond: [{ $eq: ['$status', 'clicked'] }, 1, 0] } },
          totalDismissed: { $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] } },
          lastInteraction: { $max: '$updatedAt' },
        },
      },
      {
        $addFields: {
          engagementRate: {
            $multiply: [
              { $divide: ['$totalOpened', '$totalReceived'] },
              100,
            ],
          },
        },
      },
      { $sort: { engagementRate: -1 } },
      { $limit: 50 },
    ];

    const userEngagement = await notificationLogs.aggregate(pipeline).toArray();

    return {
      title: 'User Engagement Report',
      type: ReportType.USER_ENGAGEMENT,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalUsers: userEngagement.length,
        avgEngagementRate: (
          userEngagement.reduce((sum, u) => sum + u.engagementRate, 0) / userEngagement.length
        ).toFixed(2) + '%',
      },
      details: {
        topEngagedUsers: userEngagement,
      },
    };
  }

  private async generateDeliveryTrendsReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const granularityFormat =
      params.granularity === 'hourly'
        ? '%Y-%m-%d %H:00'
        : params.granularity === 'weekly'
          ? '%Y-W%U'
          : params.granularity === 'monthly'
            ? '%Y-%m'
            : '%Y-%m-%d';

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: granularityFormat, date: '$createdAt' },
          },
          sent: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const trends = await notificationLogs.aggregate(pipeline).toArray();

    return {
      title: 'Delivery Trends Report',
      type: ReportType.DELIVERY_TRENDS,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        periods: trends.length,
        totalSent: trends.reduce((sum, t) => sum + t.sent, 0),
        totalDelivered: trends.reduce((sum, t) => sum + t.delivered, 0),
      },
      details: {
        trends,
      },
      charts: [
        {
          type: 'line',
          title: 'Delivery Trend',
          data: trends,
        },
      ],
    };
  }

  private async generateCostAnalysisReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: '$channel',
          count: { $sum: 1 },
        },
      },
    ];

    const costData = await notificationLogs.aggregate(pipeline).toArray();

    // Cost per channel (example pricing)
    const channelCosts: Record<string, number> = {
      email: 0.001,
      sms: 0.01,
      push: 0.0001,
      in_app: 0,
      whatsapp: 0.008,
    };

    const costAnalysis = costData.map((item) => ({
      channel: item._id,
      count: item.count,
      unitCost: channelCosts[item._id] || 0,
      totalCost: item.count * (channelCosts[item._id] || 0),
    }));

    const totalCost = costAnalysis.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      title: 'Cost Analysis Report',
      type: ReportType.COST_ANALYSIS,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalNotifications: costAnalysis.reduce((sum, item) => sum + item.count, 0),
        totalCost: totalCost.toFixed(2),
        costPerNotification: (
          totalCost / costAnalysis.reduce((sum, item) => sum + item.count, 0)
        ).toFixed(4),
      },
      details: {
        byChannel: costAnalysis,
      },
      charts: [
        {
          type: 'pie',
          title: 'Cost Distribution by Channel',
          data: costAnalysis,
        },
      ],
    };
  }

  private async generateSLAComplianceReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    // SLA: 99% delivery rate, 5 second average delivery time
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.providerId && { 'provider': params.providerId }),
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $facet: {
          sla: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                avgDeliveryTime: {
                  $avg: {
                    $cond: [
                      { $and: [{ $exists: ['$deliveredAt', true] }, { $exists: ['$createdAt', true] }] },
                      { $subtract: ['$deliveredAt', '$createdAt'] },
                      null,
                    ],
                  },
                },
              },
            },
          ],
          dailySLA: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                total: { $sum: 1 },
              },
            },
            {
              $addFields: {
                deliveryRate: {
                  $multiply: [{ $divide: ['$delivered', '$total'] }, 100],
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ];

    const results = await notificationLogs.aggregate(pipeline).toArray();
    const slaData = results[0];

    const sla = slaData.sla[0] || {};
    const deliveryRate = (sla.delivered / sla.total) * 100;
    const isCompliant = deliveryRate >= 99 && (sla.avgDeliveryTime || 0) <= 5000;

    return {
      title: 'SLA Compliance Report',
      type: ReportType.SLA_COMPLIANCE,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        targetDeliveryRate: '99%',
        actualDeliveryRate: deliveryRate.toFixed(2) + '%',
        compliant: isCompliant ? 'YES' : 'NO',
        targetDeliveryTime: '5000ms',
        actualDeliveryTime: (sla.avgDeliveryTime || 0).toFixed(0) + 'ms',
      },
      details: {
        dailyCompliance: slaData.dailySLA,
      },
      charts: [
        {
          type: 'line',
          title: 'Daily Delivery Rate vs SLA Target',
          data: slaData.dailySLA,
        },
      ],
      recommendations: !isCompliant
        ? [
            'SLA compliance is below target. Investigate and implement improvements.',
            'Consider increasing infrastructure capacity or optimizing delivery pipeline.',
          ]
        : ['SLA targets are being met. Continue monitoring and maintain current service levels.'],
    };
  }

  private async generateProviderComparisonReport(params: ReportParams): Promise<ReportData> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: '$provider',
          totalSent: { $sum: 1 },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          avgDeliveryTime: {
            $avg: {
              $cond: [
                { $and: [{ $exists: ['$deliveredAt', true] }, { $exists: ['$createdAt', true] }] },
                { $subtract: ['$deliveredAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$totalDelivered', '$totalSent'] },
              100,
            ],
          },
        },
      },
    ];

    const providers = await notificationLogs.aggregate(pipeline).toArray();

    return {
      title: 'Provider Comparison Report',
      type: ReportType.PROVIDER_COMPARISON,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        totalProviders: providers.length,
        bestProvider: providers[0]?._id || 'N/A',
        bestSuccessRate: (providers[0]?.successRate || 0).toFixed(2) + '%',
      },
      details: {
        providers,
      },
      charts: [
        {
          type: 'bar',
          title: 'Provider Success Rates',
          data: providers,
        },
      ],
    };
  }

  private async generateHistoricalComparisonReport(params: ReportParams): Promise<ReportData> {
    if (!params.compareWith) {
      throw new Error('compareWith dates are required for historical comparison');
    }

    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const notificationLogs = db.collection('notification_logs');

    // Current period
    const currentPipeline = [
      {
        $match: {
          createdAt: { $gte: params.startDate, $lte: params.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          successRate: {
            $multiply: [
              {
                $divide: [
                  { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                  { $sum: 1 },
                ],
              },
              100,
            ],
          },
        },
      },
    ];

    // Previous period
    const previousPipeline = [
      {
        $match: {
          createdAt: { $gte: params.compareWith.startDate, $lte: params.compareWith.endDate },
          ...(params.tenantId && { 'tenantId': new mongoose.Types.ObjectId(params.tenantId) }),
        },
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalDelivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          successRate: {
            $multiply: [
              {
                $divide: [
                  { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                  { $sum: 1 },
                ],
              },
              100,
            ],
          },
        },
      },
    ];

    const [currentData, previousData] = await Promise.all([
      notificationLogs.aggregate(currentPipeline).toArray(),
      notificationLogs.aggregate(previousPipeline).toArray(),
    ]);

    const current = currentData[0] || {};
    const previous = previousData[0] || {};

    return {
      title: 'Historical Comparison Report',
      type: ReportType.HISTORICAL_COMPARISON,
      generatedAt: new Date(),
      period: { startDate: params.startDate, endDate: params.endDate },
      summary: {
        currentPeriod: {
          totalSent: current.totalSent || 0,
          successRate: (current.successRate || 0).toFixed(2) + '%',
        },
        previousPeriod: {
          totalSent: previous.totalSent || 0,
          successRate: (previous.successRate || 0).toFixed(2) + '%',
        },
        growth: (((current.totalSent - previous.totalSent) / previous.totalSent) * 100).toFixed(2) + '%',
      },
      details: {
        comparison: { current, previous },
      },
    };
  }

  async exportReport(report: ReportData, format: ExportFormat): Promise<Buffer> {
    switch (format) {
      case ExportFormat.PDF:
        return this.exportPDF(report);
      case ExportFormat.CSV:
        return this.exportCSV(report);
      case ExportFormat.JSON:
        return this.exportJSON(report);
      case ExportFormat.HTML:
        return this.exportHTML(report);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  private exportPDF(report: ReportData): Buffer {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    doc.fontSize(20).text(report.title, 50, 50);
    doc.fontSize(10).text(`Generated: ${report.generatedAt.toLocaleString()}`, 50, 80);
    doc.text(`Period: ${report.period.startDate.toDateString()} to ${report.period.endDate.toDateString()}`, 50, 100);

    let y = 130;
    doc.fontSize(12).text('Summary', 50, y);
    y += 20;

    for (const [key, value] of Object.entries(report.summary)) {
      doc.fontSize(10).text(`${key}: ${value}`, 60, y);
      y += 15;
    }

    doc.end();

    return Buffer.concat(chunks);
  }

  private exportCSV(report: ReportData): Buffer {
    const data = Object.entries(report.summary).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      return Buffer.from(csv, 'utf-8');
    } catch (error) {
      log.error('CSV export error', { error });
      return Buffer.from('Error generating CSV', 'utf-8');
    }
  }

  private exportJSON(report: ReportData): Buffer {
    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8');
  }

  private exportHTML(report: ReportData): Buffer {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .summary p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #4CAF50; color: white; }
        </style>
      </head>
      <body>
        <h1>${report.title}</h1>
        <p>Generated: ${report.generatedAt.toLocaleString()}</p>
        <div class="summary">
          ${Object.entries(report.summary)
            .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
            .join('')}
        </div>
      </body>
      </html>
    `;

    return Buffer.from(html, 'utf-8');
  }
}

export default new ReportGenerator();
