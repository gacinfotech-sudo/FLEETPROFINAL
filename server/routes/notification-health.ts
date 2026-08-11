// Notification System Health & Monitoring API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationHealthMonitor, HealthStatus } from '../utils/notificationHealthMonitor';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationHealthAPI');
const router = express.Router();

// GET /api/notification-health/status
// Get current health status
router.get('/status', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = await notificationHealthMonitor.getHealthStatus();

    log.info('Health status retrieved', { status: health.status });

    const statusCode = health.status === HealthStatus.HEALTHY ? 200 : health.status === HealthStatus.DEGRADED ? 503 : 500;

    res.status(statusCode).json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get health status', { error });
    res.status(500).json({
      error: 'Failed to retrieve health status',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-health/diagnostics
// Get detailed diagnostic report
router.get(
  '/diagnostics',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const report = await notificationHealthMonitor.getDiagnosticReport();

      log.info('Diagnostic report generated');

      res.json({
        success: true,
        report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to generate diagnostics', { error });
      res.status(500).json({
        error: 'Failed to generate diagnostic report',
        message: (error as Error).message
      });
    }
  }
);

// GET /api/notification-health/summary
// Get quick health summary
router.get('/summary', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = await notificationHealthMonitor.getHealthStatus();

    const summary = {
      overallStatus: health.status,
      healthyComponents: Object.entries(health.components)
        .filter(([_, c]) => c.status === HealthStatus.HEALTHY)
        .map(([name]) => name),
      degradedComponents: Object.entries(health.components)
        .filter(([_, c]) => c.status === HealthStatus.DEGRADED)
        .map(([name]) => name),
      unhealthyComponents: Object.entries(health.components)
        .filter(([_, c]) => c.status === HealthStatus.UNHEALTHY)
        .map(([name]) => name),
      performanceMetrics: health.performance,
      capacityMetrics: health.capacity,
      issueCount: health.issues.length,
      criticalIssues: health.issues.filter(i => i.severity === 'critical').length,
      warningIssues: health.issues.filter(i => i.severity === 'warning').length
    };

    log.info('Health summary retrieved');

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get health summary', { error });
    res.status(500).json({
      error: 'Failed to retrieve health summary',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-health/issues
// Get current issues
router.get('/issues', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = await notificationHealthMonitor.getHealthStatus();

    const issuesByComponent = health.issues.reduce(
      (acc, issue) => {
        if (!acc[issue.component]) {
          acc[issue.component] = [];
        }
        acc[issue.component].push(issue);
        return acc;
      },
      {} as Record<string, typeof health.issues>
    );

    log.info('Issues retrieved', { count: health.issues.length });

    res.json({
      success: true,
      issues: health.issues,
      issuesByComponent,
      summary: {
        total: health.issues.length,
        critical: health.issues.filter(i => i.severity === 'critical').length,
        warning: health.issues.filter(i => i.severity === 'warning').length,
        info: health.issues.filter(i => i.severity === 'info').length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get issues', { error });
    res.status(500).json({
      error: 'Failed to retrieve issues',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-health/components/:component
// Get specific component health
router.get(
  '/components/:component',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { component } = req.params;

      const health = await notificationHealthMonitor.getHealthStatus();
      const componentHealth = (health.components as any)[component];

      if (!componentHealth) {
        return res.status(404).json({
          error: 'Not found',
          message: `Component '${component}' not found`
        });
      }

      const componentIssues = health.issues.filter(i => i.component === component);

      log.info('Component health retrieved', { component });

      res.json({
        success: true,
        component,
        health: componentHealth,
        issues: componentIssues,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to get component health', { error });
      res.status(500).json({
        error: 'Failed to retrieve component health',
        message: (error as Error).message
      });
    }
  }
);

export default router;
