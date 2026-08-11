// Notification System Health & Monitoring
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationHealthMonitor');

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthMetrics {
  status: HealthStatus;
  timestamp: Date;
  components: {
    database: ComponentHealth;
    scheduler: ComponentHealth;
    retryManager: ComponentHealth;
    templateEngine: ComponentHealth;
    preferencesEngine: ComponentHealth;
    deliveryOrchestrator: ComponentHealth;
  };
  performance: {
    averageDeliveryTime: number; // milliseconds
    successRate: number; // percentage
    p99DeliveryTime: number; // milliseconds
  };
  capacity: {
    pendingRetries: number;
    deadLetterQueueSize: number;
    scheduledNotifications: number;
    activeSubscriptions: number;
  };
  issues: HealthIssue[];
}

export interface ComponentHealth {
  status: HealthStatus;
  lastCheck: Date;
  message: string;
  responseTime: number; // milliseconds
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  message: string;
  detectedAt: Date;
  recommendation: string;
}

export interface DiagnosticReport {
  timestamp: Date;
  health: HealthMetrics;
  diagnostics: {
    databaseConnectivity: boolean;
    schedulerRunning: boolean;
    retryManagerRunning: boolean;
    indexesHealthy: boolean;
    collectionGrowth: Record<string, number>;
  };
  recommendations: string[];
}

class NotificationHealthMonitor {
  private db = mongoose.connection.db!;
  private lastMetrics: HealthMetrics | null = null;
  private healthCheckInterval = 60000; // Check every 60 seconds

  async getHealthStatus(): Promise<HealthMetrics> {
    const timestamp = new Date();
    const issues: HealthIssue[] = [];

    try {
      // Check database
      const dbHealth = await this.checkDatabaseHealth();
      if (dbHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: dbHealth.status === HealthStatus.UNHEALTHY ? 'critical' : 'warning',
          component: 'database',
          message: dbHealth.message,
          detectedAt: timestamp,
          recommendation: 'Check MongoDB connection and replica set status'
        });
      }

      // Check scheduler
      const schedulerHealth = await this.checkSchedulerHealth();
      if (schedulerHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: 'warning',
          component: 'scheduler',
          message: schedulerHealth.message,
          detectedAt: timestamp,
          recommendation: 'Restart notification scheduler service'
        });
      }

      // Check retry manager
      const retryHealth = await this.checkRetryManagerHealth();
      if (retryHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: 'warning',
          component: 'retryManager',
          message: retryHealth.message,
          detectedAt: timestamp,
          recommendation: 'Check dead letter queue size and process retries'
        });
      }

      // Check templates
      const templateHealth = await this.checkTemplateEngineHealth();
      if (templateHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: 'info',
          component: 'templates',
          message: templateHealth.message,
          detectedAt: timestamp,
          recommendation: 'Verify template collection accessibility'
        });
      }

      // Check preferences
      const prefsHealth = await this.checkPreferencesEngineHealth();
      if (prefsHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: 'warning',
          component: 'preferences',
          message: prefsHealth.message,
          detectedAt: timestamp,
          recommendation: 'Check preferences collection indexes'
        });
      }

      // Check delivery
      const deliveryHealth = await this.checkDeliveryOrchestratorHealth();
      if (deliveryHealth.status !== HealthStatus.HEALTHY) {
        issues.push({
          severity: 'info',
          component: 'delivery',
          message: deliveryHealth.message,
          detectedAt: timestamp,
          recommendation: 'Monitor VAPID key configuration'
        });
      }

      // Get performance metrics
      const performance = await this.getPerformanceMetrics();

      // Get capacity metrics
      const capacity = await this.getCapacityMetrics();

      // Determine overall status
      const criticalIssues = issues.filter(i => i.severity === 'critical').length;
      const warningIssues = issues.filter(i => i.severity === 'warning').length;

      let overallStatus = HealthStatus.HEALTHY;
      if (criticalIssues > 0) {
        overallStatus = HealthStatus.UNHEALTHY;
      } else if (warningIssues > 0 || performance.successRate < 90) {
        overallStatus = HealthStatus.DEGRADED;
      }

      const metrics: HealthMetrics = {
        status: overallStatus,
        timestamp,
        components: {
          database: dbHealth,
          scheduler: schedulerHealth,
          retryManager: retryHealth,
          templateEngine: templateHealth,
          preferencesEngine: prefsHealth,
          deliveryOrchestrator: deliveryHealth
        },
        performance,
        capacity,
        issues
      };

      this.lastMetrics = metrics;
      return metrics;
    } catch (error) {
      log.error('Health check failed', { error });
      throw error;
    }
  }

  async getDiagnosticReport(): Promise<DiagnosticReport> {
    const timestamp = new Date();
    const health = await this.getHealthStatus();

    const diagnostics = {
      databaseConnectivity: mongoose.connection.readyState === 1,
      schedulerRunning: await this.isSchedulerRunning(),
      retryManagerRunning: await this.isRetryManagerRunning(),
      indexesHealthy: await this.areIndexesHealthy(),
      collectionGrowth: await this.getCollectionGrowth()
    };

    const recommendations = this.generateRecommendations(health, diagnostics);

    return {
      timestamp,
      health,
      diagnostics,
      recommendations
    };
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const adminDb = mongoose.connection.db!;
      await adminDb.admin().ping();
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        message: 'Database connectivity OK',
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        lastCheck: new Date(),
        message: `Database unreachable: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkSchedulerHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Check if scheduled_notifications collection exists and has records
      const collection = this.db.collection('scheduled_notifications');
      const count = await collection.countDocuments();
      const responseTime = Date.now() - startTime;

      if (count === 0) {
        return {
          status: HealthStatus.HEALTHY,
          lastCheck: new Date(),
          message: 'Scheduler idle (no scheduled notifications)',
          responseTime
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        message: `Scheduler active (${count} pending notifications)`,
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `Scheduler health check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkRetryManagerHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const collection = this.db.collection('retryable_notifications');
      const pendingCount = await collection.countDocuments({ status: 'pending' });
      const dlqCount = await collection.countDocuments({ status: 'dead_letter' });
      const responseTime = Date.now() - startTime;

      let status = HealthStatus.HEALTHY;
      let message = `Retry manager OK (${pendingCount} pending, ${dlqCount} DLQ)`;

      if (dlqCount > 100) {
        status = HealthStatus.DEGRADED;
        message = `High DLQ size: ${dlqCount} failed notifications`;
      }

      return {
        status,
        lastCheck: new Date(),
        message,
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `Retry manager health check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkTemplateEngineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const collection = this.db.collection('notification_templates');
      const count = await collection.countDocuments({ status: 'active' });
      const responseTime = Date.now() - startTime;

      return {
        status: count > 0 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `${count} active templates available`,
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `Template engine health check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkPreferencesEngineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const collection = this.db.collection('notification_preferences');
      const count = await collection.countDocuments();
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        message: `${count} user preference records`,
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `Preferences engine health check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async checkDeliveryOrchestratorHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      // Check if push subscriptions exist
      const usersCollection = this.db.collection('users');
      const subCount = await usersCollection.countDocuments({
        pushSubscription: { $exists: true }
      });
      const responseTime = Date.now() - startTime;

      return {
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        message: `${subCount} active push subscriptions`,
        responseTime
      };
    } catch (error) {
      return {
        status: HealthStatus.DEGRADED,
        lastCheck: new Date(),
        message: `Delivery orchestrator health check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async getPerformanceMetrics(): Promise<{
    averageDeliveryTime: number;
    successRate: number;
    p99DeliveryTime: number;
  }> {
    try {
      const collection = this.db.collection('notification_logs');
      const logs = await collection
        .find({
          status: { $in: ['sent', 'delivered'] },
          sentAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
        })
        .toArray();

      if (logs.length === 0) {
        return {
          averageDeliveryTime: 0,
          successRate: 100,
          p99DeliveryTime: 0
        };
      }

      const delivered = logs.filter(l => l.status === 'delivered').length;
      const deliveryTimes = logs
        .filter(l => l.deliveredAt && l.sentAt)
        .map(l => l.deliveredAt.getTime() - l.sentAt.getTime())
        .sort((a, b) => a - b);

      const averageDeliveryTime = Math.round(
        deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      );

      const p99Index = Math.floor(deliveryTimes.length * 0.99);
      const p99DeliveryTime = deliveryTimes[p99Index] || 0;
      const successRate = (delivered / logs.length) * 100;

      return {
        averageDeliveryTime,
        successRate: Math.round(successRate),
        p99DeliveryTime
      };
    } catch (error) {
      log.error('Failed to get performance metrics', { error });
      return {
        averageDeliveryTime: 0,
        successRate: 0,
        p99DeliveryTime: 0
      };
    }
  }

  private async getCapacityMetrics(): Promise<{
    pendingRetries: number;
    deadLetterQueueSize: number;
    scheduledNotifications: number;
    activeSubscriptions: number;
  }> {
    try {
      const retryCollection = this.db.collection('retryable_notifications');
      const scheduledCollection = this.db.collection('scheduled_notifications');
      const usersCollection = this.db.collection('users');

      const [pendingRetries, dlqSize, scheduledNotifications, activeSubscriptions] = await Promise.all([
        retryCollection.countDocuments({ status: 'pending' }),
        retryCollection.countDocuments({ status: 'dead_letter' }),
        scheduledCollection.countDocuments({ status: 'pending' }),
        usersCollection.countDocuments({ pushSubscription: { $exists: true } })
      ]);

      return {
        pendingRetries,
        deadLetterQueueSize: dlqSize,
        scheduledNotifications,
        activeSubscriptions
      };
    } catch (error) {
      log.error('Failed to get capacity metrics', { error });
      return {
        pendingRetries: 0,
        deadLetterQueueSize: 0,
        scheduledNotifications: 0,
        activeSubscriptions: 0
      };
    }
  }

  private async isSchedulerRunning(): Promise<boolean> {
    try {
      const collection = this.db.collection('scheduled_notifications');
      const recentSends = await collection.countDocuments({
        status: 'sent',
        sentAt: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
      });
      return recentSends > 0;
    } catch {
      return false;
    }
  }

  private async isRetryManagerRunning(): Promise<boolean> {
    try {
      const collection = this.db.collection('retryable_notifications');
      const recentRetries = await collection.countDocuments({
        status: 'succeeded',
        updatedAt: { $gte: new Date(Date.now() - 300000) } // Last 5 minutes
      });
      return recentRetries > 0;
    } catch {
      return false;
    }
  }

  private async areIndexesHealthy(): Promise<boolean> {
    try {
      const collections = [
        'notification_logs',
        'scheduled_notifications',
        'retryable_notifications',
        'notification_templates',
        'notification_preferences'
      ];

      for (const collName of collections) {
        const coll = this.db.collection(collName);
        const indexes = await coll.indexes();
        if (indexes.length === 0) {
          return false; // At least _id should exist
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private async getCollectionGrowth(): Promise<Record<string, number>> {
    try {
      const collections = [
        'notification_logs',
        'scheduled_notifications',
        'retryable_notifications',
        'notification_templates',
        'notification_preferences',
        'notification_audit_logs',
        'notification_consent_records'
      ];

      const growth: Record<string, number> = {};

      for (const collName of collections) {
        const coll = this.db.collection(collName);
        growth[collName] = await coll.countDocuments();
      }

      return growth;
    } catch (error) {
      log.error('Failed to get collection growth', { error });
      return {};
    }
  }

  private generateRecommendations(health: HealthMetrics, diagnostics: any): string[] {
    const recommendations: string[] = [];

    // Database recommendations
    if (health.components.database.status !== HealthStatus.HEALTHY) {
      recommendations.push('Verify MongoDB connection string and replica set configuration');
    }

    // Performance recommendations
    if (health.performance.successRate < 90) {
      recommendations.push('Investigate delivery failures - check VAPID key and user subscriptions');
    }

    // Capacity recommendations
    if (health.capacity.deadLetterQueueSize > 100) {
      recommendations.push(`DLQ has ${health.capacity.deadLetterQueueSize} failed notifications - review and retry manually`);
    }

    if (health.capacity.pendingRetries > 1000) {
      recommendations.push('High number of pending retries - check if retry manager is running');
    }

    // Diagnostic recommendations
    if (!diagnostics.schedulerRunning && health.capacity.scheduledNotifications > 0) {
      recommendations.push('Scheduler not running but has pending scheduled notifications');
    }

    if (!diagnostics.retryManagerRunning && health.capacity.pendingRetries > 0) {
      recommendations.push('Retry manager not running but has pending retries');
    }

    if (!diagnostics.indexesHealthy) {
      recommendations.push('Some collection indexes are missing - run migrations');
    }

    return recommendations;
  }
}

export const notificationHealthMonitor = new NotificationHealthMonitor();
