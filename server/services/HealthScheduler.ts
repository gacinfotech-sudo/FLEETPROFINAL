/**
 * Health Scheduler Service
 * Automated provider health monitoring with 5-minute intervals
 * Tracks per-provider status, manages alert thresholds, and triggers recovery
 * Features: continuous health checks, alert deduplication, auto-recovery, metrics tracking
 */

import mongoose from 'mongoose';
import { log } from '../vite';

export type ProviderType = 'whatsapp' | 'calling' | 'gps' | 'kyc' | 'esign' | 'hub';
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type AlertLevel = 'info' | 'warning' | 'critical';

export interface ProviderHealthMetrics {
  provider: ProviderType;
  status: HealthStatus;
  lastCheck: Date;
  responseTime: number;
  successRate: number; // 0-100
  requestsLast24h: number;
  failedRequestsLast24h: number;
  consecutiveFailures: number;
  uptime: number; // 0-100
  availability: number; // 0-100
}

export interface AlertThreshold {
  provider: ProviderType;
  responseTimeMs: number; // ms
  errorRateThreshold: number; // percentage
  consecutiveFailuresThreshold: number;
  uptimeThreshold: number; // percentage
}

export interface HealthCheckResult {
  provider: ProviderType;
  healthy: boolean;
  timestamp: Date;
  responseTime: number;
  errorMessage?: string;
  metrics: {
    successRate: number;
    requestCount: number;
    failureCount: number;
    availability: number;
  };
}

export interface AlertEvent {
  id: string;
  tenantId: mongoose.Types.ObjectId;
  provider: ProviderType;
  level: AlertLevel;
  status: HealthStatus;
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  isResolved: boolean;
  autoRecoveryAttempted?: boolean;
  autoRecoverySucceeded?: boolean;
  deduplicationKey: string; // for deduplication
}

interface StoredAlert {
  tenantId: string;
  provider: ProviderType;
  level: AlertLevel;
  deduplicationKey: string;
  lastAlertTime: number; // timestamp
}

// Module-level state management
let healthCheckInterval: NodeJS.Timeout | undefined;
let isChecking = false;
const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minute deduplication window
const HEALTH_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTO_RECOVERY_DELAY_MS = 30 * 1000; // 30 seconds

// In-memory storage for health metrics and recent alerts
const healthMetrics = new Map<string, ProviderHealthMetrics>();
const recentAlerts = new Map<string, StoredAlert>();
const alertHistory: AlertEvent[] = [];
let autoRecoveryInProgress = new Set<string>();

// Default alert thresholds
const DEFAULT_THRESHOLDS: Record<ProviderType, AlertThreshold> = {
  whatsapp: {
    provider: 'whatsapp',
    responseTimeMs: 5000,
    errorRateThreshold: 10,
    consecutiveFailuresThreshold: 3,
    uptimeThreshold: 95,
  },
  calling: {
    provider: 'calling',
    responseTimeMs: 3000,
    errorRateThreshold: 15,
    consecutiveFailuresThreshold: 5,
    uptimeThreshold: 90,
  },
  gps: {
    provider: 'gps',
    responseTimeMs: 10000,
    errorRateThreshold: 5,
    consecutiveFailuresThreshold: 2,
    uptimeThreshold: 99,
  },
  kyc: {
    provider: 'kyc',
    responseTimeMs: 8000,
    errorRateThreshold: 8,
    consecutiveFailuresThreshold: 3,
    uptimeThreshold: 95,
  },
  esign: {
    provider: 'esign',
    responseTimeMs: 7000,
    errorRateThreshold: 12,
    consecutiveFailuresThreshold: 4,
    uptimeThreshold: 92,
  },
  hub: {
    provider: 'hub',
    responseTimeMs: 4000,
    errorRateThreshold: 6,
    consecutiveFailuresThreshold: 2,
    uptimeThreshold: 98,
  },
};

const providers: ProviderType[] = ['whatsapp', 'calling', 'gps', 'kyc', 'esign', 'hub'];

/**
 * Initialize health scheduler
 */
export function startHealthScheduler(intervalMs: number = DEFAULT_CHECK_INTERVAL_MS): void {
  if (healthCheckInterval) return; // already running

  log(`[HEALTH-SCHEDULER] Starting health check scheduler with ${intervalMs}ms interval`);

  healthCheckInterval = setInterval(() => {
    void runHealthCheckTick();
  }, intervalMs);

  // Run first check immediately
  void runHealthCheckTick();
}

/**
 * Stop health scheduler
 */
export function stopHealthScheduler(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = undefined;
    log('[HEALTH-SCHEDULER] Stopped health check scheduler');
  }
}

/**
 * Check if scheduler is running
 */
export function isHealthSchedulerRunning(): boolean {
  return Boolean(healthCheckInterval);
}

/**
 * Perform a single health check tick
 */
export async function runHealthCheckTick(): Promise<HealthCheckResult[]> {
  if (isChecking) {
    log('[HEALTH-SCHEDULER] Previous health check still running - skipping');
    return [];
  }

  isChecking = true;
  const results: HealthCheckResult[] = [];

  try {
    for (const provider of providers) {
      const result = await checkProviderHealth(provider);
      results.push(result);

      // Evaluate thresholds and create alerts if needed
      await evaluateHealthStatus(provider, result);
    }

    // Clean up old alert history
    cleanupAlertHistory();

    log(`[HEALTH-SCHEDULER] Completed health check for ${providers.length} providers`);
  } catch (error) {
    console.error('[HEALTH-SCHEDULER] Error running health check:', error);
  } finally {
    isChecking = false;
  }

  return results;
}

/**
 * Check individual provider health
 */
async function checkProviderHealth(provider: ProviderType): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const key = `${provider}:health`;

  try {
    // Simulate health check (in production, this would call actual provider APIs)
    const healthResponse = await performProviderHealthCheck(provider);
    const responseTime = Date.now() - startTime;

    // Update metrics
    const metrics: ProviderHealthMetrics = {
      provider,
      status: determineHealthStatus(healthResponse, responseTime, provider),
      lastCheck: new Date(),
      responseTime,
      successRate: healthResponse.successRate || 100,
      requestsLast24h: healthResponse.requestCount || 0,
      failedRequestsLast24h: healthResponse.failureCount || 0,
      consecutiveFailures: healthResponse.consecutiveFailures || 0,
      uptime: healthResponse.uptime || 100,
      availability: healthResponse.availability || 100,
    };

    healthMetrics.set(key, metrics);

    return {
      provider,
      healthy: metrics.status === 'healthy',
      timestamp: new Date(),
      responseTime,
      metrics: {
        successRate: metrics.successRate,
        requestCount: metrics.requestsLast24h,
        failureCount: metrics.failedRequestsLast24h,
        availability: metrics.availability,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const metrics: ProviderHealthMetrics = {
      provider,
      status: 'critical',
      lastCheck: new Date(),
      responseTime,
      successRate: 0,
      requestsLast24h: 0,
      failedRequestsLast24h: 1,
      consecutiveFailures: (healthMetrics.get(key)?.consecutiveFailures || 0) + 1,
      uptime: 0,
      availability: 0,
    };

    healthMetrics.set(key, metrics);

    return {
      provider,
      healthy: false,
      timestamp: new Date(),
      responseTime,
      errorMessage,
      metrics: {
        successRate: 0,
        requestCount: 0,
        failureCount: 1,
        availability: 0,
      },
    };
  }
}

/**
 * Simulate provider health check (placeholder for actual provider API calls)
 */
async function performProviderHealthCheck(provider: ProviderType): Promise<any> {
  // This would be replaced with actual provider API calls
  return {
    status: 'ok',
    successRate: 98,
    requestCount: 1500,
    failureCount: 30,
    consecutiveFailures: 0,
    uptime: 99.5,
    availability: 99.2,
  };
}

/**
 * Determine health status based on metrics
 */
function determineHealthStatus(
  metrics: any,
  responseTime: number,
  provider: ProviderType
): HealthStatus {
  const threshold = DEFAULT_THRESHOLDS[provider];

  // Critical: response time exceeded or too many consecutive failures
  if (responseTime > threshold.responseTimeMs ||
      metrics.consecutiveFailures >= threshold.consecutiveFailuresThreshold) {
    return 'critical';
  }

  // Degraded: error rate or uptime below threshold
  const errorRate = metrics.failureCount / (metrics.requestCount || 1) * 100;
  if (errorRate > threshold.errorRateThreshold ||
      metrics.uptime < threshold.uptimeThreshold) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Evaluate health status and create alerts
 */
async function evaluateHealthStatus(
  provider: ProviderType,
  result: HealthCheckResult
): Promise<void> {
  const threshold = DEFAULT_THRESHOLDS[provider];
  const metrics = healthMetrics.get(`${provider}:health`);

  if (!metrics) return;

  let alertLevel: AlertLevel | null = null;
  let message = '';

  if (metrics.status === 'critical') {
    alertLevel = 'critical';
    message = `Provider ${provider} is in CRITICAL state. Response time: ${metrics.responseTime}ms,
    Consecutive failures: ${metrics.consecutiveFailures}, Success rate: ${metrics.successRate}%`;
  } else if (metrics.status === 'degraded') {
    alertLevel = 'warning';
    message = `Provider ${provider} is DEGRADED. Success rate: ${metrics.successRate}%,
    Uptime: ${metrics.uptime}%, Response time: ${metrics.responseTime}ms`;
  } else if (metrics.status === 'healthy' && metrics.consecutiveFailures > 0) {
    alertLevel = 'info';
    message = `Provider ${provider} recovered to HEALTHY state`;
  }

  if (alertLevel) {
    await createAlert(provider, alertLevel, metrics.status, message);

    // Attempt auto-recovery for critical alerts
    if (alertLevel === 'critical' && !autoRecoveryInProgress.has(provider)) {
      setTimeout(() => attemptAutoRecovery(provider), AUTO_RECOVERY_DELAY_MS);
    }
  }
}

/**
 * Create alert with deduplication
 */
async function createAlert(
  provider: ProviderType,
  level: AlertLevel,
  status: HealthStatus,
  message: string
): Promise<AlertEvent | null> {
  const deduplicationKey = `${provider}:${level}:${status}`;
  const storageKey = `${provider}:${deduplicationKey}`;
  const now = Date.now();

  // Check if we already have a recent alert for this
  const lastAlert = recentAlerts.get(storageKey);
  if (lastAlert && (now - lastAlert.lastAlertTime) < ALERT_DEDUP_WINDOW_MS) {
    return null; // Deduplicate - skip this alert
  }

  // Create new alert
  const alert: AlertEvent = {
    id: new mongoose.Types.ObjectId().toString(),
    tenantId: new mongoose.Types.ObjectId(),
    provider,
    level,
    status,
    message,
    createdAt: new Date(),
    isResolved: false,
    deduplicationKey,
  };

  // Store in recent alerts for deduplication
  recentAlerts.set(storageKey, {
    tenantId: alert.tenantId.toString(),
    provider,
    level,
    deduplicationKey,
    lastAlertTime: now,
  });

  // Add to history
  alertHistory.push(alert);

  log(`[HEALTH-SCHEDULER] Alert created: ${level.toUpperCase()} - ${message}`);

  return alert;
}

/**
 * Attempt auto-recovery for a provider
 */
async function attemptAutoRecovery(provider: ProviderType): Promise<void> {
  if (autoRecoveryInProgress.has(provider)) return;

  autoRecoveryInProgress.add(provider);

  try {
    log(`[HEALTH-SCHEDULER] Attempting auto-recovery for ${provider}`);

    // Simulate recovery attempt
    const success = await performAutoRecovery(provider);

    // Update alert with recovery status
    const recentAlert = alertHistory.find(
      a => a.provider === provider && !a.isResolved && a.level === 'critical'
    );
    if (recentAlert) {
      recentAlert.autoRecoveryAttempted = true;
      recentAlert.autoRecoverySucceeded = success;
      if (success) {
        recentAlert.isResolved = true;
        recentAlert.resolvedAt = new Date();
      }
    }

    log(`[HEALTH-SCHEDULER] Auto-recovery for ${provider}: ${success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error(`[HEALTH-SCHEDULER] Auto-recovery error for ${provider}:`, error);
  } finally {
    autoRecoveryInProgress.delete(provider);
  }
}

/**
 * Perform actual recovery (placeholder)
 */
async function performAutoRecovery(provider: ProviderType): Promise<boolean> {
  // This would contain actual recovery logic per provider
  return true;
}

/**
 * Clean up old alert history
 */
function cleanupAlertHistory(): void {
  const now = Date.now();
  const cutoffTime = now - HEALTH_HISTORY_RETENTION_MS;

  // Remove old alerts
  const originalLength = alertHistory.length;
  for (let i = alertHistory.length - 1; i >= 0; i--) {
    if (alertHistory[i].createdAt.getTime() < cutoffTime) {
      alertHistory.splice(i, 1);
    }
  }

  if (alertHistory.length < originalLength) {
    log(`[HEALTH-SCHEDULER] Cleaned up ${originalLength - alertHistory.length} old alerts`);
  }
}

/**
 * Get current health metrics for all providers
 */
export function getHealthMetrics(): ProviderHealthMetrics[] {
  return Array.from(healthMetrics.values()).filter(m => providers.includes(m.provider));
}

/**
 * Get health metrics for a specific provider
 */
export function getProviderMetrics(provider: ProviderType): ProviderHealthMetrics | null {
  const key = `${provider}:health`;
  return healthMetrics.get(key) || null;
}

/**
 * Get alert history
 */
export function getAlertHistory(
  provider?: ProviderType,
  limit: number = 100
): AlertEvent[] {
  let history = alertHistory;

  if (provider) {
    history = history.filter(a => a.provider === provider);
  }

  return history.slice(-limit);
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): AlertEvent[] {
  return alertHistory.filter(a => !a.isResolved);
}

/**
 * Resolve an alert manually
 */
export function resolveAlert(alertId: string): AlertEvent | null {
  const alert = alertHistory.find(a => a.id === alertId);
  if (alert && !alert.isResolved) {
    alert.isResolved = true;
    alert.resolvedAt = new Date();
    log(`[HEALTH-SCHEDULER] Alert ${alertId} resolved manually`);
  }
  return alert || null;
}

/**
 * Get alert statistics
 */
export function getAlertStatistics(): {
  totalAlerts: number;
  activeAlerts: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  alertsByProvider: Record<ProviderType, number>;
} {
  const active = getActiveAlerts();
  const stats = {
    totalAlerts: alertHistory.length,
    activeAlerts: active.length,
    criticalCount: active.filter(a => a.level === 'critical').length,
    warningCount: active.filter(a => a.level === 'warning').length,
    infoCount: active.filter(a => a.level === 'info').length,
    alertsByProvider: {} as Record<ProviderType, number>,
  };

  providers.forEach(p => {
    stats.alertsByProvider[p] = active.filter(a => a.provider === p).length;
  });

  return stats;
}

/**
 * Export scheduler functions for external use
 */
export const HealthScheduler = {
  start: startHealthScheduler,
  stop: stopHealthScheduler,
  isRunning: isHealthSchedulerRunning,
  runTick: runHealthCheckTick,
  getMetrics: getHealthMetrics,
  getProviderMetrics,
  getAlertHistory,
  getActiveAlerts,
  resolveAlert,
  getStatistics: getAlertStatistics,
};

export default HealthScheduler;
