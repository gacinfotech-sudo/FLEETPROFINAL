import { Router, Request, Response } from 'express';
import { getMetricsAsPrometheus } from './metrics';
import { getLogger } from './structured-logging';

const logger = getLogger('prometheus-endpoint');

/**
 * Prometheus Metrics Endpoint
 * Exposes metrics in Prometheus text format
 */

export function createPrometheusRouter(): Router {
  const router = Router();

  /**
   * GET /metrics
   * Returns all collected metrics in Prometheus text format
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await getMetricsAsPrometheus();

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);

      logger.debug('Prometheus metrics exported', {
        size_bytes: metrics.length,
      });
    } catch (error) {
      logger.error('Failed to generate Prometheus metrics', {}, error as Error);
      res.status(500).json({
        error: 'Failed to generate metrics',
        message: (error as Error).message,
      });
    }
  });

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (_req: Request, res: Response) => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });
    } catch (error) {
      logger.error('Health check failed', {}, error as Error);
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  });

  /**
   * GET /readiness
   * Readiness check endpoint
   */
  router.get('/readiness', (_req: Request, res: Response) => {
    try {
      // Check if server is ready to accept requests
      const isReady = true; // Add your readiness logic here

      if (isReady) {
        res.json({
          ready: true,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          ready: false,
          message: 'Service not ready',
        });
      }
    } catch (error) {
      logger.error('Readiness check failed', {}, error as Error);
      res.status(503).json({
        ready: false,
        error: (error as Error).message,
      });
    }
  });

  /**
   * GET /liveness
   * Liveness check endpoint
   */
  router.get('/liveness', (_req: Request, res: Response) => {
    try {
      res.json({
        alive: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Liveness check failed', {}, error as Error);
      res.status(503).json({
        alive: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}

/**
 * Register Prometheus endpoint with app
 */
export function registerPrometheusEndpoint(app: any, basePath: string = '/observability'): void {
  const prometheusRouter = createPrometheusRouter();
  app.use(basePath, prometheusRouter);

  logger.info('Prometheus endpoint registered', {
    base_path: basePath,
    endpoints: [
      `${basePath}/metrics`,
      `${basePath}/health`,
      `${basePath}/readiness`,
      `${basePath}/liveness`,
    ],
  });
}
