// ============================================================================
// HEALTH CHECK CONTROLLER - Database & System Health
// Phase 4: Health & Monitoring
// ============================================================================

import { Request, Response } from 'express';
import { RepositoryFactory } from '../repositories';

export class HealthController {
  /**
   * GET /health
   * Basic health check - confirms server is running
   */
  static async getHealth(req: Request, res: Response) {
    try {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        error: error.message,
      });
    }
  }

  /**
   * GET /ready
   * Readiness check - confirms database connectivity
   */
  static async getReady(req: Request, res: Response) {
    try {
      // Test all repositories can connect
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const alertRepo = RepositoryFactory.getDocumentAlertRepository();
      const historyRepo = RepositoryFactory.getDocumentHistoryRepository();
      const configRepo = RepositoryFactory.getComplianceConfigRepository();
      const docTypeRepo = RepositoryFactory.getDocumentTypeMasterRepository();

      const checks = await Promise.all([
        docRepo.healthCheck(),
        alertRepo.healthCheck(),
        historyRepo.healthCheck(),
        configRepo.healthCheck(),
        docTypeRepo.healthCheck(),
      ]);

      const allHealthy = checks.every((check) => check === true);

      if (allHealthy) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          database: 'connected',
          repositories: {
            vehicleDocument: true,
            documentAlert: true,
            documentHistory: true,
            complianceConfig: true,
            documentTypeMaster: true,
          },
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          repositories: {
            vehicleDocument: checks[0],
            documentAlert: checks[1],
            documentHistory: checks[2],
            complianceConfig: checks[3],
            documentTypeMaster: checks[4],
          },
        });
      }
    } catch (error: any) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error.message,
      });
    }
  }

  /**
   * GET /metrics
   * Metrics endpoint - system performance data
   */
  static async getMetrics(req: Request, res: Response) {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      res.json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  }
}

export const registerHealthRoutes = (app: any) => {
  app.get('/health', HealthController.getHealth);
  app.get('/ready', HealthController.getReady);
  app.get('/metrics', HealthController.getMetrics);
};
