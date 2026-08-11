/**
 * Webhook Storage - MongoDB Implementation
 * Handles webhook event storage, history, search, filtering, and replay capability
 */

import mongoose, { Document, Schema } from 'mongoose';
import { nanoid } from 'nanoid';

/**
 * Webhook event storage schema
 */
const webhookEventSchema = new Schema({
  _id: { type: String, default: () => nanoid() },
  webhookId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true, sparse: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed', 'retried', 'discarded'],
    default: 'pending',
    index: true,
  },
  deliveryAttempts: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
  nextRetryAt: { type: Date },
  statusCode: { type: Number },
  errorMessage: { type: String },
  responseTime: { type: Number }, // milliseconds
  responseData: { type: Schema.Types.Mixed },
  retryHistory: [
    {
      attemptNumber: Number,
      timestamp: { type: Date, default: Date.now },
      statusCode: Number,
      error: String,
      responseTime: Number,
    },
  ],
  metadata: {
    userAgent: String,
    ipAddress: String,
    sourceSystem: String,
  },
  tags: [String],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: true,
    expires: 0, // TTL index
  },
});

/**
 * Webhook configuration schema
 */
const webhookConfigSchema = new Schema({
  _id: { type: String, default: () => nanoid() },
  tenantId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  events: [String],
  secret: { type: String, required: true },
  isActive: { type: Boolean, default: true, index: true },
  name: String,
  description: String,
  headers: Schema.Types.Mixed,
  testUrl: String,
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    failedDeliveries: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    lastDeliveryAt: Date,
  },
  rateLimit: {
    enabled: { type: Boolean, default: false },
    requestsPerSecond: Number,
  },
  timeout: { type: Number, default: 30000 }, // milliseconds
  retryPolicy: {
    maxRetries: { type: Number, default: 5 },
    backoffMultiplier: { type: Number, default: 2 },
    initialDelayMs: { type: Number, default: 1000 },
    maxDelayMs: { type: Number, default: 3600000 },
  },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: Date,
});

/**
 * Webhook audit schema
 */
const webhookAuditSchema = new Schema({
  _id: { type: String, default: () => nanoid() },
  webhookId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  action: {
    type: String,
    enum: [
      'created',
      'updated',
      'deleted',
      'tested',
      'delivered',
      'retried',
      'disabled',
      'enabled',
    ],
    index: true,
  },
  actor: {
    userId: String,
    email: String,
    ipAddress: String,
  },
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  details: String,
  status: { type: String, enum: ['success', 'failure'], default: 'success' },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    expires: 0,
  },
});

// Create models
const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
const WebhookConfig = mongoose.model('WebhookConfig', webhookConfigSchema);
const WebhookAudit = mongoose.model('WebhookAudit', webhookAuditSchema);

export interface IWebhookEvent extends Document {
  webhookId: string;
  tenantId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retried' | 'discarded';
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  statusCode?: number;
  errorMessage?: string;
  responseTime?: number;
  responseData?: Record<string, any>;
  metadata?: any;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export class WebhookStorageService {
  /**
   * Store webhook event
   */
  async storeEvent(eventData: Partial<IWebhookEvent>): Promise<IWebhookEvent> {
    const event = new WebhookEvent({
      ...eventData,
      _id: eventData._id || nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return event.save();
  }

  /**
   * Update event status
   */
  async updateEventStatus(
    eventId: string,
    status: string,
    updates: Partial<IWebhookEvent>
  ): Promise<IWebhookEvent | null> {
    return WebhookEvent.findByIdAndUpdate(
      eventId,
      {
        status,
        ...updates,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Record retry attempt
   */
  async recordRetry(
    eventId: string,
    attemptNumber: number,
    statusCode: number | null,
    error: string | null,
    responseTime: number
  ): Promise<IWebhookEvent | null> {
    return WebhookEvent.findByIdAndUpdate(
      eventId,
      {
        $inc: { deliveryAttempts: 1 },
        $push: {
          retryHistory: {
            attemptNumber,
            timestamp: new Date(),
            statusCode,
            error,
            responseTime,
          },
        },
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<IWebhookEvent | null> {
    return WebhookEvent.findById(eventId);
  }

  /**
   * Get events for webhook
   */
  async getWebhookEvents(
    webhookId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      eventType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ events: IWebhookEvent[]; total: number }> {
    const { limit = 50, offset = 0, status, eventType, startDate, endDate } =
      options;

    const filter: Record<string, any> = { webhookId };

    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const [events, total] = await Promise.all([
      WebhookEvent.find(filter).limit(limit).skip(offset).sort({ createdAt: -1 }),
      WebhookEvent.countDocuments(filter),
    ]);

    return { events, total };
  }

  /**
   * Search events
   */
  async searchEvents(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      offset?: number;
      fields?: string[];
    } = {}
  ): Promise<IWebhookEvent[]> {
    const { limit = 50, offset = 0, fields = ['eventType', 'payload', 'errorMessage'] } = options;

    const searchFilter = {
      tenantId,
      $or: fields.map((field) => ({
        [field]: new RegExp(query, 'i'),
      })),
    };

    return WebhookEvent.find(searchFilter).limit(limit).skip(offset).sort({ createdAt: -1 });
  }

  /**
   * Get events by status
   */
  async getEventsByStatus(
    tenantId: string,
    status: string,
    limit: number = 100
  ): Promise<IWebhookEvent[]> {
    return WebhookEvent.find({ tenantId, status })
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  /**
   * Get failed events for retry
   */
  async getFailedEventsForRetry(
    limit: number = 100
  ): Promise<IWebhookEvent[]> {
    const now = new Date();
    return WebhookEvent.find({
      status: 'failed',
      nextRetryAt: { $lte: now },
      deliveryAttempts: { $lt: 5 },
    })
      .limit(limit)
      .sort({ nextRetryAt: 1 });
  }

  /**
   * Get dead letter events
   */
  async getDeadLetterEvents(
    tenantId: string,
    limit: number = 100
  ): Promise<IWebhookEvent[]> {
    return WebhookEvent.find({
      tenantId,
      status: 'discarded',
      deliveryAttempts: { $gte: 5 },
    })
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  /**
   * Save webhook configuration
   */
  async saveConfig(configData: Partial<Document>): Promise<any> {
    const config = new WebhookConfig({
      ...configData,
      _id: configData._id || nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return config.save();
  }

  /**
   * Update webhook configuration
   */
  async updateConfig(webhookId: string, updates: Partial<Document>): Promise<any | null> {
    return WebhookConfig.findByIdAndUpdate(
      webhookId,
      {
        ...updates,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Get webhook configuration
   */
  async getConfig(webhookId: string): Promise<any | null> {
    return WebhookConfig.findById(webhookId);
  }

  /**
   * Get all webhooks for tenant
   */
  async getTenantWebhooks(tenantId: string): Promise<any[]> {
    return WebhookConfig.find({
      tenantId,
      deletedAt: { $exists: false },
    }).sort({ createdAt: -1 });
  }

  /**
   * Delete webhook configuration
   */
  async deleteConfig(webhookId: string): Promise<any | null> {
    return WebhookConfig.findByIdAndUpdate(
      webhookId,
      { deletedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Record audit log
   */
  async recordAudit(auditData: Partial<Document>): Promise<any> {
    const audit = new WebhookAudit({
      ...auditData,
      _id: auditData._id || nanoid(),
      createdAt: new Date(),
    });
    return audit.save();
  }

  /**
   * Get audit logs for webhook
   */
  async getAuditLogs(
    webhookId: string,
    limit: number = 100
  ): Promise<any[]> {
    return WebhookAudit.find({ webhookId })
      .limit(limit)
      .sort({ createdAt: -1 });
  }

  /**
   * Get statistics
   */
  async getStatistics(tenantId: string): Promise<any> {
    const [
      totalEvents,
      deliveredCount,
      failedCount,
      pendingCount,
      discardedCount,
      avgResponseTime,
    ] = await Promise.all([
      WebhookEvent.countDocuments({ tenantId }),
      WebhookEvent.countDocuments({ tenantId, status: 'delivered' }),
      WebhookEvent.countDocuments({ tenantId, status: 'failed' }),
      WebhookEvent.countDocuments({ tenantId, status: 'pending' }),
      WebhookEvent.countDocuments({ tenantId, status: 'discarded' }),
      WebhookEvent.aggregate([
        { $match: { tenantId } },
        { $group: { _id: null, avg: { $avg: '$responseTime' } } },
      ]),
    ]);

    return {
      totalEvents,
      deliveredCount,
      failedCount,
      pendingCount,
      discardedCount,
      successRate: totalEvents > 0 ? (deliveredCount / totalEvents) * 100 : 0,
      averageResponseTime:
        avgResponseTime.length > 0 ? Math.round(avgResponseTime[0].avg) : 0,
      timestamp: new Date(),
    };
  }

  /**
   * Cleanup old events (TTL-based)
   */
  async cleanupOldEvents(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await WebhookEvent.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: 'delivered',
    });
    return result.deletedCount || 0;
  }
}

export { WebhookEvent, WebhookConfig, WebhookAudit };
export default WebhookStorageService;
