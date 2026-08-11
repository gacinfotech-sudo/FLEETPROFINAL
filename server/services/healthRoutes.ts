/**
 * Health Dashboard API Routes
 * Endpoints for health monitoring, alerts, incidents, and metrics
 */

import { Router, type Request, type Response } from 'express';
import { HealthScheduler } from './HealthScheduler';
import { AlertManager } from './AlertManager';
import { AlertNotificationService } from './AlertNotification';
import { IncidentTracker } from './IncidentTracker';

const router = Router();

// ============================================================================
// HEALTH METRICS ENDPOINTS
// ============================================================================

/**
 * GET /api/health/metrics
 * Get current health metrics for all providers
 */
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = HealthScheduler.getMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/metrics/:provider
 * Get health metrics for a specific provider
 */
router.get('/metrics/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const metrics = HealthScheduler.getProviderMetrics(provider as any);

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: `No metrics found for provider: ${provider}`,
      });
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/check
 * Manually trigger a health check
 */
router.post('/check', async (_req: Request, res: Response) => {
  try {
    const results = await HealthScheduler.runTick();
    res.json({
      success: true,
      data: results,
      message: `Completed health check for ${results.length} providers`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// ALERT ENDPOINTS
// ============================================================================

/**
 * GET /api/health/alerts
 * Get all alerts (optionally filtered by provider or status)
 */
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const { provider, isActive } = req.query;

    let alerts = HealthScheduler.getAlertHistory();

    if (provider) {
      alerts = alerts.filter(a => a.provider === provider);
    }

    if (isActive === 'true') {
      alerts = alerts.filter(a => !a.isResolved);
    }

    res.json({
      success: true,
      data: alerts.slice(-100), // Last 100 alerts
      total: alerts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/alerts/:alertId/resolve
 * Manually resolve an alert
 */
router.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const alert = HealthScheduler.resolveAlert(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: `Alert not found: ${alertId}`,
      });
    }

    res.json({
      success: true,
      data: alert,
      message: 'Alert resolved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/alerts/mute
 * Mute alerts matching a pattern
 */
router.post('/alerts/mute', (req: Request, res: Response) => {
  try {
    const { provider, level, status, reason, durationMinutes } = req.body;

    const muted = AlertManager.mute(
      { provider, level, status },
      reason || 'User muted',
      durationMinutes
    );

    res.json({
      success: true,
      data: muted,
      message: 'Alerts muted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/alerts/unmute
 * Unmute alerts matching a pattern
 */
router.post('/alerts/unmute', (req: Request, res: Response) => {
  try {
    const { provider, level, status } = req.body;

    const success = AlertManager.unmute({ provider, level, status });

    res.json({
      success,
      message: success ? 'Alerts unmuted successfully' : 'No matching muted alerts found',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/alerts/muted
 * Get all muted alerts
 */
router.get('/alerts/muted', (_req: Request, res: Response) => {
  try {
    const muted = AlertManager.getMuted();
    res.json({
      success: true,
      data: muted,
      count: muted.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// INCIDENT ENDPOINTS
// ============================================================================

/**
 * GET /api/health/incidents
 * Get all incidents (optionally filtered by provider or status)
 */
router.get('/incidents', (req: Request, res: Response) => {
  try {
    const { provider, status } = req.query;

    let incidents = IncidentTracker.getAll();

    if (provider) {
      incidents = incidents.filter(i => i.provider === provider);
    }

    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }

    res.json({
      success: true,
      data: incidents,
      total: incidents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/incidents/:incidentId
 * Get incident details
 */
router.get('/incidents/:incidentId', (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const incident = IncidentTracker.get(incidentId);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: `Incident not found: ${incidentId}`,
      });
    }

    res.json({
      success: true,
      data: incident,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/health/incidents/:incidentId/status
 * Update incident status
 */
router.patch('/incidents/:incidentId/status', (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { status, author } = req.body;

    if (!status || !author) {
      return res.status(400).json({
        success: false,
        error: 'status and author are required',
      });
    }

    const incident = IncidentTracker.updateStatus(incidentId, status, author);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: `Incident not found: ${incidentId}`,
      });
    }

    res.json({
      success: true,
      data: incident,
      message: `Incident status updated to ${status}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/incidents/:incidentId/rca
 * Create RCA (Root Cause Analysis) report
 */
router.post('/incidents/:incidentId/rca', (req: Request, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { title, summary, rootCauses, contributingFactors, preventiveMeasures, correctiveActions, createdBy } = req.body;

    if (!title || !summary || !createdBy) {
      return res.status(400).json({
        success: false,
        error: 'title, summary, and createdBy are required',
      });
    }

    const rca = IncidentTracker.createRca(
      incidentId,
      {
        title,
        summary,
        rootCauses: rootCauses || [],
        contributingFactors: contributingFactors || [],
        timeline: [],
        preventiveMeasures: preventiveMeasures || [],
        correctiveActions: correctiveActions || [],
      },
      createdBy
    );

    res.json({
      success: true,
      data: rca,
      message: 'RCA report created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// STATISTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/health/statistics
 * Get overall health statistics
 */
router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const healthStats = HealthScheduler.getStatistics();
    const incidentStats = IncidentTracker.getStatistics();
    const deliveryStats = AlertManager.getStats();

    const combined = {
      ...healthStats,
      incidents: incidentStats,
      deliveries: deliveryStats,
    };

    res.json({
      success: true,
      data: combined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/trends
 * Get health trends over time
 */
router.get('/trends', (req: Request, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;

    // Generate mock trend data (in production, would come from database)
    const now = Date.now();
    const dataPoints = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
    const interval = (timeRange === '24h' ? 60 : timeRange === '7d' ? 1440 : 1440 * 30) / dataPoints;

    const trendData = Array.from({ length: dataPoints }, (_, i) => {
      const time = now - (dataPoints - i - 1) * interval * 60 * 1000;
      return {
        timestamp: new Date(time).toISOString(),
        whatsapp: 95 + Math.random() * 5 - Math.random() * 2,
        calling: 93 + Math.random() * 5 - Math.random() * 2,
        gps: 99 + Math.random() * 1 - Math.random() * 0.5,
        kyc: 94 + Math.random() * 5 - Math.random() * 2,
        esign: 96 + Math.random() * 4 - Math.random() * 1,
        hub: 98 + Math.random() * 2 - Math.random() * 1,
      };
    });

    res.json({
      success: true,
      data: trendData,
      timeRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SCHEDULER CONTROL ENDPOINTS
// ============================================================================

/**
 * GET /api/health/scheduler/status
 * Get health scheduler status
 */
router.get('/scheduler/status', (_req: Request, res: Response) => {
  try {
    const isRunning = HealthScheduler.isRunning();
    res.json({
      success: true,
      data: {
        isRunning,
        status: isRunning ? 'running' : 'stopped',
        checkInterval: '5 minutes',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/scheduler/start
 * Start health scheduler
 */
router.post('/scheduler/start', (_req: Request, res: Response) => {
  try {
    HealthScheduler.start();
    res.json({
      success: true,
      message: 'Health scheduler started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/health/scheduler/stop
 * Stop health scheduler
 */
router.post('/scheduler/stop', (_req: Request, res: Response) => {
  try {
    HealthScheduler.stop();
    res.json({
      success: true,
      message: 'Health scheduler stopped',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
