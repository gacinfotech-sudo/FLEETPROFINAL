// Notification Delivery Orchestrator API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationDeliveryOrchestrator } from '../utils/notificationDeliveryOrchestrator';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationDeliveryAPI');
const router = express.Router();

// POST /api/notification-delivery/send
// Send notification to user with preference/consent enforcement
router.post('/send', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title, body, category, templateId, channels, icon, badge, data, priority } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    if (!title || !body || !category) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'title, body, and category are required'
      });
    }

    const result = await notificationDeliveryOrchestrator.deliver({
      userId,
      title,
      body,
      category,
      templateId,
      channels,
      icon,
      badge,
      data,
      priority,
      ipAddress,
      userAgent
    });

    log.info('Notification delivered via orchestrator', {
      userId,
      notificationId: result.notificationId,
      channels: result.sentVia
    });

    res.json({
      success: result.success,
      notificationId: result.notificationId,
      sentVia: result.sentVia,
      skippedReasons: result.skippedReasons,
      deliveryTime: result.deliveryTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to send notification', { error });
    res.status(500).json({
      error: 'Failed to send notification',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-delivery/send-bulk
// Send bulk notifications with preference enforcement (admin only)
router.post(
  '/send-bulk',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { notifications } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'notifications array is required and must not be empty'
        });
      }

      // Validate each notification has required fields
      const validated = notifications.map(n => ({
        ...n,
        ipAddress,
        userAgent
      }));

      const results = await notificationDeliveryOrchestrator.deliverBulk(validated);

      const successful = results.filter(r => r.success).length;

      log.info('Bulk notifications delivered via orchestrator', {
        adminUserId: (req as any).userId,
        total: results.length,
        successful
      });

      res.json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful,
          failed: results.length - successful,
          successRate: ((successful / results.length) * 100).toFixed(2)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to send bulk notifications', { error });
      res.status(500).json({
        error: 'Failed to send bulk notifications',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-delivery/stats
// Get delivery orchestrator statistics
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = notificationDeliveryOrchestrator.getStats();

    log.info('Delivery stats retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get delivery stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-delivery/reset-stats
// Reset delivery statistics (admin only)
router.post(
  '/reset-stats',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      notificationDeliveryOrchestrator.resetStats();

      log.info('Delivery stats reset', { adminUserId: (req as any).userId });

      res.json({
        success: true,
        message: 'Delivery statistics reset successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to reset stats', { error });
      res.status(500).json({
        error: 'Failed to reset statistics',
        message: (error as Error).message
      });
    }
  }
);

export default router;
