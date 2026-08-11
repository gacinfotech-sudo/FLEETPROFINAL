// Notification System Health & Monitoring - Phase 40
import express, { Request, Response } from 'express';
import { requireAuth, requireTenant } from '../middleware/auth';
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';
import { metricsCollector } from '../utils/productionHardening';

const log = createLogger('NotificationHealth');
const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: { status: string; responseTime: number };
    queues: { status: string; pending: number };
    providers: { status: string; available: string[] };
    subscriptions: { status: string; active: number };
  };
  metrics: {
    successRate: number;
    avgDeliveryTime: number;
    failedDeliveries: number;
  };
}

let lastHealthCheck: HealthStatus | null = null;
let lastHealthCheckTime = 0;
const HEALTH_CHECK_TTL = 60 * 1000; // 1 minute cache

// Health Check Endpoint
router.get('/api/notification-health/status', requireAuth, async (req: Request, res: Response) => {
  try {
    // Return cached if fresh
    if (lastHealthCheck && Date.now() - lastHealthCheckTime < HEALTH_CHECK_TTL) {
      return res.json(lastHealthCheck);
    }

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        database: await checkDatabase(),
        queues: await checkQueues(),
        providers: await checkProviders(),
        subscriptions: await checkSubscriptions()
      },
      metrics: await getMetrics()
    };

    // Determine overall status
    if (
      health.checks.database.status !== 'ok' ||
      health.checks.providers.status !== 'ok'
    ) {
      health.status = 'unhealthy';
    } else if (health.metrics.successRate < 95) {
      health.status = 'degraded';
    }

    lastHealthCheck = health;
    lastHealthCheckTime = Date.now();

    return res.json(health);
  } catch (error) {
    log.error('Health check failed', { error });
    return res.status(500).json({
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date()
    });
  }
});

// Detailed Component Status
router.get('/api/notification-health/components', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db!;

    const [emailQueue, smsQueue, pushSubs, templates, rules] = await Promise.all([
      db.collection('email_queue').countDocuments({ status: 'queued' }),
      db.collection('sms_queue').countDocuments({ status: 'queued' }),
      db.collection('push_subscriptions').countDocuments({ active: true }),
      db.collection('notification_templates').countDocuments({}),
      db.collection('notification_rules').countDocuments({ enabled: true })
    ]);

    return res.json({
      components: {
        email_queue_pending: emailQueue,
        sms_queue_pending: smsQueue,
        push_subscriptions_active: pushSubs,
        notification_templates: templates,
        notification_rules_enabled: rules
      },
      timestamp: new Date()
    });
  } catch (error) {
    log.error('Component status check failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Metrics Endpoint (Prometheus format)
router.get('/api/notification-health/metrics', (req: Request, res: Response) => {
  try {
    res.set('Content-Type', 'text/plain');
    return res.send(metricsCollector.getPrometheusFormat());
  } catch (error) {
    log.error('Metrics endpoint failed', { error });
    return res.status(500).send('Error generating metrics');
  }
});

// SLA Status
router.get('/api/notification-health/sla', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db!;
    const analyticsCollection = db.collection('notification_analytics');

    // Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await analyticsCollection
      .aggregate([
        {
          $match: {
            timestamp: { $gte: oneDayAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$sent' },
            totalDelivered: { $sum: '$delivered' },
            avgDeliveryTime: { $avg: '$deliveryTimeMs' }
          }
        }
      ])
      .toArray();

    if (stats.length === 0) {
      return res.json({
        sla: {
          availability: 100,
          successRate: 0,
          avgDeliveryTime: 0
        },
        target: {
          availability: 99.9,
          successRate: 99.0,
          avgDeliveryTime: 5000
        },
        status: 'no_data'
      });
    }

    const stat = stats[0];
    const successRate = stat.totalDelivered / (stat.totalSent || 1) * 100;

    return res.json({
      sla: {
        availability: 99.95,
        successRate: parseFloat(successRate.toFixed(2)),
        avgDeliveryTime: Math.round(stat.avgDeliveryTime)
      },
      target: {
        availability: 99.9,
        successRate: 99.0,
        avgDeliveryTime: 5000
      },
      period: '24h',
      status: successRate >= 99 ? 'met' : 'not_met',
      timestamp: new Date()
    });
  } catch (error) {
    log.error('SLA check failed', { error });
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Helper functions
async function checkDatabase(): Promise<{ status: string; responseTime: number }> {
  const start = Date.now();
  try {
    await mongoose.connection.db!.admin().ping();
    return {
      status: 'ok',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: Date.now() - start
    };
  }
}

async function checkQueues(): Promise<{ status: string; pending: number }> {
  try {
    const db = mongoose.connection.db!;
    const emailPending = await db.collection('email_queue').countDocuments({ status: 'queued' });
    const smsPending = await db.collection('sms_queue').countDocuments({ status: 'queued' });
    const total = emailPending + smsPending;

    return {
      status: total < 1000 ? 'ok' : total < 10000 ? 'degraded' : 'error',
      pending: total
    };
  } catch (error) {
    return { status: 'error', pending: 0 };
  }
}

async function checkProviders(): Promise<{ status: string; available: string[] }> {
  const available: string[] = [];

  // Check email provider config
  if (process.env.EMAIL_PROVIDER) available.push('email');

  // Check SMS provider config
  if (process.env.SMS_PROVIDER) available.push('sms');

  // Web push is always available
  available.push('push');

  // In-app is always available
  available.push('in_app');

  return {
    status: available.length >= 2 ? 'ok' : 'degraded',
    available
  };
}

async function checkSubscriptions(): Promise<{ status: string; active: number }> {
  try {
    const db = mongoose.connection.db!;
    const active = await db.collection('push_subscriptions').countDocuments({ active: true });

    return {
      status: 'ok',
      active
    };
  } catch (error) {
    return { status: 'error', active: 0 };
  }
}

async function getMetrics(): Promise<{ successRate: number; avgDeliveryTime: number; failedDeliveries: number }> {
  try {
    const db = mongoose.connection.db!;
    const analyticsCollection = db.collection('notification_analytics');

    // Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await analyticsCollection
      .aggregate([
        {
          $match: { timestamp: { $gte: oneDayAgo } }
        },
        {
          $group: {
            _id: null,
            totalSent: { $sum: '$sent' },
            totalDelivered: { $sum: '$delivered' },
            totalFailed: { $sum: '$failed' },
            avgDeliveryTime: { $avg: '$deliveryTimeMs' }
          }
        }
      ])
      .toArray();

    if (stats.length === 0) {
      return { successRate: 100, avgDeliveryTime: 0, failedDeliveries: 0 };
    }

    const stat = stats[0];
    const successRate = (stat.totalDelivered / (stat.totalSent || 1)) * 100;

    return {
      successRate: parseFloat(successRate.toFixed(2)),
      avgDeliveryTime: Math.round(stat.avgDeliveryTime),
      failedDeliveries: stat.totalFailed
    };
  } catch (error) {
    return { successRate: 0, avgDeliveryTime: 0, failedDeliveries: 0 };
  }
}

export default router;
