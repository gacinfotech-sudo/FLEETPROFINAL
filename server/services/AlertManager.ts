/**
 * Alert Manager Service
 * Manages alert escalation, history tracking, muting, and delivery verification
 * Features: escalation workflow, alert templates, delivery tracking, dead letter queue
 */

import mongoose from 'mongoose';
import { log } from '../vite';
import type { ProviderType, AlertLevel, HealthStatus } from './HealthScheduler';

export interface EscalationPolicy {
  level: AlertLevel;
  delayMinutes: number;
  notifyChannels: ('email' | 'sms' | 'webhook' | 'inapp')[];
  pageOnCall: boolean;
  escalateAfterMinutes?: number;
  escalateTo?: 'supervisor' | 'manager' | 'director';
}

export interface AlertTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'teams';
  subject?: string;
  body: string;
  variables: string[];
  createdAt: Date;
}

export interface AlertDelivery {
  id: string;
  alertId: string;
  channel: 'email' | 'sms' | 'webhook' | 'inapp';
  recipient: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
  nextRetryAt?: Date;
}

export interface MutedAlert {
  pattern: {
    provider?: ProviderType;
    level?: AlertLevel;
    status?: HealthStatus;
  };
  reason: string;
  mutedAt: Date;
  unmutedAt?: Date;
  isMuted: boolean;
}

export interface AlertWithDelivery {
  alertId: string;
  provider: ProviderType;
  level: AlertLevel;
  status: HealthStatus;
  message: string;
  createdAt: Date;
  deliveries: AlertDelivery[];
  escalationLevel: number;
  isMuted: boolean;
}

interface StoredTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'teams';
  subject?: string;
  body: string;
  variables: string[];
}

// Default escalation policies
const DEFAULT_ESCALATION_POLICIES: Record<AlertLevel, EscalationPolicy> = {
  info: {
    level: 'info',
    delayMinutes: 0,
    notifyChannels: ['inapp'],
    pageOnCall: false,
  },
  warning: {
    level: 'warning',
    delayMinutes: 5,
    notifyChannels: ['email', 'inapp'],
    pageOnCall: false,
    escalateAfterMinutes: 30,
    escalateTo: 'supervisor',
  },
  critical: {
    level: 'critical',
    delayMinutes: 0,
    notifyChannels: ['sms', 'webhook', 'email', 'inapp'],
    pageOnCall: true,
    escalateAfterMinutes: 15,
    escalateTo: 'manager',
  },
};

// Default alert templates
const DEFAULT_TEMPLATES: StoredTemplate[] = [
  {
    id: 'provider-down-email',
    name: 'Provider Down - Email',
    type: 'email',
    subject: '🚨 ALERT: {{provider}} Provider Down',
    body: `Provider {{provider}} is currently CRITICAL.

Status: {{status}}
Response Time: {{responseTime}}ms
Success Rate: {{successRate}}%
Message: {{message}}

Time: {{timestamp}}
Action Required: Please investigate immediately.`,
    variables: ['provider', 'status', 'responseTime', 'successRate', 'message', 'timestamp'],
  },
  {
    id: 'provider-down-sms',
    name: 'Provider Down - SMS',
    type: 'sms',
    body: '🚨 {{provider}} CRITICAL: {{message}} #{{alertId}}',
    variables: ['provider', 'message', 'alertId'],
  },
  {
    id: 'provider-degraded-email',
    name: 'Provider Degraded - Email',
    type: 'email',
    subject: '⚠️ WARNING: {{provider}} Provider Degraded',
    body: `Provider {{provider}} is DEGRADED.

Status: {{status}}
Success Rate: {{successRate}}%
Message: {{message}}

Time: {{timestamp}}
Investigation: Review logs and metrics.`,
    variables: ['provider', 'status', 'successRate', 'message', 'timestamp'],
  },
  {
    id: 'provider-recovered-email',
    name: 'Provider Recovered - Email',
    type: 'email',
    subject: '✅ RESOLVED: {{provider}} Provider Recovered',
    body: `Provider {{provider}} has recovered to HEALTHY state.

Status: {{status}}
Success Rate: {{successRate}}%
Time: {{timestamp}}

Recovery actions: {{recoveryActions}}`,
    variables: ['provider', 'status', 'successRate', 'timestamp', 'recoveryActions'],
  },
  {
    id: 'provider-down-slack',
    name: 'Provider Down - Slack',
    type: 'slack',
    body: `
{
  "text": "🚨 Provider Alert",
  "attachments": [{
    "color": "danger",
    "title": "{{provider}} - {{status}}",
    "text": "{{message}}",
    "fields": [
      {"title": "Response Time", "value": "{{responseTime}}ms", "short": true},
      {"title": "Success Rate", "value": "{{successRate}}%", "short": true}
    ],
    "ts": {{timestamp}}
  }]
}
`,
    variables: ['provider', 'status', 'message', 'responseTime', 'successRate', 'timestamp'],
  },
];

// Module-level state
const alertDeliveries = new Map<string, AlertDelivery[]>();
const mutedAlerts: MutedAlert[] = [];
const alertTemplates = new Map<string, AlertTemplate>();
const deadLetterQueue: AlertDelivery[] = [];
const escalationQueue: Map<string, NodeJS.Timeout> = new Map();

// Initialize templates
DEFAULT_TEMPLATES.forEach(t => {
  alertTemplates.set(t.id, {
    ...t,
    createdAt: new Date(),
  });
});

/**
 * Get escalation policy for alert level
 */
export function getEscalationPolicy(level: AlertLevel): EscalationPolicy {
  return DEFAULT_ESCALATION_POLICIES[level];
}

/**
 * Create alert delivery records
 */
export function createAlertDelivery(
  alertId: string,
  policy: EscalationPolicy,
  recipients: { email?: string[]; phone?: string[]; webhook?: string[] }
): AlertDelivery[] {
  const deliveries: AlertDelivery[] = [];
  const baseId = new mongoose.Types.ObjectId().toString();

  // Create email deliveries
  if (policy.notifyChannels.includes('email') && recipients.email) {
    recipients.email.forEach((recipient, idx) => {
      deliveries.push({
        id: `${baseId}-email-${idx}`,
        alertId,
        channel: 'email',
        recipient,
        status: 'pending',
        retryCount: 0,
      });
    });
  }

  // Create SMS deliveries for critical alerts
  if (policy.notifyChannels.includes('sms') && recipients.phone && policy.pageOnCall) {
    recipients.phone.forEach((recipient, idx) => {
      deliveries.push({
        id: `${baseId}-sms-${idx}`,
        alertId,
        channel: 'sms',
        recipient,
        status: 'pending',
        retryCount: 0,
      });
    });
  }

  // Create webhook deliveries
  if (policy.notifyChannels.includes('webhook') && recipients.webhook) {
    recipients.webhook.forEach((recipient, idx) => {
      deliveries.push({
        id: `${baseId}-webhook-${idx}`,
        alertId,
        channel: 'webhook',
        recipient,
        status: 'pending',
        retryCount: 0,
      });
    });
  }

  // Create in-app delivery
  if (policy.notifyChannels.includes('inapp')) {
    deliveries.push({
      id: `${baseId}-inapp`,
      alertId,
      channel: 'inapp',
      recipient: 'in-app',
      status: 'pending',
      retryCount: 0,
    });
  }

  // Store deliveries
  alertDeliveries.set(alertId, deliveries);

  log(`[ALERT-MANAGER] Created ${deliveries.length} alert deliveries for ${alertId}`);

  return deliveries;
}

/**
 * Mark delivery as sent
 */
export function markDeliverySent(deliveryId: string): boolean {
  for (const [, deliveries] of Array.from(alertDeliveries)) {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      delivery.status = 'sent';
      delivery.sentAt = new Date();
      log(`[ALERT-MANAGER] Delivery ${deliveryId} marked as sent`);
      return true;
    }
  }
  return false;
}

/**
 * Mark delivery as delivered
 */
export function markDeliveryDelivered(deliveryId: string): boolean {
  for (const [, deliveries] of Array.from(alertDeliveries)) {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      log(`[ALERT-MANAGER] Delivery ${deliveryId} marked as delivered`);
      return true;
    }
  }
  return false;
}

/**
 * Mark delivery as failed and queue for retry
 */
export function markDeliveryFailed(
  deliveryId: string,
  errorMessage: string,
  maxRetries: number = 3
): boolean {
  for (const [, deliveries] of Array.from(alertDeliveries)) {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery) {
      delivery.retryCount += 1;
      delivery.status = delivery.retryCount < maxRetries ? 'pending' : 'failed';
      delivery.errorMessage = errorMessage;

      if (delivery.retryCount < maxRetries) {
        // Exponential backoff: 5s, 30s, 2m
        const delayMs = [5000, 30000, 120000][delivery.retryCount - 1] || 120000;
        delivery.nextRetryAt = new Date(Date.now() + delayMs);
        log(`[ALERT-MANAGER] Delivery ${deliveryId} queued for retry ${delivery.retryCount}`);
      } else {
        // Move to dead letter queue
        deadLetterQueue.push(delivery);
        log(`[ALERT-MANAGER] Delivery ${deliveryId} moved to dead letter queue`);
      }

      return true;
    }
  }
  return false;
}

/**
 * Get all deliveries for an alert
 */
export function getAlertDeliveries(alertId: string): AlertDelivery[] {
  return alertDeliveries.get(alertId) || [];
}

/**
 * Get pending deliveries (ready to send)
 */
export function getPendingDeliveries(): AlertDelivery[] {
  const pending: AlertDelivery[] = [];
  for (const deliveries of Array.from(alertDeliveries.values())) {
    pending.push(
      ...deliveries.filter(
        d => d.status === 'pending' &&
             (!d.nextRetryAt || d.nextRetryAt <= new Date())
      )
    );
  }
  return pending;
}

/**
 * Get failed deliveries
 */
export function getFailedDeliveries(): AlertDelivery[] {
  const failed: AlertDelivery[] = [];
  for (const deliveries of Array.from(alertDeliveries.values())) {
    failed.push(...deliveries.filter(d => d.status === 'failed'));
  }
  return failed;
}

/**
 * Get dead letter queue
 */
export function getDeadLetterQueue(): AlertDelivery[] {
  return [...deadLetterQueue];
}

/**
 * Retry a dead letter delivery
 */
export function retryDeadLetterDelivery(deliveryId: string): boolean {
  const index = deadLetterQueue.findIndex(d => d.id === deliveryId);
  if (index >= 0) {
    const delivery = deadLetterQueue[index];
    delivery.retryCount = 0;
    delivery.status = 'pending';
    delivery.errorMessage = undefined;
    deadLetterQueue.splice(index, 1);
    log(`[ALERT-MANAGER] Retrying dead letter delivery ${deliveryId}`);
    return true;
  }
  return false;
}

/**
 * Get alert template by ID
 */
export function getAlertTemplate(templateId: string): AlertTemplate | null {
  const template = alertTemplates.get(templateId);
  return template || null;
}

/**
 * Get all alert templates
 */
export function getAllAlertTemplates(): AlertTemplate[] {
  return Array.from(alertTemplates.values());
}

/**
 * Create or update alert template
 */
export function upsertAlertTemplate(template: Omit<AlertTemplate, 'createdAt'>): AlertTemplate {
  const stored: AlertTemplate = {
    ...template,
    createdAt: alertTemplates.has(template.id) ? (alertTemplates.get(template.id)?.createdAt || new Date()) : new Date(),
  };
  alertTemplates.set(template.id, stored);
  log(`[ALERT-MANAGER] Template ${template.id} upserted`);
  return stored;
}

/**
 * Render alert template with variables
 */
export function renderTemplate(
  templateId: string,
  variables: Record<string, string | number>
): string | null {
  const template = alertTemplates.get(templateId);
  if (!template) return null;

  let rendered = template.body;
  Object.entries(variables).forEach(([key, value]) => {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });

  return rendered;
}

/**
 * Mute alerts matching a pattern
 */
export function muteAlerts(
  pattern: {
    provider?: ProviderType;
    level?: AlertLevel;
    status?: HealthStatus;
  },
  reason: string,
  durationMinutes?: number
): MutedAlert {
  const muted: MutedAlert = {
    pattern,
    reason,
    mutedAt: new Date(),
    isMuted: true,
  };

  if (durationMinutes) {
    muted.unmutedAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  }

  mutedAlerts.push(muted);
  log(`[ALERT-MANAGER] Alerts muted: ${JSON.stringify(pattern)}`);

  return muted;
}

/**
 * Unmute alerts
 */
export function unmuteAlerts(
  pattern: {
    provider?: ProviderType;
    level?: AlertLevel;
    status?: HealthStatus;
  }
): boolean {
  const index = mutedAlerts.findIndex(m => JSON.stringify(m.pattern) === JSON.stringify(pattern));
  if (index >= 0) {
    mutedAlerts[index].isMuted = false;
    mutedAlerts[index].unmutedAt = new Date();
    log(`[ALERT-MANAGER] Alerts unmuted: ${JSON.stringify(pattern)}`);
    return true;
  }
  return false;
}

/**
 * Check if alert is muted
 */
export function isAlertMuted(
  provider: ProviderType,
  level: AlertLevel,
  status: HealthStatus
): boolean {
  const now = new Date();
  return mutedAlerts.some(m =>
    m.isMuted &&
    (!m.unmutedAt || m.unmutedAt > now) &&
    (!m.pattern.provider || m.pattern.provider === provider) &&
    (!m.pattern.level || m.pattern.level === level) &&
    (!m.pattern.status || m.pattern.status === status)
  );
}

/**
 * Get all muted alerts
 */
export function getMutedAlerts(): MutedAlert[] {
  return mutedAlerts.filter(m => m.isMuted);
}

/**
 * Setup escalation for an alert
 */
export function setupEscalation(
  alertId: string,
  policy: EscalationPolicy,
  callback: () => void
): void {
  if (!policy.escalateAfterMinutes) return;

  const timeout = setTimeout(() => {
    log(`[ALERT-MANAGER] Escalating alert ${alertId} to ${policy.escalateTo}`);
    callback();
    escalationQueue.delete(alertId);
  }, policy.escalateAfterMinutes * 60 * 1000);

  escalationQueue.set(alertId, timeout);
}

/**
 * Cancel escalation for an alert
 */
export function cancelEscalation(alertId: string): boolean {
  const timeout = escalationQueue.get(alertId);
  if (timeout) {
    clearTimeout(timeout);
    escalationQueue.delete(alertId);
    log(`[ALERT-MANAGER] Escalation cancelled for alert ${alertId}`);
    return true;
  }
  return false;
}

/**
 * Get delivery statistics
 */
export function getDeliveryStatistics(): {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  deadLettered: number;
} {
  let total = 0;
  let pending = 0;
  let sent = 0;
  let delivered = 0;
  let failed = 0;

  for (const deliveries of Array.from(alertDeliveries.values())) {
    deliveries.forEach(d => {
      total += 1;
      if (d.status === 'pending') pending += 1;
      else if (d.status === 'sent') sent += 1;
      else if (d.status === 'delivered') delivered += 1;
      else if (d.status === 'failed') failed += 1;
    });
  }

  return {
    total,
    pending,
    sent,
    delivered,
    failed,
    deadLettered: deadLetterQueue.length,
  };
}

/**
 * Export alert manager functions
 */
export const AlertManager = {
  getEscalationPolicy,
  createDelivery: createAlertDelivery,
  markSent: markDeliverySent,
  markDelivered: markDeliveryDelivered,
  markFailed: markDeliveryFailed,
  getDeliveries: getAlertDeliveries,
  getPending: getPendingDeliveries,
  getFailed: getFailedDeliveries,
  getDeadLetterQueue,
  retryDeadLetter: retryDeadLetterDelivery,
  getTemplate: getAlertTemplate,
  getAllTemplates: getAllAlertTemplates,
  upsertTemplate: upsertAlertTemplate,
  renderTemplate,
  mute: muteAlerts,
  unmute: unmuteAlerts,
  isMuted: isAlertMuted,
  getMuted: getMutedAlerts,
  setupEscalation,
  cancelEscalation,
  getStats: getDeliveryStatistics,
};

export default AlertManager;
