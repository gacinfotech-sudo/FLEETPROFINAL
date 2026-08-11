// Health check and monitoring utilities
import { createLogger } from './logger';

const log = createLogger('HealthCheck');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: {
    connected: boolean;
    name?: string;
  };
  server: {
    memory: {
      used: number;
      limit: number;
      percent: number;
    };
    cpu: {
      percent: number;
    };
  };
  checks: {
    name: string;
    status: 'pass' | 'fail';
    duration: number;
  }[];
}

export class HealthMonitor {
  private startTime: number;
  private checks: Map<string, () => Promise<boolean>>;

  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
  }

  registerCheck(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
    log.info(`Registered health check: ${name}`);
  }

  async getStatus(dbConnected: boolean, dbName?: string): Promise<HealthStatus> {
    const now = Date.now();
    const uptime = now - this.startTime;
    const memUsage = process.memoryUsage();

    // Run all checks
    const checkResults = await Promise.all(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        const checkStart = Date.now();
        try {
          const passed = await check();
          return {
            name,
            status: passed ? ('pass' as const) : ('fail' as const),
            duration: Date.now() - checkStart,
          };
        } catch (error) {
          return {
            name,
            status: 'fail' as const,
            duration: Date.now() - checkStart,
          };
        }
      })
    );

    const allChecksPassed = checkResults.every((c) => c.status === 'pass');
    const status = dbConnected && allChecksPassed ? 'healthy' : dbConnected ? 'degraded' : 'unhealthy';

    if (status !== 'healthy') {
      log.warn('Health check status not healthy', { status, dbConnected, checksPassed: allChecksPassed });
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      database: {
        connected: dbConnected,
        name: dbName,
      },
      server: {
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          limit: Math.round(memUsage.heapTotal / 1024 / 1024),
          percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        cpu: {
          percent: Math.round((process.cpuUsage().user / 1000 / 1000) * 100),
        },
      },
      checks: checkResults,
    };
  }
}

export const healthMonitor = new HealthMonitor();

export default HealthMonitor;
