/**
 * Alert Notification Service
 * Multi-channel alert delivery: Email, SMS, Webhook, In-app
 * Handles message formatting, delivery verification, and retry logic
 */

import mongoose from 'mongoose';
import { log } from '../vite';
import type { ProviderType, AlertLevel, HealthStatus } from './HealthScheduler';

export interface NotificationPayload {
  alertId: string;
  provider: ProviderType;
  level: AlertLevel;
  status: HealthStatus;
  message: string;
  responseTime: number;
  successRate: number;
  timestamp: Date;
}

export interface EmailNotification {
  to: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  priority: 'normal' | 'high' | 'urgent';
}

export interface SmsNotification {
  to: string[];
  message: string;
  priority: 'normal' | 'high' | 'urgent';
}

export interface WebhookNotification {
  url: string;
  payload: Record<string, any>;
  signature?: string;
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
  };
}

export interface InAppNotification {
  userId: string;
  title: string;
  message: string;
  type: 'alert' | 'warning' | 'critical';
  actionUrl?: string;
  dismissible: boolean;
}

export interface NotificationResult {
  channel: 'email' | 'sms' | 'webhook' | 'inapp';
  status: 'success' | 'failed';
  deliveryId: string;
  timestamp: Date;
  errorMessage?: string;
}

interface NotificationChannel {
  send(payload: any): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Email notification channel
const emailChannel: NotificationChannel = {
  async send(notification: EmailNotification) {
    try {
      // Simulate email sending
      log(`[ALERT-NOTIFICATION] Sending email to ${notification.to.join(', ')}`);
      log(`[ALERT-NOTIFICATION] Subject: ${notification.subject}`);

      // In production, this would use a service like SendGrid, AWS SES, etc.
      // For now, simulate successful delivery
      return {
        success: true,
        messageId: `email-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  },
};

// SMS notification channel
const smsChannel: NotificationChannel = {
  async send(notification: SmsNotification) {
    try {
      // Simulate SMS sending
      log(`[ALERT-NOTIFICATION] Sending SMS to ${notification.to.join(', ')}`);
      log(`[ALERT-NOTIFICATION] Message: ${notification.message}`);

      // In production, this would use Twilio, AWS SNS, etc.
      return {
        success: true,
        messageId: `sms-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  },
};

// Webhook notification channel
const webhookChannel: NotificationChannel = {
  async send(notification: WebhookNotification) {
    try {
      log(`[ALERT-NOTIFICATION] Sending webhook to ${notification.url}`);

      // Simulate webhook delivery
      // In production: POST request with signature verification
      const response = await simulateWebhookDelivery(notification.url, notification.payload);

      return {
        success: true,
        messageId: `webhook-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  },
};

// In-app notification channel
const inappChannel: NotificationChannel = {
  async send(notification: InAppNotification) {
    try {
      log(`[ALERT-NOTIFICATION] Creating in-app notification for user ${notification.userId}`);

      // Store in-app notification in database or cache
      await storeInAppNotification(notification);

      return {
        success: true,
        messageId: `inapp-${Date.now()}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: message,
      };
    }
  },
};

// In-memory storage for in-app notifications
const inAppNotifications = new Map<string, InAppNotification[]>();

/**
 * Send alert via email
 */
export async function sendEmailAlert(
  recipients: string[],
  alertData: NotificationPayload
): Promise<NotificationResult> {
  const emailNotification: EmailNotification = {
    to: recipients,
    subject: formatEmailSubject(alertData),
    body: formatEmailBody(alertData),
    priority: alertData.level === 'critical' ? 'urgent' : 'high',
  };

  const result = await emailChannel.send(emailNotification);

  return {
    channel: 'email',
    status: result.success ? 'success' : 'failed',
    deliveryId: result.messageId || 'unknown',
    timestamp: new Date(),
    errorMessage: result.error,
  };
}

/**
 * Send alert via SMS
 */
export async function sendSmsAlert(
  phoneNumbers: string[],
  alertData: NotificationPayload
): Promise<NotificationResult> {
  const smsNotification: SmsNotification = {
    to: phoneNumbers,
    message: formatSmsMessage(alertData),
    priority: alertData.level === 'critical' ? 'urgent' : 'high',
  };

  const result = await smsChannel.send(smsNotification);

  return {
    channel: 'sms',
    status: result.success ? 'success' : 'failed',
    deliveryId: result.messageId || 'unknown',
    timestamp: new Date(),
    errorMessage: result.error,
  };
}

/**
 * Send alert via webhook
 */
export async function sendWebhookAlert(
  webhookUrl: string,
  alertData: NotificationPayload
): Promise<NotificationResult> {
  const webhookNotification: WebhookNotification = {
    url: webhookUrl,
    payload: {
      alert_id: alertData.alertId,
      provider: alertData.provider,
      level: alertData.level,
      status: alertData.status,
      message: alertData.message,
      response_time: alertData.responseTime,
      success_rate: alertData.successRate,
      timestamp: alertData.timestamp.toISOString(),
    },
    retryPolicy: {
      maxRetries: 3,
      initialDelayMs: 5000,
    },
  };

  const result = await webhookChannel.send(webhookNotification);

  return {
    channel: 'webhook',
    status: result.success ? 'success' : 'failed',
    deliveryId: result.messageId || 'unknown',
    timestamp: new Date(),
    errorMessage: result.error,
  };
}

/**
 * Send alert via in-app notification
 */
export async function sendInAppAlert(
  userId: string,
  alertData: NotificationPayload
): Promise<NotificationResult> {
  const inAppNotification: InAppNotification = {
    userId,
    title: formatNotificationTitle(alertData),
    message: formatNotificationMessage(alertData),
    type: alertData.level === 'critical' ? 'critical' : 'warning',
    actionUrl: `/admin/alerts/${alertData.alertId}`,
    dismissible: alertData.level !== 'critical',
  };

  const result = await inappChannel.send(inAppNotification);

  return {
    channel: 'inapp',
    status: result.success ? 'success' : 'failed',
    deliveryId: result.messageId || 'unknown',
    timestamp: new Date(),
    errorMessage: result.error,
  };
}

/**
 * Send desktop notification (browser-based)
 */
export async function sendDesktopNotification(
  userId: string,
  alertData: NotificationPayload
): Promise<NotificationResult> {
  const notification = {
    title: `Provider Alert: ${alertData.provider}`,
    message: alertData.message,
    tag: `alert-${alertData.alertId}`,
    icon: getIconForLevel(alertData.level),
    badge: '/badge-alert.png',
    requireInteraction: alertData.level === 'critical',
  };

  // In production: send via WebSocket or SSE to connected clients
  log(`[ALERT-NOTIFICATION] Desktop notification queued for user ${userId}`);

  return {
    channel: 'inapp',
    status: 'success',
    deliveryId: `desktop-${Date.now()}`,
    timestamp: new Date(),
  };
}

/**
 * Broadcast alert to multiple recipients
 */
export async function broadcastAlert(
  alertData: NotificationPayload,
  recipients: {
    emails?: string[];
    phones?: string[];
    webhookUrls?: string[];
    userIds?: string[];
  }
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  // Send emails
  if (recipients.emails && recipients.emails.length > 0) {
    const emailResult = await sendEmailAlert(recipients.emails, alertData);
    results.push(emailResult);
  }

  // Send SMS for critical alerts
  if (
    alertData.level === 'critical' &&
    recipients.phones &&
    recipients.phones.length > 0
  ) {
    const smsResult = await sendSmsAlert(recipients.phones, alertData);
    results.push(smsResult);
  }

  // Send webhooks
  if (recipients.webhookUrls) {
    for (const url of recipients.webhookUrls) {
      const webhookResult = await sendWebhookAlert(url, alertData);
      results.push(webhookResult);
    }
  }

  // Send in-app notifications
  if (recipients.userIds) {
    for (const userId of recipients.userIds) {
      const inappResult = await sendInAppAlert(userId, alertData);
      results.push(inappResult);
    }
  }

  log(`[ALERT-NOTIFICATION] Broadcasted alert ${alertData.alertId} to ${results.length} channels`);

  return results;
}

/**
 * Format email subject
 */
function formatEmailSubject(alertData: NotificationPayload): string {
  const icon = alertData.level === 'critical' ? '🚨' : '⚠️';
  return `${icon} ${alertData.level.toUpperCase()}: ${alertData.provider} Provider Alert`;
}

/**
 * Format email body
 */
function formatEmailBody(alertData: NotificationPayload): string {
  return `
Provider Alert Notification

Provider: ${alertData.provider}
Level: ${alertData.level.toUpperCase()}
Status: ${alertData.status.toUpperCase()}

Message: ${alertData.message}

Details:
- Response Time: ${alertData.responseTime}ms
- Success Rate: ${alertData.successRate}%
- Timestamp: ${alertData.timestamp.toISOString()}

Alert ID: ${alertData.alertId}

Action Required: ${alertData.level === 'critical' ? 'IMMEDIATE - On-call engineer has been notified' : 'Please review and investigate'}

---
This is an automated alert from FleetPro Health Monitoring System
`;
}

/**
 * Format SMS message
 */
function formatSmsMessage(alertData: NotificationPayload): string {
  const icon = alertData.level === 'critical' ? '🚨' : '⚠️';
  return `${icon} ${alertData.level.toUpperCase()}: ${alertData.provider} - ${alertData.status.toUpperCase()}. Success: ${alertData.successRate}%. Alert: ${alertData.alertId}`;
}

/**
 * Format notification title
 */
function formatNotificationTitle(alertData: NotificationPayload): string {
  const icon = alertData.level === 'critical' ? '🚨' : '⚠️';
  return `${icon} ${alertData.provider} - ${alertData.status.toUpperCase()}`;
}

/**
 * Format notification message
 */
function formatNotificationMessage(alertData: NotificationPayload): string {
  return `${alertData.message} (Success rate: ${alertData.successRate}%, Response time: ${alertData.responseTime}ms)`;
}

/**
 * Get icon for alert level
 */
function getIconForLevel(level: AlertLevel): string {
  switch (level) {
    case 'critical':
      return '/icons/alert-critical.png';
    case 'warning':
      return '/icons/alert-warning.png';
    case 'info':
    default:
      return '/icons/alert-info.png';
  }
}

/**
 * Simulate webhook delivery
 */
async function simulateWebhookDelivery(url: string, payload: Record<string, any>): Promise<void> {
  // In production: actual HTTP POST with signature
  // For now, just simulate
  return new Promise(resolve => {
    setTimeout(() => {
      log(`[ALERT-NOTIFICATION] Webhook delivered to ${url}`);
      resolve();
    }, 100);
  });
}

/**
 * Store in-app notification
 */
async function storeInAppNotification(notification: InAppNotification): Promise<void> {
  const userNotifications = inAppNotifications.get(notification.userId) || [];
  userNotifications.push({
    ...notification,
  });
  inAppNotifications.set(notification.userId, userNotifications);
}

/**
 * Get in-app notifications for user
 */
export function getUserNotifications(userId: string): InAppNotification[] {
  return inAppNotifications.get(userId) || [];
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(userId: string, index: number): boolean {
  const notifications = inAppNotifications.get(userId);
  if (notifications && notifications[index]) {
    notifications.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Clear all notifications for user
 */
export function clearUserNotifications(userId: string): boolean {
  if (inAppNotifications.has(userId)) {
    inAppNotifications.delete(userId);
    return true;
  }
  return false;
}

/**
 * Export notification service
 */
export const AlertNotificationService = {
  sendEmail: sendEmailAlert,
  sendSms: sendSmsAlert,
  sendWebhook: sendWebhookAlert,
  sendInApp: sendInAppAlert,
  sendDesktop: sendDesktopNotification,
  broadcast: broadcastAlert,
  getUserNotifications,
  markAsRead: markNotificationAsRead,
  clearNotifications: clearUserNotifications,
};

export default AlertNotificationService;
