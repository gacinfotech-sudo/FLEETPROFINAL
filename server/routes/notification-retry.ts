// Notification Retry & Recovery API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationRetryManager, RetryStrategy } from '../utils/notificationRetry';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationRetryAPI');
const router = express.Router();

// POST /api/notification-retry/policies
// Create retry policy (admin only)
router.post('/policies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name,
      strategy,
      maxRetries,
      initialDelaySeconds,
      maxDelaySeconds,
      backoffMultiplier,
      jitterFactor
    } = req.body;

    if (!name || !strategy) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name and strategy are required'
      });
    }

    if (!Object.values(RetryStrategy).includes(strategy)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `strategy must be one of: ${Object.values(RetryStrategy).join(', ')}`
      });
    }

    const policyId = await notificationRetryManager.createRetryPolicy({
      name,
      strategy,
      maxRetries: maxRetries || 5,
      initialDelaySeconds: initialDelaySeconds || 60,
      maxDelaySeconds: maxDelaySeconds || 3600,
      backoffMultiplier: backoffMultiplier || 2,
      jitterFactor: jitterFactor || 0.1,
      status: 'active'
    });

    log.info('Retry policy created via API', { policyId, name });

    res.json({
      success: true,
      message: 'Retry policy created successfully',
      policyId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to create retry policy', { error });
    res.status(500).json({
      error: 'Failed to create retry policy',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-retry/policies
// List retry policies (admin only)
router.get('/policies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const policies = await notificationRetryManager.listRetryPolicies(status as any);

    log.info('Retry policies listed', { count: policies.length });

    res.json({
      success: true,
      policies,
      count: policies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to list retry policies', { error });
    res.status(500).json({
      error: 'Failed to list retry policies',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-retry/pending
// Get pending retries (admin only)
router.get('/pending', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;

    const retryLimit = Math.min(parseInt(limit as string) || 100, 1000);
    const notifications = await notificationRetryManager.getRetryableNotifications(
      'pending',
      retryLimit
    );

    log.info('Pending retries retrieved', { count: notifications.length });

    res.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get pending retries', { error });
    res.status(500).json({
      error: 'Failed to retrieve pending retries',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-retry/:retryableId/retry
// Manually retry a notification (admin only)
router.post(
  '/:retryableId/retry',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { retryableId } = req.params;

      const success = await notificationRetryManager.manualRetry(retryableId);

      log.info('Manual retry executed', { retryableId, success });

      res.json({
        success: true,
        message: success ? 'Notification sent successfully' : 'Notification retry scheduled',
        delivered: success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to manually retry', { error });
      res.status(500).json({
        error: 'Failed to retry notification',
        message: (error as Error).message
      });
    }
  }
);

// POST /api/notification-retry/:retryableId/dead-letter
// Move notification to dead letter queue (admin only)
router.post(
  '/:retryableId/dead-letter',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { retryableId } = req.params;

      await notificationRetryManager.moveToDeadLetter(retryableId);

      log.info('Notification moved to dead letter', { retryableId });

      res.json({
        success: true,
        message: 'Notification moved to dead letter queue',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to move to dead letter', { error });
      res.status(500).json({
        error: 'Failed to move to dead letter',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-retry/dead-letter
// Get dead letter queue (admin only)
router.get('/dead-letter', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;

    const dlqLimit = Math.min(parseInt(limit as string) || 100, 1000);
    const notifications = await notificationRetryManager.getDeadLetterQueue(dlqLimit);

    log.info('Dead letter queue retrieved', { count: notifications.length });

    res.json({
      success: true,
      deadLetterQueue: notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get dead letter queue', { error });
    res.status(500).json({
      error: 'Failed to retrieve dead letter queue',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-retry/stats
// Get retry statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationRetryManager.getRetryStats();

    log.info('Retry stats retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get retry stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

export default router;
