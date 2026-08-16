import express from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import WebhookService from '../services/WebhookService';

const router = express.Router();

/**
 * WAVE 21: Webhook System Endpoints
 */

// POST /api/webhooks/subscribe - Create webhook subscription
router.post('/subscribe', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { name, url, events, headers, maxRetries, backoffMs, exponentialBackoff } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL is required',
      });
    }

    if (!events || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one event subscription is required',
      });
    }

    const webhook = await WebhookService.createWebhook(req.tenantId, {
      name,
      url,
      events,
      headers,
      maxRetries,
      backoffMs,
      exponentialBackoff,
    });

    res.json({
      success: true,
      data: {
        webhookId: webhook._id,
        name: webhook.name,
        url: webhook.url,
        secret: webhook.secret,
      },
    });
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/webhooks/list - List webhooks
router.get('/list', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const webhooks = await WebhookService.listWebhooks(req.tenantId);

    res.json({
      success: true,
      data: webhooks,
      count: webhooks.length,
    });
  } catch (error: any) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/webhooks/:id - Delete webhook
router.delete('/:id', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    await WebhookService.deleteWebhook(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /api/webhooks/:id - Update webhook
router.put('/:id', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const webhook = await WebhookService.updateWebhook(req.tenantId, req.params.id, req.body);

    res.json({
      success: true,
      message: 'Webhook updated',
      data: { webhookId: webhook._id, name: webhook.name },
    });
  } catch (error: any) {
    console.error('Error updating webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/webhooks/:id/test - Test webhook delivery
router.post('/:id/test', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const result = await WebhookService.testWebhook(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/webhooks/:id/history - Get webhook delivery history
router.get('/:id/history', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { limit } = req.query;
    const deliveries = await WebhookService.listWebhookDeliveries(
      req.tenantId,
      req.params.id,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: deliveries,
      count: deliveries.length,
    });
  } catch (error: any) {
    console.error('Error fetching webhook history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/webhooks/:id/stats - Get webhook statistics
router.get('/:id/stats', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const stats = await WebhookService.getWebhookStats(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching webhook stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/webhooks/delivery/:deliveryId - Get delivery details
router.get('/delivery/:deliveryId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const delivery = await WebhookService.getWebhookDeliveryDetails(
      req.tenantId,
      req.params.deliveryId
    );

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
      });
    }

    res.json({
      success: true,
      data: delivery,
    });
  } catch (error: any) {
    console.error('Error fetching delivery details:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/webhooks/delivery/:deliveryId/retry - Retry failed delivery
router.post('/delivery/:deliveryId/retry', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    await WebhookService.retryWebhookDelivery(req.tenantId, req.params.deliveryId);

    res.json({
      success: true,
      message: 'Webhook delivery retry scheduled',
    });
  } catch (error: any) {
    console.error('Error retrying webhook delivery:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
