// Notification Triggers API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin, requireTenant, type AuthRequest } from '../middleware/auth';
import { getTriggerEngine } from '../utils/notificationEvents';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationTriggersAPI');
const router = express.Router();

// GET /api/notification-triggers
// Get all triggers for tenant
router.get(
  '/',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const engine = getTriggerEngine();
      const triggers = await engine.getTriggers(req.tenantId!);

      log.info('Triggers retrieved', { tenantId: req.tenantId, count: triggers.length });

      res.json({
        success: true,
        triggers,
        count: triggers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get triggers', { error });
      res.status(500).json({
        error: 'Failed to retrieve triggers',
        message: (error as Error).message
      });
    }
  }
);

// POST /api/notification-triggers
// Create new trigger
router.post(
  '/',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, eventType, templateId, channels, conditions, delay, recipients } = req.body;

      if (!name || !eventType || !templateId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'name, eventType, and templateId are required'
        });
      }

      if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'At least one channel is required'
        });
      }

      const engine = getTriggerEngine();
      const trigger = await engine.createTrigger({
        tenantId: req.tenantId!,
        name,
        eventType,
        enabled: true,
        templateId,
        channels,
        conditions,
        delay,
        recipients,
        createdBy: (req as any).userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      log.info('Trigger created', { tenantId: req.tenantId, triggerId: trigger._id });

      res.status(201).json({
        success: true,
        trigger,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to create trigger', { error });
      res.status(500).json({
        error: 'Failed to create trigger',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-triggers/:id
// Get specific trigger
router.get(
  '/:id',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const engine = getTriggerEngine();
      const triggers = await engine.getTriggers(req.tenantId!);
      const trigger = triggers.find(t => t._id?.toString() === req.params.id);

      if (!trigger) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Trigger not found'
        });
      }

      res.json({
        success: true,
        trigger,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get trigger', { error });
      res.status(500).json({
        error: 'Failed to retrieve trigger',
        message: (error as Error).message
      });
    }
  }
);

// PUT /api/notification-triggers/:id
// Update trigger
router.put(
  '/:id',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, templateId, channels, conditions, delay, recipients, enabled } = req.body;

      const engine = getTriggerEngine();
      await engine.updateTrigger(req.params.id, {
        name,
        templateId,
        channels,
        conditions,
        delay,
        recipients,
        enabled
      });

      log.info('Trigger updated', { tenantId: req.tenantId, triggerId: req.params.id });

      res.json({
        success: true,
        message: 'Trigger updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to update trigger', { error });
      res.status(500).json({
        error: 'Failed to update trigger',
        message: (error as Error).message
      });
    }
  }
);

// DELETE /api/notification-triggers/:id
// Delete trigger
router.delete(
  '/:id',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const engine = getTriggerEngine();
      await engine.deleteTrigger(req.params.id);

      log.info('Trigger deleted', { tenantId: req.tenantId, triggerId: req.params.id });

      res.json({
        success: true,
        message: 'Trigger deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to delete trigger', { error });
      res.status(500).json({
        error: 'Failed to delete trigger',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-triggers/logs
// Get trigger execution logs
router.get(
  '/logs',
  authenticateUser,
  requireTenant,
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit = 100 } = req.query;

      const engine = getTriggerEngine();
      const logs = await engine.getExecutionLogs(req.tenantId!, parseInt(limit as string));

      log.info('Execution logs retrieved', { tenantId: req.tenantId, count: logs.length });

      res.json({
        success: true,
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get execution logs', { error });
      res.status(500).json({
        error: 'Failed to retrieve execution logs',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-triggers/event-types
// Get available event types
router.get('/event-types', authenticateUser, async (req: Request, res: Response) => {
  try {
    const eventTypes = [
      'booking_created',
      'booking_confirmed',
      'booking_cancelled',
      'booking_completed',
      'driver_assigned',
      'driver_unassigned',
      'payment_due',
      'payment_received',
      'payment_overdue',
      'vehicle_assigned',
      'vehicle_maintenance_due',
      'promotion_activated',
      'alert_issued',
      'support_ticket_created',
      'support_ticket_resolved',
      'review_requested',
      'referral_completed'
    ];

    log.info('Event types retrieved', { count: eventTypes.length });

    res.json({
      success: true,
      eventTypes,
      count: eventTypes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get event types', { error });
    res.status(500).json({
      error: 'Failed to retrieve event types',
      message: (error as Error).message
    });
  }
});

export default router;
