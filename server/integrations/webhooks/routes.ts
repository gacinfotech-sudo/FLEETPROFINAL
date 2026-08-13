/**
 * Webhook Management Routes
 * Comprehensive API endpoints for webhook CRUD, delivery management, testing, and replay
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateUser, requireAdmin, requireTenant, type AuthRequest } from '../../middleware/auth';
import { WebhookManager } from './WebhookManager';
import { WebhookStorageService, WebhookConfig as WebhookConfigModel } from './WebhookStorage';
import { WebhookDebugger } from './WebhookDebugger';
import crypto from 'crypto';
import { nanoid } from 'nanoid';

const router = Router();
const webhookManager = new WebhookManager();
const storageService = new WebhookStorageService();
const webhookDebugger = new WebhookDebugger();

// Middleware to validate webhook ownership
const validateWebhookOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { webhookId } = req.params;
    const webhook = await storageService.getConfig(webhookId);

    if (!webhook || webhook.tenantId !== req.tenantId) {
      return res.status(404).json({ message: 'Webhook not found' });
    }

    (req as any).webhook = webhook;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Failed to validate webhook' });
  }
};

/**
 * GET /api/webhooks
 * List all webhooks for tenant
 */
router.get(
  '/',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhooks = await storageService.getTenantWebhooks(req.tenantId!);
      res.json({
        webhooks: webhooks.map((w) => ({
          ...w,
          secret: undefined, // Don't expose secret
        })),
        total: webhooks.length,
      });
    } catch (error: any) {
      console.error('Failed to fetch webhooks:', error);
      res.status(500).json({ message: 'Failed to fetch webhooks' });
    }
  }
);

/**
 * POST /api/webhooks
 * Create new webhook
 */
router.post(
  '/',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { url, events, secret, name, description, headers } = req.body;

      // Validate required fields
      if (!url || !Array.isArray(events) || !secret) {
        return res.status(400).json({
          message: 'Missing required fields: url, events, secret',
        });
      }

      // Validate URL
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid webhook URL' });
      }

      const webhookConfig = await webhookManager.registerWebhook(req.tenantId!, {
        url,
        events,
        secret,
        isActive: true,
        name: name || `Webhook ${nanoid(6)}`,
        description,
        headers: headers || {},
      });

      // Save to database
      const savedWebhook = await storageService.saveConfig({
        ...webhookConfig,
        tenantId: req.tenantId,
      });

      // Record audit
      await storageService.recordAudit({
        webhookId: savedWebhook._id,
        tenantId: req.tenantId,
        action: 'created',
        actor: {
          userId: req.user?.id,
          email: req.user?.email,
        },
        details: `Created webhook for events: ${events.join(', ')}`,
        status: 'success',
      });

      res.status(201).json({
        webhook: {
          ...savedWebhook.toObject(),
          secret: undefined,
        },
        message: 'Webhook created successfully',
      });
    } catch (error: any) {
      console.error('Failed to create webhook:', error);
      res.status(500).json({ message: 'Failed to create webhook' });
    }
  }
);

/**
 * GET /api/webhooks/:webhookId
 * Get webhook details
 */
router.get(
  '/:webhookId',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const stats = await webhookManager.getWebhookStats(webhook._id);

      res.json({
        webhook: {
          ...webhook.toObject(),
          secret: undefined,
        },
        stats,
      });
    } catch (error: any) {
      console.error('Failed to fetch webhook:', error);
      res.status(500).json({ message: 'Failed to fetch webhook' });
    }
  }
);

/**
 * PUT /api/webhooks/:webhookId
 * Update webhook configuration
 */
router.put(
  '/:webhookId',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { url, events, name, description, headers, isActive } = req.body;

      // Validate URL if provided
      if (url) {
        try {
          new URL(url);
        } catch (error) {
          return res.status(400).json({ message: 'Invalid webhook URL' });
        }
      }

      const updates: any = {};
      if (url) updates.url = url;
      if (events) updates.events = events;
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (headers) updates.headers = headers;
      if (isActive !== undefined) updates.isActive = isActive;

      const updated = await storageService.updateConfig(webhook._id, updates);

      // Record audit
      await storageService.recordAudit({
        webhookId: webhook._id,
        tenantId: req.tenantId,
        action: 'updated',
        actor: {
          userId: req.user?.id,
          email: req.user?.email,
        },
        changes: {
          before: webhook.toObject(),
          after: updated.toObject(),
        },
        status: 'success',
      });

      res.json({
        webhook: {
          ...updated.toObject(),
          secret: undefined,
        },
        message: 'Webhook updated successfully',
      });
    } catch (error: any) {
      console.error('Failed to update webhook:', error);
      res.status(500).json({ message: 'Failed to update webhook' });
    }
  }
);

/**
 * DELETE /api/webhooks/:webhookId
 * Delete webhook
 */
router.delete(
  '/:webhookId',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;

      await storageService.deleteConfig(webhook._id);
      await webhookManager.deleteWebhook(webhook._id);

      // Record audit
      await storageService.recordAudit({
        webhookId: webhook._id,
        tenantId: req.tenantId,
        action: 'deleted',
        actor: {
          userId: req.user?.id,
          email: req.user?.email,
        },
        status: 'success',
      });

      res.json({ message: 'Webhook deleted successfully' });
    } catch (error: any) {
      console.error('Failed to delete webhook:', error);
      res.status(500).json({ message: 'Failed to delete webhook' });
    }
  }
);

/**
 * POST /api/webhooks/:webhookId/test
 * Test webhook delivery
 */
router.post(
  '/:webhookId/test',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;

      const result = await webhookManager.testWebhook(webhook);
      const diagnostics = await webhookDebugger.testDeliveryWithDiagnostics(
        webhook.url,
        webhookDebugger.generateTestPayload('webhook.test'),
        webhook.secret
      );

      // Record audit
      await storageService.recordAudit({
        webhookId: webhook._id,
        tenantId: req.tenantId,
        action: 'tested',
        actor: {
          userId: req.user?.id,
          email: req.user?.email,
        },
        details: `Test result: ${result.success ? 'Success' : 'Failed'}`,
        status: result.success ? 'success' : 'failure',
      });

      res.json({
        success: result.success,
        delivery: result,
        diagnostics: diagnostics.diagnostics,
      });
    } catch (error: any) {
      console.error('Failed to test webhook:', error);
      res.status(500).json({ message: 'Failed to test webhook' });
    }
  }
);

/**
 * GET /api/webhooks/:webhookId/delivery-history
 * Get webhook delivery history
 */
router.get(
  '/:webhookId/delivery-history',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { limit = 50, offset = 0, status, eventType, startDate, endDate } = req.query;

      const result = await storageService.getWebhookEvents(
        webhook._id,
        {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          status: status as string | undefined,
          eventType: eventType as string | undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
        }
      );

      res.json({
        events: result.events,
        total: result.total,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Failed to fetch delivery history:', error);
      res.status(500).json({ message: 'Failed to fetch delivery history' });
    }
  }
);

/**
 * GET /api/webhooks/:webhookId/events/:eventId
 * Get event details
 */
router.get(
  '/:webhookId/events/:eventId',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventId } = req.params;

      const event = await storageService.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const debugLogs = webhookDebugger.getDebugLogs((req as any).webhook._id, 5);

      res.json({
        event: event.toObject(),
        debugLogs,
      });
    } catch (error: any) {
      console.error('Failed to fetch event:', error);
      res.status(500).json({ message: 'Failed to fetch event' });
    }
  }
);

/**
 * POST /api/webhooks/:webhookId/events/:eventId/replay
 * Replay webhook event
 */
router.post(
  '/:webhookId/events/:eventId/replay',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { eventId } = req.params;

      const event = await storageService.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      const result = await webhookManager.deliverWebhook(
        webhook,
        event.payload
      );

      // Record audit
      await storageService.recordAudit({
        webhookId: webhook._id,
        tenantId: req.tenantId,
        action: 'retried',
        actor: {
          userId: req.user?.id,
          email: req.user?.email,
        },
        details: `Replayed event ${eventId}`,
        status: result.success ? 'success' : 'failure',
      });

      res.json({
        success: result.success,
        result,
      });
    } catch (error: any) {
      console.error('Failed to replay event:', error);
      res.status(500).json({ message: 'Failed to replay event' });
    }
  }
);

/**
 * GET /api/webhooks/:webhookId/dead-letter-queue
 * Get dead letter queue events
 */
router.get(
  '/:webhookId/dead-letter-queue',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { limit = 50 } = req.query;

      const dlqEvents = await storageService.getDeadLetterEvents(
        webhook.tenantId,
        parseInt(limit as string)
      );

      res.json({
        events: dlqEvents,
        count: dlqEvents.length,
      });
    } catch (error: any) {
      console.error('Failed to fetch DLQ:', error);
      res.status(500).json({ message: 'Failed to fetch DLQ' });
    }
  }
);

/**
 * POST /api/webhooks/:webhookId/dead-letter-queue/:eventId/replay
 * Replay event from dead letter queue
 */
router.post(
  '/:webhookId/dead-letter-queue/:eventId/replay',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { eventId } = req.params;

      const result = await webhookManager.replayWebhook(
        webhook._id,
        eventId,
        webhook
      );

      res.json({
        success: result.success,
        result,
      });
    } catch (error: any) {
      console.error('Failed to replay DLQ event:', error);
      res.status(500).json({ message: 'Failed to replay DLQ event' });
    }
  }
);

/**
 * GET /api/webhooks/:webhookId/debug-logs
 * Get debug logs
 */
router.get(
  '/:webhookId/debug-logs',
  authenticateUser,
  requireTenant,
  validateWebhookOwnership,
  async (req: AuthRequest, res: Response) => {
    try {
      const webhook = (req as any).webhook;
      const { limit = 50 } = req.query;

      const logs = webhookDebugger.getDebugLogs(webhook._id, parseInt(limit as string));
      const stats = webhookDebugger.getDebugStatistics(webhook._id);

      res.json({
        logs,
        statistics: stats,
      });
    } catch (error: any) {
      console.error('Failed to fetch debug logs:', error);
      res.status(500).json({ message: 'Failed to fetch debug logs' });
    }
  }
);

/**
 * POST /api/webhooks/payload/inspect
 * Inspect webhook payload
 */
router.post(
  '/payload/inspect',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const inspection = webhookDebugger.inspectPayload(req.body);

      res.json({
        inspection,
      });
    } catch (error: any) {
      console.error('Failed to inspect payload:', error);
      res.status(500).json({ message: 'Failed to inspect payload' });
    }
  }
);

/**
 * POST /api/webhooks/test-delivery
 * Test webhook delivery with diagnostics
 */
router.post(
  '/test-delivery',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { url, payload, secret, headers } = req.body;

      if (!url || !payload || !secret) {
        return res.status(400).json({
          message: 'Missing required fields: url, payload, secret',
        });
      }

      const result = await webhookDebugger.testDeliveryWithDiagnostics(
        url,
        payload,
        secret,
        headers
      );

      res.json(result);
    } catch (error: any) {
      console.error('Failed to test delivery:', error);
      res.status(500).json({ message: 'Failed to test delivery' });
    }
  }
);

/**
 * GET /api/webhooks/statistics
 * Get webhook statistics for tenant
 */
router.get(
  '/statistics',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const stats = await storageService.getStatistics(req.tenantId!);

      res.json(stats);
    } catch (error: any) {
      console.error('Failed to fetch statistics:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  }
);

/**
 * POST /api/webhooks/generate-test-payload
 * Generate test payload for event type
 */
router.post(
  '/generate-test-payload',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { eventType, customData } = req.body;

      if (!eventType) {
        return res.status(400).json({ message: 'Missing eventType' });
      }

      const payload = webhookDebugger.generateTestPayload(eventType, customData);

      res.json({
        payload,
      });
    } catch (error: any) {
      console.error('Failed to generate payload:', error);
      res.status(500).json({ message: 'Failed to generate payload' });
    }
  }
);

export default router;
