/**
 * resilience/routes.ts
 * REST API endpoints for resilience system monitoring and control
 * Exposes circuit breaker status, bulkhead metrics, timeout stats, and fault tolerance health
 */

import { Router, Request, Response } from 'express';
import { CircuitBreaker, circuitBreakerFactory, CircuitState } from './CircuitBreaker';
import { bulkheadFactory } from './BulkheadPattern';
import { timeoutManagerFactory } from './TimeoutManagement';
import { faultToleranceOrchestrator } from './FaultTolerance';
import { logger } from '../utils/logger';

const router = Router();

// ============ Circuit Breaker Routes ============

/**
 * GET /resilience/circuit-breakers
 * Get status of all circuit breakers
 */
router.get('/circuit-breakers', (req: Request, res: Response) => {
  try {
    const status = circuitBreakerFactory.getAllStatus();
    const summary = {
      timestamp: new Date(),
      totalBreakers: Object.keys(status).length,
      openBreakers: Object.values(status).filter(
        (s: any) => s.state === CircuitState.OPEN
      ).length,
      halfOpenBreakers: Object.values(status).filter(
        (s: any) => s.state === CircuitState.HALF_OPEN
      ).length,
      closedBreakers: Object.values(status).filter(
        (s: any) => s.state === CircuitState.CLOSED
      ).length,
      status,
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error fetching circuit breaker status', { error });
    res.status(500).json({ error: 'Failed to fetch circuit breaker status' });
  }
});

/**
 * GET /resilience/circuit-breakers/:provider
 * Get status of specific circuit breaker
 */
router.get('/circuit-breakers/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const breaker = circuitBreakerFactory.getBreaker(provider);

    res.json({
      provider,
      state: breaker.getState(),
      metrics: breaker.getMetrics(),
      isAvailable: breaker.isAvailable(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching circuit breaker details', { error });
    res.status(500).json({ error: 'Failed to fetch circuit breaker details' });
  }
});

/**
 * POST /resilience/circuit-breakers/:provider/reset
 * Reset a specific circuit breaker
 */
router.post('/circuit-breakers/:provider/reset', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const breaker = circuitBreakerFactory.getBreaker(provider);
    breaker.reset();

    logger.info(`Circuit breaker reset for provider: ${provider}`);

    res.json({
      message: `Circuit breaker for ${provider} reset successfully`,
      newState: breaker.getState(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error resetting circuit breaker', { error });
    res.status(500).json({ error: 'Failed to reset circuit breaker' });
  }
});

/**
 * POST /resilience/circuit-breakers/reset-all
 * Reset all circuit breakers
 */
router.post('/circuit-breakers/reset-all', (req: Request, res: Response) => {
  try {
    circuitBreakerFactory.resetAll();

    logger.info('All circuit breakers reset');

    res.json({
      message: 'All circuit breakers reset successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error resetting all circuit breakers', { error });
    res.status(500).json({ error: 'Failed to reset all circuit breakers' });
  }
});

// ============ Bulkhead Routes ============

/**
 * GET /resilience/bulkheads
 * Get status of all bulkheads
 */
router.get('/bulkheads', (req: Request, res: Response) => {
  try {
    const status = bulkheadFactory.getAllStatus();
    const summary = {
      timestamp: new Date(),
      totalBulkheads: Object.keys(status).length,
      status,
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error fetching bulkhead status', { error });
    res.status(500).json({ error: 'Failed to fetch bulkhead status' });
  }
});

/**
 * GET /resilience/bulkheads/:provider
 * Get detailed status of specific bulkhead
 */
router.get('/bulkheads/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const bulkhead = bulkheadFactory.getBulkhead(provider);

    res.json({
      provider,
      metrics: bulkhead.getMetrics(),
      status: bulkhead.getStatus(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching bulkhead details', { error });
    res.status(500).json({ error: 'Failed to fetch bulkhead details' });
  }
});

/**
 * POST /resilience/bulkheads/:provider/drain
 * Drain bulkhead queue
 */
router.post('/bulkheads/:provider/drain', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const bulkhead = bulkheadFactory.getBulkhead(provider);

    await bulkhead.drain();

    logger.info(`Bulkhead drained for provider: ${provider}`);

    res.json({
      message: `Bulkhead for ${provider} drained successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error draining bulkhead', { error });
    res.status(500).json({ error: 'Failed to drain bulkhead' });
  }
});

// ============ Timeout Management Routes ============

/**
 * GET /resilience/timeouts
 * Get timeout configuration and metrics for all providers
 */
router.get('/timeouts', (req: Request, res: Response) => {
  try {
    const stats = timeoutManagerFactory.getAllStats();
    const summary = {
      timestamp: new Date(),
      totalManagers: Object.keys(stats).length,
      stats,
    };

    res.json(summary);
  } catch (error) {
    logger.error('Error fetching timeout stats', { error });
    res.status(500).json({ error: 'Failed to fetch timeout stats' });
  }
});

/**
 * GET /resilience/timeouts/:provider
 * Get timeout metrics for specific provider
 */
router.get('/timeouts/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const manager = timeoutManagerFactory.getManager(provider);

    res.json({
      provider,
      currentTimeout: manager.getMetrics().currentTimeout,
      metrics: manager.getMetrics(),
      budget: manager.getBudgetStatus(),
      stats: manager.getTimeoutStats(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching timeout details', { error });
    res.status(500).json({ error: 'Failed to fetch timeout details' });
  }
});

/**
 * POST /resilience/timeouts/:provider/set
 * Set manual timeout for provider
 */
router.post('/timeouts/:provider/set', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { timeout } = req.body;

    if (!timeout || typeof timeout !== 'number') {
      return res.status(400).json({ error: 'Invalid timeout value' });
    }

    const manager = timeoutManagerFactory.getManager(provider);
    manager.setManualTimeout(timeout);

    logger.info(`Timeout set for provider ${provider}:`, { timeout });

    res.json({
      message: `Timeout set to ${timeout}ms for ${provider}`,
      newTimeout: timeout,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error setting timeout', { error });
    res.status(500).json({ error: 'Failed to set timeout' });
  }
});

// ============ Fault Tolerance Routes ============

/**
 * GET /resilience/health
 * Get comprehensive health report of entire resilience system
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const report = faultToleranceOrchestrator.getHealthReport();
    const circuitBreakerStatus = circuitBreakerFactory.getAllStatus();
    const bulkheadStatus = bulkheadFactory.getAllStatus();
    const timeoutStats = timeoutManagerFactory.getAllStats();

    const overallHealth = {
      timestamp: new Date(),
      isHealthy: Object.values(report.providers).every(
        (p: any) => p.health.isHealthy
      ),
      summary: {
        faultTolerance: report.providers,
        circuitBreakers: circuitBreakerStatus,
        bulkheads: bulkheadStatus,
        timeouts: timeoutStats,
      },
    };

    res.json(overallHealth);
  } catch (error) {
    logger.error('Error generating health report', { error });
    res.status(500).json({ error: 'Failed to generate health report' });
  }
});

/**
 * GET /resilience/fault-tolerance/:provider
 * Get fault tolerance metrics for specific provider
 */
router.get('/fault-tolerance/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const ft = faultToleranceOrchestrator.get(provider);

    if (!ft) {
      return res.status(404).json({ error: `No fault tolerance configured for ${provider}` });
    }

    res.json({
      provider,
      metrics: ft.getMetrics(),
      health: ft.getHealthStatus(),
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error fetching fault tolerance details', { error });
    res.status(500).json({ error: 'Failed to fetch fault tolerance details' });
  }
});

/**
 * POST /resilience/fault-tolerance/reset
 * Reset all fault tolerance metrics
 */
router.post('/resilience/fault-tolerance/reset', (req: Request, res: Response) => {
  try {
    faultToleranceOrchestrator.resetAllMetrics();

    logger.info('All fault tolerance metrics reset');

    res.json({
      message: 'All fault tolerance metrics reset successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Error resetting fault tolerance metrics', { error });
    res.status(500).json({ error: 'Failed to reset fault tolerance metrics' });
  }
});

// ============ Dashboard & Metrics Routes ============

/**
 * GET /resilience/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const circuitBreakerStatus = circuitBreakerFactory.getAllStatus();
    const bulkheadStatus = bulkheadFactory.getAllStatus();
    const timeoutStats = timeoutManagerFactory.getAllStats();
    const healthReport = faultToleranceOrchestrator.getHealthReport();

    const dashboard = {
      timestamp: new Date(),
      overview: {
        totalProviders: Object.keys(circuitBreakerStatus).length,
        circuitBreakersOpen: Object.values(circuitBreakerStatus).filter(
          (s: any) => s.state === CircuitState.OPEN
        ).length,
        bulkheadsHighUtilization: Object.values(bulkheadStatus).filter(
          (s: any) => s.utilizationPercent > 80
        ).length,
        timeoutsEscalated: Object.values(timeoutStats).filter(
          (s: any) => s.metrics.adjustments > 0
        ).length,
      },
      circuitBreakers: {
        summary: circuitBreakerStatus,
      },
      bulkheads: {
        summary: bulkheadStatus,
      },
      timeouts: {
        summary: timeoutStats,
      },
      faultTolerance: {
        summary: healthReport.providers,
      },
      alerts: generateAlerts(
        circuitBreakerStatus,
        bulkheadStatus,
        timeoutStats,
        healthReport
      ),
    };

    res.json(dashboard);
  } catch (error) {
    logger.error('Error generating dashboard', { error });
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

/**
 * GET /resilience/metrics/export
 * Export all metrics in Prometheus format
 */
router.get('/metrics/export', (req: Request, res: Response) => {
  try {
    let metrics = '';

    // Circuit breaker metrics
    const circuitBreakerStatus = circuitBreakerFactory.getAllStatus();
    Object.entries(circuitBreakerStatus).forEach(([provider, status]: [string, any]) => {
      metrics += `# Circuit Breaker Metrics for ${provider}\n`;
      metrics += `resilience_circuit_breaker_state{provider="${provider}",state="${status.state}"} 1\n`;
      metrics += `resilience_circuit_breaker_requests_total{provider="${provider}"} ${status.metrics.totalRequests}\n`;
      metrics += `resilience_circuit_breaker_requests_successful{provider="${provider}"} ${status.metrics.successfulRequests}\n`;
      metrics += `resilience_circuit_breaker_requests_failed{provider="${provider}"} ${status.metrics.failedRequests}\n`;
      metrics += `resilience_circuit_breaker_requests_rejected{provider="${provider}"} ${status.metrics.rejectedRequests}\n`;
      metrics += `resilience_circuit_breaker_avg_response_time_ms{provider="${provider}"} ${status.metrics.averageResponseTime}\n\n`;
    });

    // Bulkhead metrics
    const bulkheadStatus = bulkheadFactory.getAllStatus();
    Object.entries(bulkheadStatus).forEach(([provider, status]: [string, any]) => {
      metrics += `# Bulkhead Metrics for ${provider}\n`;
      metrics += `resilience_bulkhead_concurrent_operations{provider="${provider}"} ${status.utilizationPercent}\n`;
      metrics += `resilience_bulkhead_queue_depth_percent{provider="${provider}"} ${status.queueUtilizationPercent}\n`;
      metrics += `resilience_bulkhead_estimated_wait_time_ms{provider="${provider}"} ${status.estimatedWaitTime}\n\n`;
    });

    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Error exporting metrics', { error });
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

// ============ Helper Functions ============

function generateAlerts(
  circuitBreakerStatus: any,
  bulkheadStatus: any,
  timeoutStats: any,
  healthReport: any
): any[] {
  const alerts: any[] = [];

  // Check for open circuit breakers
  Object.entries(circuitBreakerStatus).forEach(([provider, status]: [string, any]) => {
    if (status.state === CircuitState.OPEN) {
      alerts.push({
        severity: 'HIGH',
        type: 'CIRCUIT_BREAKER_OPEN',
        provider,
        message: `Circuit breaker open for ${provider}`,
        timestamp: new Date(),
      });
    }

    if (status.state === CircuitState.HALF_OPEN) {
      alerts.push({
        severity: 'MEDIUM',
        type: 'CIRCUIT_BREAKER_TESTING',
        provider,
        message: `Circuit breaker testing recovery for ${provider}`,
        timestamp: new Date(),
      });
    }
  });

  // Check for high bulkhead utilization
  Object.entries(bulkheadStatus).forEach(([provider, status]: [string, any]) => {
    if (status.utilizationPercent > 80) {
      alerts.push({
        severity: 'MEDIUM',
        type: 'BULKHEAD_HIGH_UTILIZATION',
        provider,
        message: `Bulkhead utilization high for ${provider}: ${status.utilizationPercent.toFixed(2)}%`,
        timestamp: new Date(),
      });
    }

    if (status.queueUtilizationPercent > 80) {
      alerts.push({
        severity: 'HIGH',
        type: 'BULKHEAD_QUEUE_FULL',
        provider,
        message: `Bulkhead queue nearly full for ${provider}: ${status.queueUtilizationPercent.toFixed(2)}%`,
        timestamp: new Date(),
      });
    }
  });

  // Check for cascading failures
  Object.entries(healthReport.providers).forEach(([provider, health]: [string, any]) => {
    if (
      health.health.cascadingFailureRisk === 'HIGH' ||
      health.health.cascadingFailureRisk === 'MEDIUM'
    ) {
      alerts.push({
        severity: health.health.cascadingFailureRisk === 'HIGH' ? 'CRITICAL' : 'HIGH',
        type: 'CASCADING_FAILURE_RISK',
        provider,
        message: `Cascading failure risk for ${provider}: ${health.health.cascadingFailureRisk}`,
        timestamp: new Date(),
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (
      (severityOrder[a.severity as keyof typeof severityOrder] || 999) -
      (severityOrder[b.severity as keyof typeof severityOrder] || 999)
    );
  });
}

export default router;
