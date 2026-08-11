// Notification Audit & Compliance API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationAuditManager } from '../utils/notificationAudit';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationAuditAPI');
const router = express.Router();

// GET /api/notification-audit/trail
// Get user's audit trail
router.get('/trail', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { limit } = req.query;

    const auditLimit = Math.min(parseInt(limit as string) || 100, 1000);
    const trail = await notificationAuditManager.getUserAuditTrail(userId, auditLimit);

    log.info('Audit trail retrieved', { userId, count: trail.length });

    res.json({
      success: true,
      auditTrail: trail,
      count: trail.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get audit trail', { error });
    res.status(500).json({
      error: 'Failed to retrieve audit trail',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-audit/consent
// Get user's consent records
router.get('/consent', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const records = await notificationAuditManager.getConsentRecords(userId);

    log.info('Consent records retrieved', { userId, count: records.length });

    res.json({
      success: true,
      consentRecords: records,
      count: records.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get consent records', { error });
    res.status(500).json({
      error: 'Failed to retrieve consent records',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-audit/consent/give
// Record consent for notifications
router.post('/consent/give', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { consentType, version } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    if (!consentType || !version) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'consentType and version are required'
      });
    }

    const recordId = await notificationAuditManager.recordConsent(
      userId,
      consentType,
      version,
      { ipAddress, userAgent }
    );

    log.info('Consent recorded via API', { userId, consentType, version });

    res.json({
      success: true,
      message: 'Consent recorded successfully',
      recordId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to record consent', { error });
    res.status(500).json({
      error: 'Failed to record consent',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-audit/consent/withdraw
// Withdraw consent
router.post('/consent/withdraw', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { consentType } = req.body;

    if (!consentType) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'consentType is required'
      });
    }

    await notificationAuditManager.withdrawConsent(userId, consentType);

    log.info('Consent withdrawn via API', { userId, consentType });

    res.json({
      success: true,
      message: 'Consent withdrawn successfully',
      consentType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to withdraw consent', { error });
    res.status(500).json({
      error: 'Failed to withdraw consent',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-audit/export
// Export user's notification data (GDPR)
router.get('/export', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const exportData = await notificationAuditManager.exportUserData(userId);

    log.info('User data exported for GDPR/privacy', { userId });

    res.json({
      success: true,
      export: exportData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to export user data', { error });
    res.status(500).json({
      error: 'Failed to export user data',
      message: (error as Error).message
    });
  }
});

// Admin endpoints

// GET /api/notification-audit/admin/stats
// Get audit statistics (admin only)
router.get('/admin/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    const stats = await notificationAuditManager.getAuditStats(userId as string);

    log.info('Audit stats retrieved', { userId: userId || 'system-wide' });

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get audit stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-audit/admin/trail/:userId
// Get specific user's audit trail (admin only)
router.get(
  '/admin/trail/:userId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      const auditLimit = Math.min(parseInt(limit as string) || 100, 1000);
      const trail = await notificationAuditManager.getUserAuditTrail(userId, auditLimit);

      log.info('Admin retrieved user audit trail', { adminUserId: (req as any).userId, userId });

      res.json({
        success: true,
        userId,
        auditTrail: trail,
        count: trail.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get user audit trail', { error });
      res.status(500).json({
        error: 'Failed to retrieve audit trail',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-audit/admin/logs/by-date
// Get audit logs by date range (admin only)
router.get('/admin/logs/by-date', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'startDate and endDate are required (ISO format)'
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Dates must be valid ISO format'
      });
    }

    const logs = await notificationAuditManager.getAuditByDateRange(start, end, userId as string);

    log.info('Admin retrieved audit logs by date', {
      adminUserId: (req as any).userId,
      dateRange: { start, end },
      userId: userId || 'all'
    });

    res.json({
      success: true,
      dateRange: { start, end },
      userId: userId || 'all',
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get audit logs by date', { error });
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-audit/admin/cleanup
// Cleanup old audit logs (admin only)
router.post('/admin/cleanup', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { daysOld } = req.body;

    if (!daysOld || daysOld < 1) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'daysOld must be at least 1'
      });
    }

    const deleted = await notificationAuditManager.cleanupOldLogs(daysOld);

    log.info('Admin cleaned up old audit logs', {
      adminUserId: (req as any).userId,
      daysOld,
      deleted
    });

    res.json({
      success: true,
      message: `${deleted} old audit logs deleted`,
      daysOld,
      deleted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to cleanup audit logs', { error });
    res.status(500).json({
      error: 'Failed to cleanup logs',
      message: (error as Error).message
    });
  }
});

export default router;
