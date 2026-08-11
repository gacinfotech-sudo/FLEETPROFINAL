import { EventEmitter } from "events";

export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp" | "push";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type NotificationCategory =
  | "booking"
  | "payment"
  | "driver"
  | "customer"
  | "system"
  | "alert"
  | "promotion"
  | "maintenance";

export interface NotificationPreferences {
  userId: string;
  channels: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  categories: {
    [key in NotificationCategory]?: boolean;
  };
  quiet_hours?: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
  batching_enabled: boolean;
  batching_interval: number; // minutes
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
  metadata: Record<string, any>;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  attempts: number;
  lastAttempt?: Date;
  readAt?: Date;
  relatedNotifications?: string[];
}

export interface NotificationBatch {
  id: string;
  userId: string;
  notifications: Notification[];
  createdAt: Date;
  sentAt?: Date;
  channel: NotificationChannel;
  status: "pending" | "sent" | "failed";
}

export interface DeliveryLog {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: "pending" | "sent" | "delivered" | "failed";
  timestamp: Date;
  errorMessage?: string;
  retries: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  titleTemplate: string;
  messageTemplate: string;
  variables: string[]; // e.g., ["bookingId", "customerName"]
  priority: NotificationPriority;
  channels: NotificationChannel[];
}

class NotificationEngine extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private deliveryLogs: DeliveryLog[] = [];
  private templates: Map<string, NotificationTemplate> = new Map();
  private notificationQueues: Map<string, Notification[]> = new Map();
  private batchProcessor: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setupDefaultTemplates();
  }

  private setupDefaultTemplates() {
    const templates: NotificationTemplate[] = [
      {
        id: "booking_confirmed",
        name: "Booking Confirmed",
        category: "booking",
        titleTemplate: "🎉 Booking Confirmed",
        messageTemplate: "Your booking {{bookingId}} is confirmed for {{date}}",
        variables: ["bookingId", "date"],
        priority: "high",
        channels: ["in_app", "sms", "whatsapp"],
      },
      {
        id: "payment_received",
        name: "Payment Received",
        category: "payment",
        titleTemplate: "✅ Payment Received",
        messageTemplate: "₹{{amount}} received for booking {{bookingId}}",
        variables: ["amount", "bookingId"],
        priority: "high",
        channels: ["in_app", "email"],
      },
      {
        id: "driver_assigned",
        name: "Driver Assigned",
        category: "driver",
        titleTemplate: "🚗 Driver Assigned",
        messageTemplate: "{{driverName}} will pick you up in {{eta}} minutes",
        variables: ["driverName", "eta"],
        priority: "high",
        channels: ["in_app", "sms", "push"],
      },
      {
        id: "anomaly_detected",
        name: "Anomaly Detected",
        category: "alert",
        titleTemplate: "⚠️ Anomaly Alert",
        messageTemplate: "{{anomalyType}} detected: {{description}}",
        variables: ["anomalyType", "description"],
        priority: "urgent",
        channels: ["in_app", "email"],
      },
      {
        id: "maintenance_due",
        name: "Maintenance Due",
        category: "maintenance",
        titleTemplate: "🔧 Maintenance Reminder",
        messageTemplate: "Vehicle {{vehicleId}} needs {{serviceType}} maintenance",
        variables: ["vehicleId", "serviceType"],
        priority: "medium",
        channels: ["in_app", "email"],
      },
      {
        id: "churn_risk",
        name: "Churn Risk Alert",
        category: "customer",
        titleTemplate: "💬 We Miss You!",
        messageTemplate: "Get {{discount}}% off your next ride",
        variables: ["discount"],
        priority: "medium",
        channels: ["in_app", "whatsapp", "push"],
      },
      {
        id: "surge_pricing",
        name: "Surge Pricing Alert",
        category: "promotion",
        titleTemplate: "📈 High Demand",
        messageTemplate: "Prices are {{multiplier}}x normal due to high demand",
        variables: ["multiplier"],
        priority: "medium",
        channels: ["in_app", "push"],
      },
      {
        id: "system_alert",
        name: "System Alert",
        category: "system",
        titleTemplate: "🚨 System Alert",
        messageTemplate: "{{alertMessage}}",
        variables: ["alertMessage"],
        priority: "urgent",
        channels: ["in_app", "email"],
      },
    ];

    templates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  createNotification(data: {
    userId: string;
    title: string;
    message: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    channels?: NotificationChannel[];
    actionUrl?: string;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  }): Notification {
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: data.userId,
      title: data.title,
      message: data.message,
      category: data.category,
      priority: data.priority,
      channels: data.channels || ["in_app"],
      createdAt: new Date(),
      expiresAt: data.expiresAt,
      actionUrl: data.actionUrl,
      metadata: data.metadata || {},
      status: "pending",
      attempts: 0,
      relatedNotifications: [],
    };

    this.notifications.set(notification.id, notification);

    // Check preferences and adjust channels
    const prefs = this.getUserPreferences(data.userId);
    if (prefs) {
      notification.channels = notification.channels.filter(
        (channel) => prefs.channels[channel] !== false
      );
    }

    // Check if we're in quiet hours
    if (prefs?.quiet_hours) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const inQuietHours =
        currentTime >= prefs.quiet_hours.start &&
        currentTime <= prefs.quiet_hours.end;

      if (inQuietHours) {
        notification.channels = notification.channels.filter((c) => c !== "sms" && c !== "push");
      }
    }

    // Batch if enabled
    if (prefs?.batching_enabled) {
      this.addToQueue(notification);
      this.ensureBatchProcessor(data.userId, prefs.batching_interval);
    } else {
      this.deliverNotification(notification);
    }

    this.emit("notification:created", notification);
    return notification;
  }

  createFromTemplate(data: {
    userId: string;
    templateId: string;
    variables: Record<string, any>;
  }): Notification | null {
    const template = this.templates.get(data.templateId);
    if (!template) return null;

    const title = this.interpolateTemplate(template.titleTemplate, data.variables);
    const message = this.interpolateTemplate(template.messageTemplate, data.variables);

    return this.createNotification({
      userId: data.userId,
      title,
      message,
      category: template.category,
      priority: template.priority,
      channels: template.channels,
      metadata: { templateId: data.templateId, variables: data.variables },
    });
  }

  private interpolateTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(`{{${key}}}`, String(value));
    }
    return result;
  }

  setUserPreferences(preferences: NotificationPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
    this.emit("preferences:updated", preferences);
  }

  getUserPreferences(userId: string): NotificationPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  private addToQueue(notification: Notification): void {
    const userId = notification.userId;
    if (!this.notificationQueues.has(userId)) {
      this.notificationQueues.set(userId, []);
    }
    this.notificationQueues.get(userId)!.push(notification);
  }

  private ensureBatchProcessor(userId: string, intervalMinutes: number): void {
    if (this.batchProcessor.has(userId)) return;

    const timeoutId = setTimeout(
      () => {
        this.processBatch(userId);
        this.batchProcessor.delete(userId);
      },
      intervalMinutes * 60 * 1000
    );

    this.batchProcessor.set(userId, timeoutId);
  }

  private processBatch(userId: string): void {
    const queue = this.notificationQueues.get(userId);
    if (!queue || queue.length === 0) return;

    const batch: NotificationBatch = {
      id: `batch_${Date.now()}_${userId}`,
      userId,
      notifications: queue,
      createdAt: new Date(),
      channel: "email", // Default to email for batches
      status: "pending",
    };

    // Send batch
    this.sendBatch(batch);

    // Clear queue
    this.notificationQueues.delete(userId);
  }

  private sendBatch(batch: NotificationBatch): void {
    batch.sentAt = new Date();
    batch.status = "sent";

    batch.notifications.forEach((notif) => {
      this.logDelivery(notif.id, notif.userId, batch.channel, "sent");
    });

    this.emit("batch:sent", batch);
  }

  private deliverNotification(notification: Notification): void {
    notification.attempts++;
    notification.lastAttempt = new Date();

    // Simulate delivery to multiple channels
    notification.channels.forEach((channel) => {
      const success = this.simulateChannelDelivery(channel, notification);

      if (success) {
        this.logDelivery(notification.id, notification.userId, channel, "sent");
      } else {
        this.logDelivery(
          notification.id,
          notification.userId,
          channel,
          "failed",
          "Delivery failed"
        );

        // Retry up to 3 times
        if (notification.attempts < 3) {
          setTimeout(() => {
            this.deliverNotification(notification);
          }, 5000 * notification.attempts); // Exponential backoff
        }
      }
    });

    notification.status = "sent";
    this.emit("notification:sent", notification);
  }

  private simulateChannelDelivery(
    channel: NotificationChannel,
    notification: Notification
  ): boolean {
    // In production, this would integrate with actual services (SendGrid, Twilio, etc.)
    const successRate = channel === "in_app" ? 0.99 : 0.95;
    return Math.random() < successRate;
  }

  markAsRead(notificationId: string): boolean {
    const notif = this.notifications.get(notificationId);
    if (notif) {
      notif.status = "read";
      notif.readAt = new Date();
      this.emit("notification:read", notif);
      return true;
    }
    return false;
  }

  getUserNotifications(userId: string, limit: number = 50): Notification[] {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  getUnreadNotifications(userId: string): Notification[] {
    return this.getUserNotifications(userId).filter((n) => n.status !== "read");
  }

  private logDelivery(
    notificationId: string,
    userId: string,
    channel: NotificationChannel,
    status: "pending" | "sent" | "delivered" | "failed",
    errorMessage?: string
  ): void {
    this.deliveryLogs.push({
      notificationId,
      userId,
      channel,
      status,
      timestamp: new Date(),
      errorMessage,
      retries: 0,
    });

    // Keep only last 10000 logs
    if (this.deliveryLogs.length > 10000) {
      this.deliveryLogs.shift();
    }
  }

  getDeliveryStats(): {
    totalNotifications: number;
    sent: number;
    failed: number;
    pending: number;
    deliveryRate: number;
    topCategories: Record<string, number>;
    topChannels: Record<NotificationChannel, number>;
    avgDeliveryTime: number;
  } {
    const notifications = Array.from(this.notifications.values());
    const sent = notifications.filter((n) => n.status === "sent").length;
    const failed = notifications.filter((n) => n.status === "failed").length;
    const pending = notifications.filter((n) => n.status === "pending").length;

    const topCategories: Record<string, number> = {};
    const topChannels: Record<NotificationChannel, number> = {
      in_app: 0,
      email: 0,
      sms: 0,
      whatsapp: 0,
      push: 0,
    };

    notifications.forEach((n) => {
      topCategories[n.category] = (topCategories[n.category] || 0) + 1;
      n.channels.forEach((c) => {
        topChannels[c]++;
      });
    });

    const deliveryRate =
      notifications.length > 0 ? (sent / notifications.length) * 100 : 0;

    // Calculate average delivery time
    const deliveredNotifs = notifications.filter((n) => n.readAt || n.lastAttempt);
    const avgDeliveryTime =
      deliveredNotifs.length > 0
        ? deliveredNotifs.reduce((sum, n) => {
            const createdTime = n.createdAt.getTime();
            const deliveredTime = (n.readAt || n.lastAttempt)!.getTime();
            return sum + (deliveredTime - createdTime);
          }, 0) / deliveredNotifs.length
        : 0;

    return {
      totalNotifications: notifications.length,
      sent,
      failed,
      pending,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      topCategories,
      topChannels,
      avgDeliveryTime: Math.round(avgDeliveryTime / 1000), // Convert to seconds
    };
  }

  cleanupExpiredNotifications(): number {
    const now = new Date();
    let removed = 0;

    for (const [id, notif] of this.notifications.entries()) {
      if (notif.expiresAt && notif.expiresAt < now) {
        this.notifications.delete(id);
        removed++;
      }
    }

    return removed;
  }

  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }
}

export const notificationEngine = new NotificationEngine();
