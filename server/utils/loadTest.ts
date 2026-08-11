// Load testing and performance monitoring utility
import { createLogger } from './logger';
import { performance } from 'perf_hooks';

const log = createLogger('LoadTest');

export interface LoadTestConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  concurrency: number;
  requests: number;
  timeout: number;
}

export interface LoadTestResult {
  name: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  requestsPerSecond: number;
  errors: string[];
}

export class LoadTester {
  private results: Map<string, LoadTestResult> = new Map();

  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    log.info(`Starting load test: ${config.name}`, {
      concurrency: config.concurrency,
      requests: config.requests,
    });

    const responseTimes: number[] = [];
    const errors: string[] = [];
    const startTime = performance.now();

    // Simulate concurrent requests
    const chunkSize = config.concurrency;
    for (let i = 0; i < config.requests; i += chunkSize) {
      const chunk = Math.min(chunkSize, config.requests - i);
      const promises = [];

      for (let j = 0; j < chunk; j++) {
        promises.push(this.makeRequest(config, responseTimes, errors));
      }

      await Promise.all(promises);
    }

    const totalTime = performance.now() - startTime;

    // Calculate statistics
    responseTimes.sort((a, b) => a - b);
    const successCount = config.requests - errors.length;
    const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const result: LoadTestResult = {
      name: config.name,
      totalRequests: config.requests,
      successCount,
      errorCount: errors.length,
      totalTime,
      averageTime,
      minTime: responseTimes[0],
      maxTime: responseTimes[responseTimes.length - 1],
      p95Time: responseTimes[p95Index],
      p99Time: responseTimes[p99Index],
      requestsPerSecond: (config.requests / totalTime) * 1000,
      errors: errors.slice(0, 10), // Keep first 10 errors
    };

    this.results.set(config.name, result);

    // Log results
    log.info(`Load test completed: ${config.name}`, {
      successCount,
      errorCount: errors.length,
      averageTime: Math.round(averageTime),
      p95Time: Math.round(result.p95Time),
      rps: Math.round(result.requestsPerSecond),
    });

    return result;
  }

  private async makeRequest(
    config: LoadTestConfig,
    responseTimes: number[],
    errors: string[]
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.url, {
        method: config.method,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = performance.now() - startTime;
      responseTimes.push(responseTime);

      if (!response.ok) {
        errors.push(`HTTP ${response.status}`);
      }
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  getResults(): Map<string, LoadTestResult> {
    return this.results;
  }

  generateReport(): string {
    let report = '\n=== LOAD TEST REPORT ===\n\n';

    for (const [name, result] of this.results) {
      report += `Test: ${name}\n`;
      report += `  Requests: ${result.successCount}/${result.totalRequests} successful\n`;
      report += `  Duration: ${Math.round(result.totalTime)}ms\n`;
      report += `  Response Time:\n`;
      report += `    Average: ${Math.round(result.averageTime)}ms\n`;
      report += `    Min: ${Math.round(result.minTime)}ms\n`;
      report += `    Max: ${Math.round(result.maxTime)}ms\n`;
      report += `    P95: ${Math.round(result.p95Time)}ms\n`;
      report += `    P99: ${Math.round(result.p99Time)}ms\n`;
      report += `  Throughput: ${Math.round(result.requestsPerSecond)} req/s\n`;

      if (result.errors.length > 0) {
        report += `  Errors (${result.errors.length}):\n`;
        result.errors.forEach((err) => {
          report += `    - ${err}\n`;
        });
      }

      report += '\n';
    }

    return report;
  }
}

export const loadTester = new LoadTester();

export default LoadTester;
