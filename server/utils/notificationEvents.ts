// Notification Events & Triggers - Event-driven notification system
import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationEvents');

// Event types
export type NotificationEventType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'driver_assigned'
  | 'driver_unassigned'
  | 'payment_due'
  | 'payment_received'
  | 'payment_overdue'
  | 'vehicle_assigned'
  | 'vehicle_maintenance_due'
  | 'promotion_activated'
  | 'alert_issued'
  | 'support_ticket_created'
  | 'support_ticket_resolved'
  | 'review_requested'
  | 'referral_completed';

export interface NotificationEventData {
  type: NotificationEventType;
  userId: string;
  tenantId: string;
  entityId: string;
  entityType: 'booking' | 'driver' | 'vehicle' | 'payment' | 'promotion' | 'alert' | 'ticket' | 'review' | 'referral';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface NotificationTrigger {
  _id?: string;
  tenantId: string;
  name: string;
  eventType: NotificationEventType;
  enabled: boolean;
  templateId: string;
  channels: string[]; // ['push', 'email', 'sms', 'in_app']
  conditions?: {
    userRole?: string[]; // ['customer', 'driver', 'vendor']
    minAmount?: number;
    maxAmount?: number;
    customFields?: Record<string, any>;
  };
  delay?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  recipients?: {
    type: 'event_user' | 'specific_users' | 'role_based';
    userIds?: string[];
    roles?: string[];
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TriggerExecutionLog {
  _id?: string;
  tenantId: string;
  triggerId: string;
  eventType: NotificationEventType;
  eventData: NotificationEventData;
  status: 'pending' | 'executed' | 'failed' | 'skipped';
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  errorMessage?: string;
  executedAt?: Date;
  createdAt: Date;
}

// Event Emitter for notifications
export class NotificationEventEmitter extends EventEmitter {
  private db: any;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async emit(eventData: NotificationEventData): Promise<void> {
    try {
      log.info('Notification event emitted', {
        type: eventData.type,
        userId: eventData.userId,
        entityId: eventData.entityId
      });

      // Store event for audit trail
      await this.storeEvent(eventData);

      // Emit to listeners
      super.emit(eventData.type, eventData);
    } catch (error) {
      log.error('Failed to emit notification event', { error, eventData });
    }
  }

  private async storeEvent(eventData: NotificationEventData): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const eventsCollection = db.collection('notification_events');
      await eventsCollection.insertOne({
        ...eventData,
        storedAt: new Date()
      });
    } catch (error) {
      log.error('Failed to store event', { error });
    }
  }

  on(event: NotificationEventType, listener: (data: NotificationEventData) => Promise<void>) {
    return super.on(event, listener);
  }

  once(event: NotificationEventType, listener: (data: NotificationEventData) => Promise<void>) {
    return super.once(event, listener);
  }
}

// Trigger Engine
export class NotificationTriggerEngine {
  private emitter: NotificationEventEmitter;
  private triggerMap: Map<NotificationEventType, NotificationTrigger[]> = new Map();
  private db: any;

  constructor() {
    this.emitter = new NotificationEventEmitter();
  }

  async initialize(): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    this.db = db;
    await this.loadTriggers();
    this.registerListeners();
    log.info('Notification trigger engine initialized');
  }

  private async loadTriggers(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const triggersCollection = db.collection('notification_triggers');
      const triggers = await triggersCollection.find({ enabled: true }).toArray();

      this.triggerMap.clear();

      for (const trigger of triggers) {
        const eventType = trigger.eventType as NotificationEventType;
        if (!this.triggerMap.has(eventType)) {
          this.triggerMap.set(eventType, []);
        }
        this.triggerMap.get(eventType)!.push(trigger);
      }

      log.info('Triggers loaded', { totalTriggers: triggers.length });
    } catch (error) {
      log.error('Failed to load triggers', { error });
    }
  }

  private registerListeners(): void {
    const eventTypes: NotificationEventType[] = [
      'booking_created',
      'booking_confirmed',
      'booking_cancelled',
      'booking_completed',
      'driver_assigned',
      'payment_due',
      'payment_received',
      'vehicle_assigned',
      'promotion_activated',
      'alert_issued'
    ];

    for (const eventType of eventTypes) {
      this.emitter.on(eventType, async (eventData: NotificationEventData) => {
        await this.executeTriggers(eventData);
      });
    }
  }

  private async executeTriggers(eventData: NotificationEventData): Promise<void> {
    try {
      const triggers = this.triggerMap.get(eventData.type) || [];

      for (const trigger of triggers) {
        // Verify tenant match
        if (trigger.tenantId !== eventData.tenantId) continue;

        // Check conditions
        if (!this.evaluateConditions(trigger, eventData)) {
          await this.logExecution(trigger, eventData, 'skipped', undefined, 'Conditions not met');
          continue;
        }

        // Execute trigger
        await this.sendNotification(trigger, eventData);
      }
    } catch (error) {
      log.error('Failed to execute triggers', { error, eventData });
    }
  }

  private evaluateConditions(trigger: NotificationTrigger, eventData: NotificationEventData): boolean {
    if (!trigger.conditions) return true;

    const { userRole, minAmount, maxAmount, customFields } = trigger.conditions;

    if (userRole && eventData.metadata?.userRole && !userRole.includes(eventData.metadata.userRole)) {
      return false;
    }

    if (minAmount && eventData.metadata?.amount && eventData.metadata.amount < minAmount) {
      return false;
    }

    if (maxAmount && eventData.metadata?.amount && eventData.metadata.amount > maxAmount) {
      return false;
    }

    if (customFields) {
      for (const [key, value] of Object.entries(customFields)) {
        if (eventData.metadata?.[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private async sendNotification(trigger: NotificationTrigger, eventData: NotificationEventData): Promise<void> {
    try {
      // Get recipients
      const recipients = await this.resolveRecipients(trigger, eventData);

      if (recipients.length === 0) {
        await this.logExecution(trigger, eventData, 'skipped', undefined, 'No recipients matched');
        return;
      }

      // Import delivery orchestrator for sending notifications
      const { notificationDeliveryOrchestrator } = await import('./notificationDeliveryOrchestrator');

      let sentCount = 0;
      let failedCount = 0;

      // Send notification to each recipient via orchestrator
      for (const recipientId of recipients) {
        try {
          // Resolve template and prepare notification content
          const { notificationTemplateManager } = await import('./notificationTemplates');
          const template = await notificationTemplateManager.getTemplate(trigger.templateId);

          if (!template) {
            log.warn('Template not found', { templateId: trigger.templateId, recipientId });
            failedCount++;
            continue;
          }

          // Prepare delivery request with template data
          const deliveryRequest = {
            userId: recipientId,
            title: template.subject || trigger.name,
            body: template.body || '',
            category: eventData.type,
            templateId: trigger.templateId,
            channels: trigger.channels as any[],
            data: {
              ...eventData.metadata,
              entityId: eventData.entityId,
              entityType: eventData.entityType,
              triggerId: trigger._id
            },
            priority: (eventData.metadata?.priority as 'high' | 'normal' | 'low') || 'normal'
          };

          // Send via delivery orchestrator
          const result = await notificationDeliveryOrchestrator.deliver(deliveryRequest);

          if (result.success) {
            sentCount++;
            log.debug('Notification sent to recipient', {
              recipientId,
              triggerId: trigger._id,
              channels: result.sentVia
            });
          } else {
            failedCount++;
            log.warn('Notification delivery failed for recipient', {
              recipientId,
              triggerId: trigger._id,
              reasons: result.skippedReasons
            });
          }
        } catch (error) {
          failedCount++;
          log.error('Error sending notification to recipient', {
            recipientId,
            triggerId: trigger._id,
            error
          });
        }
      }

      log.info('Notifications sent via orchestrator', {
        triggerId: trigger._id,
        eventType: eventData.type,
        recipients: recipients.length,
        sent: sentCount,
        failed: failedCount
      });

      await this.logExecution(trigger, eventData, 'executed', sentCount, undefined);
    } catch (error) {
      log.error('Failed to send notification', { error, triggerId: trigger._id });
      await this.logExecution(trigger, eventData, 'failed', undefined, (error as Error).message);
    }
  }

  private async resolveRecipients(trigger: NotificationTrigger, eventData: NotificationEventData): Promise<string[]> {
    if (!trigger.recipients) {
      return [eventData.userId];
    }

    if (trigger.recipients.type === 'event_user') {
      return [eventData.userId];
    }

    if (trigger.recipients.type === 'specific_users') {
      return trigger.recipients.userIds || [];
    }

    if (trigger.recipients.type === 'role_based') {
      // Query users by role
      const db = mongoose.connection.db;
      if (!db) return [];

      const usersCollection = db.collection('users');
      const users = await usersCollection
        .find({
          tenantId: eventData.tenantId,
          role: { $in: trigger.recipients.roles || [] }
        })
        .project({ _id: 1 })
        .toArray();

      return users.map(u => u._id.toString());
    }

    return [];
  }

  private async logExecution(
    trigger: NotificationTrigger,
    eventData: NotificationEventData,
    status: TriggerExecutionLog['status'],
    sentCount?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const logsCollection = db.collection('trigger_execution_logs');
      await logsCollection.insertOne({
        tenantId: eventData.tenantId,
        triggerId: trigger._id,
        eventType: eventData.type,
        eventData,
        status,
        sentCount,
        errorMessage,
        createdAt: new Date()
      });
    } catch (error) {
      log.error('Failed to log execution', { error });
    }
  }

  async emitEvent(eventData: NotificationEventData): Promise<void> {
    // Apply delay if specified in trigger
    const triggers = this.triggerMap.get(eventData.type) || [];

    for (const trigger of triggers) {
      if (trigger.delay) {
        const delayMs = this.calculateDelay(trigger.delay);
        setTimeout(() => {
          this.emitter.emit(eventData);
        }, delayMs);
      } else {
        await this.emitter.emit(eventData);
      }
    }
  }

  private calculateDelay(delay: { value: number; unit: string }): number {
    const multipliers: Record<string, number> = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };

    return delay.value * (multipliers[delay.unit] || 0);
  }

  async createTrigger(trigger: NotificationTrigger): Promise<NotificationTrigger> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const triggersCollection = db.collection('notification_triggers');

    const result = await triggersCollection.insertOne({
      ...trigger,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const newTrigger = { ...trigger, _id: result.insertedId };

    // Reload triggers
    await this.loadTriggers();
    this.registerListeners();

    log.info('Trigger created', { triggerId: result.insertedId, eventType: trigger.eventType });

    return newTrigger;
  }

  async updateTrigger(triggerId: string, updates: Partial<NotificationTrigger>): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const triggersCollection = db.collection('notification_triggers');

    await triggersCollection.updateOne(
      { _id: new (mongoose as any).Types.ObjectId(triggerId) },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    // Reload triggers
    await this.loadTriggers();
    this.registerListeners();

    log.info('Trigger updated', { triggerId });
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const triggersCollection = db.collection('notification_triggers');

    await triggersCollection.deleteOne({
      _id: new (mongoose as any).Types.ObjectId(triggerId)
    });

    // Reload triggers
    await this.loadTriggers();
    this.registerListeners();

    log.info('Trigger deleted', { triggerId });
  }

  async getTriggers(tenantId: string): Promise<NotificationTrigger[]> {
    const db = mongoose.connection.db;
    if (!db) return [];

    const triggersCollection = db.collection('notification_triggers');
    return await triggersCollection.find({ tenantId }).toArray();
  }

  async getExecutionLogs(tenantId: string, limit: number = 100): Promise<TriggerExecutionLog[]> {
    const db = mongoose.connection.db;
    if (!db) return [];

    const logsCollection = db.collection('trigger_execution_logs');
    return await logsCollection
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  getEventEmitter(): NotificationEventEmitter {
    return this.emitter;
  }
}

// Singleton instance
let triggerEngine: NotificationTriggerEngine | null = null;

export function getTriggerEngine(): NotificationTriggerEngine {
  if (!triggerEngine) {
    triggerEngine = new NotificationTriggerEngine();
  }
  return triggerEngine;
}

export async function initializeTriggerEngine(): Promise<NotificationTriggerEngine> {
  const engine = getTriggerEngine();
  await engine.initialize();
  return engine;
}
