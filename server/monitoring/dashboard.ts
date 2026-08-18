import { Router } from 'express';
import { HealthChecker, HealthStatus } from './health-check';
import { MetricsCollector, MetricsSummary } from './metrics';
import { AlertManager } from './alerts';

export class MonitoringDashboard {
  constructor(
    private healthChecker: HealthChecker,
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager,
    private dbCheck: () => Promise<boolean>
  ) {}

  async getDashboardData() {
    const dbHealthy = await this.dbCheck();
    const health = this.healthChecker.getHealth(dbHealthy);
    const metrics = this.metricsCollector.getMetrics();
    const activeAlerts = this.alertManager.getActiveAlerts();

    return {
      timestamp: Date.now(),
      health,
      metrics,
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        list: activeAlerts
      },
      status: this.calculateOverallStatus(health, activeAlerts)
    };
  }

  private calculateOverallStatus(health: HealthStatus, alerts: any[]) {
    if (health.status === 'unhealthy' || alerts.some(a => a.severity === 'critical')) {
      return 'critical';
    }
    if (health.status === 'degraded' || alerts.some(a => a.severity === 'high')) {
      return 'warning';
    }
    return 'healthy';
  }

  createRouter() {
    const router = Router();

    router.get('/dashboard', async (req, res) => {
      try {
        const data = await this.getDashboardData();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Dashboard request failed' });
      }
    });

    router.get('/dashboard/metrics', (req, res) => {
      try {
        const metrics = this.metricsCollector.getMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Metrics request failed' });
      }
    });

    router.get('/dashboard/alerts', (req, res) => {
      try {
        const alerts = this.alertManager.getAllAlerts();
        const active = this.alertManager.getActiveAlerts();
        res.json({
          all: alerts,
          active,
          count: active.length
        });
      } catch (error) {
        res.status(500).json({ error: 'Alerts request failed' });
      }
    });

    router.post('/dashboard/alerts/:id/disable', (req, res) => {
      try {
        this.alertManager.disableAlert(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to disable alert' });
      }
    });

    router.post('/dashboard/alerts/:id/enable', (req, res) => {
      try {
        this.alertManager.enableAlert(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to enable alert' });
      }
    });

    return router;
  }
}
