import { EventEmitter } from "events";

interface NotificationRule {
  id: string;
  eventType: string;
  priority: "critical" | "high" | "medium" | "low";
  template: string;
  conditions?: Record<string, any>;
  throttleMinutes?: number;
  batchable?: boolean;
}

interface NotificationEvent {
  type: string;
  userId: string;
  tenantId: string;
  data: Record<string, any>;
  timestamp: Date;
}

interface SmartNotification {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  priority: "critical" | "high" | "medium" | "low";
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  channels: ("in-app" | "email" | "sms" | "push")[];
  createdAt: Date;
  sentAt?: Date;
}

class SmartNotificationEngine extends EventEmitter {
  private rules: Map<string, NotificationRule> = new Map();
  private lastNotificationTime: Map<string, Date> = new Map();
  private pendingBatchNotifications: Map<string, SmartNotification[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Critical: Revenue-blocking issues
    this.registerRule({
      id: "booking-surge",
      eventType: "booking.created",
      priority: "critical",
      template: "🔥 Booking Surge! {{count}} new bookings waiting. Assign vehicles now to maximize revenue.",
      conditions: { count: { $gte: 10 } },
      throttleMinutes: 0, // Always notify critical
      batchable: false,
    });

    this.registerRule({
      id: "payment-due",
      eventType: "booking.payment_due",
      priority: "high",
      template: "💰 Payment Due: {{amount}} from {{customer}}. Collect now to boost cash flow.",
      throttleMinutes: 60,
      batchable: true,
    });

    this.registerRule({
      id: "low-vehicles",
      eventType: "vehicle.availability_low",
      priority: "critical",
      template: "🚨 Fleet Alert: Only {{available}} vehicles available. Book more vehicles to capture demand.",
      conditions: { available: { $lte: 2 } },
      throttleMinutes: 0,
      batchable: false,
    });

    // High Priority: Operational issues
    this.registerRule({
      id: "driver-offline",
      eventType: "driver.went_offline",
      priority: "high",
      template: "⚠️ Driver Alert: {{driverName}} went offline. {{pendingBookings}} bookings pending.",
      throttleMinutes: 30,
      batchable: true,
    });

    this.registerRule({
      id: "completion-low",
      eventType: "metrics.completion_rate_low",
      priority: "high",
      template: "📊 Performance Alert: Completion rate {{rate}}%. Review cancellations to improve metrics.",
      conditions: { rate: { $lt: 85 } },
      throttleMinutes: 120,
      batchable: false,
    });

    // Medium Priority: Operational
    this.registerRule({
      id: "booking-completed",
      eventType: "booking.completed",
      priority: "medium",
      template: "✅ Booking Complete: {{bookingId}} from {{customer}}. Revenue: ₹{{amount}}",
      throttleMinutes: 0,
      batchable: true,
    });

    this.registerRule({
      id: "rating-received",
      eventType: "rating.received",
      priority: "medium",
      template: "⭐ New Rating: {{stars}} stars from {{customer}}. {{comment}}",
      throttleMinutes: 0,
      batchable: true,
    });

    // Low Priority: Informational
    this.registerRule({
      id: "maintenance-due",
      eventType: "vehicle.maintenance_due",
      priority: "low",
      template: "🔧 Maintenance Reminder: {{vehicleName}} due for {{serviceType}}. Schedule now.",
      throttleMinutes: 60,
      batchable: true,
    });

    this.registerRule({
      id: "daily-summary",
      eventType: "metrics.daily_summary",
      priority: "low",
      template: "📈 Daily Summary: {{bookings}} bookings, ₹{{revenue}} revenue, {{completionRate}}% completion",
      throttleMinutes: 0,
      batchable: false,
    });

    this.registerRule({
      id: "tip-received",
      eventType: "payment.tip_received",
      priority: "low",
      template: "🎁 Tip Received: ₹{{amount}} from {{customer}} - Your service made an impact!",
      throttleMinutes: 0,
      batchable: true,
    });
  }

  registerRule(rule: NotificationRule) {
    this.rules.set(rule.id, rule);
  }

  async processEvent(event: NotificationEvent): Promise<SmartNotification | null> {
    const rule = this.findMatchingRule(event.type, event.data);
    if (!rule) return null;

    // Check throttle
    const throttleKey = `${event.userId}:${rule.id}`;
    if (rule.throttleMinutes && rule.throttleMinutes > 0) {
      const lastTime = this.lastNotificationTime.get(throttleKey);
      if (lastTime && Date.now() - lastTime.getTime() < rule.throttleMinutes * 60 * 1000) {
        // Queue for batching instead
        if (rule.batchable) {
          this.queueForBatching(event.userId, event.tenantId, rule, event.data);
        }
        return null;
      }
    }

    const notification = this.createNotification(event, rule);
    this.lastNotificationTime.set(throttleKey, new Date());

    // Determine channels based on priority
    const channels = this.determineChannels(rule.priority);
    notification.channels = channels;

    this.emit("notification", notification);
    return notification;
  }

  private findMatchingRule(eventType: string, data: Record<string, any>): NotificationRule | null {
    for (const [, rule] of this.rules) {
      if (rule.eventType === eventType) {
        if (!rule.conditions) return rule;

        // Check conditions
        let matches = true;
        for (const [key, condition] of Object.entries(rule.conditions)) {
          const value = data[key];
          if (condition.$gte && value < condition.$gte) matches = false;
          if (condition.$lte && value > condition.$lte) matches = false;
          if (condition.$lt && value >= condition.$lt) matches = false;
        }

        if (matches) return rule;
      }
    }
    return null;
  }

  private createNotification(event: NotificationEvent, rule: NotificationRule): SmartNotification {
    const message = this.renderTemplate(rule.template, event.data);
    const title = this.generateTitle(rule.priority);

    return {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: event.userId,
      tenantId: event.tenantId,
      title,
      message,
      priority: rule.priority,
      actionUrl: this.getActionUrl(event.type, event.data),
      actionLabel: this.getActionLabel(event.type),
      read: false,
      channels: [],
      createdAt: new Date(),
    };
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(`{{${key}}}`, String(value));
    }
    return result;
  }

  private generateTitle(priority: string): string {
    switch (priority) {
      case "critical":
        return "🚨 Critical Alert";
      case "high":
        return "⚠️ Important Notice";
      case "medium":
        return "ℹ️ Notification";
      case "low":
        return "💡 Info";
      default:
        return "📢 Notification";
    }
  }

  private determineChannels(priority: string): ("in-app" | "email" | "sms" | "push")[] {
    switch (priority) {
      case "critical":
        return ["in-app", "email", "sms", "push"]; // All channels for critical
      case "high":
        return ["in-app", "email", "push"]; // In-app, email, push for high
      case "medium":
        return ["in-app", "email"]; // In-app and email for medium
      case "low":
        return ["in-app"]; // In-app only for low priority
      default:
        return ["in-app"];
    }
  }

  private getActionUrl(eventType: string, data: Record<string, any>): string | undefined {
    const actionMap: Record<string, (data: Record<string, any>) => string> = {
      "booking.created": () => "/bookings/pending",
      "booking.payment_due": (d) => `/bookings/${d.bookingId}`,
      "vehicle.availability_low": () => "/fleet/vehicles/add",
      "driver.went_offline": (d) => `/drivers/${d.driverId}`,
      "booking.completed": (d) => `/bookings/${d.bookingId}`,
      "rating.received": (d) => `/bookings/${d.bookingId}`,
      "vehicle.maintenance_due": (d) => `/maintenance/schedule?vehicle=${d.vehicleId}`,
    };

    const urlFn = actionMap[eventType];
    return urlFn ? urlFn(data) : undefined;
  }

  private getActionLabel(eventType: string): string | undefined {
    const labelMap: Record<string, string> = {
      "booking.created": "Assign Vehicle",
      "booking.payment_due": "Collect Payment",
      "vehicle.availability_low": "Add Vehicles",
      "driver.went_offline": "Reassign",
      "booking.completed": "View Details",
      "rating.received": "Reply",
      "vehicle.maintenance_due": "Schedule",
    };

    return labelMap[eventType];
  }

  private queueForBatching(
    userId: string,
    tenantId: string,
    rule: NotificationRule,
    data: Record<string, any>
  ) {
    const key = `${userId}:${rule.id}`;
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tenantId,
      title: this.generateTitle(rule.priority),
      message: this.renderTemplate(rule.template, data),
      priority: rule.priority,
      read: false,
      channels: this.determineChannels(rule.priority),
      createdAt: new Date(),
    } as SmartNotification;

    if (!this.pendingBatchNotifications.has(key)) {
      this.pendingBatchNotifications.set(key, []);

      // Schedule batch delivery in 5 minutes
      setTimeout(() => {
        const batch = this.pendingBatchNotifications.get(key);
        if (batch && batch.length > 0) {
          this.sendBatchNotification(userId, batch);
          this.pendingBatchNotifications.delete(key);
        }
      }, 5 * 60 * 1000);
    }

    this.pendingBatchNotifications.get(key)?.push(notification);
  }

  private sendBatchNotification(userId: string, notifications: SmartNotification[]) {
    const summary = this.createBatchSummary(notifications);
    const batchNotif: SmartNotification = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tenantId: notifications[0].tenantId,
      title: `📦 ${notifications.length} Notifications`,
      message: summary,
      priority: "medium",
      read: false,
      channels: ["in-app", "email"],
      createdAt: new Date(),
    };

    this.emit("notification", batchNotif);
  }

  private createBatchSummary(notifications: SmartNotification[]): string {
    const criticalCount = notifications.filter((n) => n.priority === "critical").length;
    const highCount = notifications.filter((n) => n.priority === "high").length;
    const mediumCount = notifications.filter((n) => n.priority === "medium").length;

    let summary = `You have ${notifications.length} notifications:\n`;
    if (criticalCount > 0) summary += `\n🚨 ${criticalCount} critical alert${criticalCount > 1 ? "s" : ""}\n`;
    if (highCount > 0) summary += `⚠️ ${highCount} important update${highCount > 1 ? "s" : ""}\n`;
    if (mediumCount > 0) summary += `ℹ️ ${mediumCount} info${mediumCount > 1 ? "s" : ""}\n`;

    summary += `\nView all in your notification center.`;
    return summary;
  }

  getStats() {
    return {
      rulesRegistered: this.rules.size,
      pendingBatches: this.pendingBatchNotifications.size,
      lastNotifications: Array.from(this.lastNotificationTime.entries()).length,
    };
  }
}

// Export singleton
export const notificationEngine = new SmartNotificationEngine();

// Example event triggers
export async function emitBookingCreatedEvent(bookingData: any) {
  await notificationEngine.processEvent({
    type: "booking.created",
    userId: bookingData.tenantId,
    tenantId: bookingData.tenantId,
    data: {
      count: bookingData.pendingCount || 1,
      bookingId: bookingData.id,
      customer: bookingData.customerName,
    },
    timestamp: new Date(),
  });
}

export async function emitPaymentDueEvent(bookingData: any) {
  await notificationEngine.processEvent({
    type: "booking.payment_due",
    userId: bookingData.tenantId,
    tenantId: bookingData.tenantId,
    data: {
      amount: bookingData.amount,
      customer: bookingData.customerName,
      bookingId: bookingData.id,
    },
    timestamp: new Date(),
  });
}

export async function emitCompletionRateLowEvent(tenantData: any) {
  await notificationEngine.processEvent({
    type: "metrics.completion_rate_low",
    userId: tenantData.id,
    tenantId: tenantData.id,
    data: {
      rate: tenantData.completionRate,
    },
    timestamp: new Date(),
  });
}

export async function emitBookingCompletedEvent(bookingData: any) {
  await notificationEngine.processEvent({
    type: "booking.completed",
    userId: bookingData.tenantId,
    tenantId: bookingData.tenantId,
    data: {
      bookingId: bookingData.id,
      customer: bookingData.customerName,
      amount: bookingData.totalAmount,
    },
    timestamp: new Date(),
  });
}
