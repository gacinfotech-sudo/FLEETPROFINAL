export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricsSummary {
  requestsTotal: number;
  requestsPerSecond: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  uptime: number;
}

export class MetricsCollector {
  private metrics: Metric[] = [];
  private responseTimes: number[] = [];
  private errorCount = 0;
  private totalRequests = 0;
  private startTime = Date.now();
  private maxMetrics = 10000;

  recordRequest(duration: number, success: boolean) {
    this.totalRequests++;
    this.responseTimes.push(duration);

    if (!success) {
      this.errorCount++;
    }

    if (this.responseTimes.length > this.maxMetrics) {
      this.responseTimes.shift();
    }
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      labels
    });

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getMetrics(): MetricsSummary {
    const uptime = Date.now() - this.startTime;
    const seconds = uptime / 1000;

    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95 = sortedTimes[Math.ceil(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.ceil(sortedTimes.length * 0.99)] || 0;
    const avgTime = sortedTimes.length ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length : 0;

    return {
      requestsTotal: this.totalRequests,
      requestsPerSecond: Math.round((this.totalRequests / seconds) * 100) / 100,
      errorCount: this.errorCount,
      errorRate: this.totalRequests ? (this.errorCount / this.totalRequests) * 100 : 0,
      avgResponseTime: Math.round(avgTime),
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      uptime
    };
  }

  reset() {
    this.metrics = [];
    this.responseTimes = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    this.startTime = Date.now();
  }
}
