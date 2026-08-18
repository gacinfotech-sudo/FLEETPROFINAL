import { Router } from 'express';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    memory: 'ok' | 'warning' | 'error';
    cpu: 'ok' | 'warning' | 'error';
    api: 'ok' | 'error';
  };
  metrics: {
    memoryUsageMB: number;
    memoryPercentage: number;
    uptimeSeconds: number;
    requestsPerSecond: number;
  };
}

export class HealthChecker {
  private startTime = Date.now();
  private requestCount = 0;

  recordRequest() {
    this.requestCount++;
  }

  async checkDatabase(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      return false;
    }
  }

  getMemoryStatus(): { status: 'ok' | 'warning' | 'error'; percentUsed: number } {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const heapUsedPercent = (memUsage.heapUsed / totalMem) * 100;

    if (heapUsedPercent > 90) return { status: 'error', percentUsed: heapUsedPercent };
    if (heapUsedPercent > 75) return { status: 'warning', percentUsed: heapUsedPercent };
    return { status: 'ok', percentUsed: heapUsedPercent };
  }

  getCPUStatus(): 'ok' | 'warning' | 'error' {
    const cpuUsage = process.cpuUsage();
    const totalCPUUsed = (cpuUsage.user + cpuUsage.system) / 1000000;
    
    if (totalCPUUsed > 60) return 'error';
    if (totalCPUUsed > 30) return 'warning';
    return 'ok';
  }

  getHealth(dbHealthy: boolean): HealthStatus {
    const uptime = Date.now() - this.startTime;
    const memory = this.getMemoryStatus();
    const memUsage = process.memoryUsage();
    const requestsPerSecond = this.requestCount / (uptime / 1000);

    const overallStatus = 
      !dbHealthy || memory.status === 'error' || this.getCPUStatus() === 'error'
        ? 'unhealthy'
        : memory.status === 'warning' || this.getCPUStatus() === 'warning'
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime,
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        memory: memory.status,
        cpu: this.getCPUStatus(),
        api: 'ok'
      },
      metrics: {
        memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryPercentage: Math.round(memory.percentUsed),
        uptimeSeconds: Math.round(uptime / 1000),
        requestsPerSecond: Math.round(requestsPerSecond * 100) / 100
      }
    };
  }
}

export function createHealthRouter(healthChecker: HealthChecker, dbCheck: () => Promise<boolean>) {
  const router = Router();

  router.get('/health', async (req, res) => {
    try {
      const dbHealthy = await dbCheck();
      const health = healthChecker.getHealth(dbHealthy);
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 207 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: Date.now()
      });
    }
  });

  router.get('/health/detailed', async (req, res) => {
    try {
      const dbHealthy = await dbCheck();
      const health = healthChecker.getHealth(dbHealthy);
      
      res.json({
        ...health,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    } catch (error) {
      res.status(503).json({ error: 'Detailed health check failed' });
    }
  });

  router.get('/health/ready', async (req, res) => {
    try {
      const dbHealthy = await dbCheck();
      if (dbHealthy) {
        res.json({ ready: true });
      } else {
        res.status(503).json({ ready: false, reason: 'Database not ready' });
      }
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'Readiness check failed' });
    }
  });

  router.get('/health/live', (req, res) => {
    res.json({ alive: true, timestamp: Date.now() });
  });

  return router;
}
