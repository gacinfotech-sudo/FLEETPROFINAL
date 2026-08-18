// Notification Webhooks API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationWebhookManager, WebhookEvent } from '../utils/notificationWebhooks';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationWebhooksAPI');
const router = express.Router();

// POST /api/notification-webhooks/subscriptions
// Create webhook subscription (admin only)
router.post('/subscriptions', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { url, events, headers, maxRetries, backoffSeconds } = req.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'url and events array are required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'url must be a valid HTTPS URL'
      });
    }

    const subscriptionId = await notificationWebhookManager.createSubscription(url, events, {
      headers,
      maxRetries,
      backoffSeconds
    });

    log.info('Webhook subscription created via API', { subscriptionId, url });

    res.json({
      success: true,
      message: 'Webhook subscription created successfully',
      subscriptionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to create webhook subscription', { error });
    res.status(500).json({
      error: 'Failed to create webhook subscription',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-webhooks/subscriptions
// List webhook subscriptions (admin only)
router.get('/subscriptions', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const activeFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    const subscriptions = await notificationWebhookManager.getSubscriptions(activeFilter);

    log.info('Webhook subscriptions listed', { count: subscriptions.length });

    res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub._id?.toString(),
        url: sub.url,
        events: sub.events,
        active: sub.active,
        failureCount: sub.failureCount,
        lastTriggeredAt: sub.lastTriggeredAt,
        createdAt: sub.createdAt
      })),
      count: subscriptions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to list webhook subscriptions', { error });
    res.status(500).json({
      error: 'Failed to list webhook subscriptions',
      message: (error as Error).message
    });
  }
});

// DELETE /api/notification-webhooks/subscriptions/:subscriptionId
// Delete webhook subscription (admin only)
router.delete(
  '/subscriptions/:subscriptionId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.params;

      const success = await notificationWebhookManager.deleteSubscription(subscriptionId);

      if (!success) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Webhook subscription not found'
        });
      }

      log.info('Webhook subscription deleted via API', { subscriptionId });

      res.json({
        success: true,
        message: 'Webhook subscription deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to delete webhook subscription', { error });
      res.status(500).json({
        error: 'Failed to delete webhook subscription',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-webhooks/stats
// Get webhook statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationWebhookManager.getWebhookStats();

    log.info('Webhook stats retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get webhook stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve webhook statistics',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-webhooks/events
// List available webhook events
router.get('/events', async (req: Request, res: Response) => {
  try {
    const events = Object.values(WebhookEvent);

    res.json({
      success: true,
      events,
      count: events.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get webhook events', { error });
    res.status(500).json({
      error: 'Failed to retrieve webhook events',
      message: (error as Error).message
    });
  }
});

export default router;
