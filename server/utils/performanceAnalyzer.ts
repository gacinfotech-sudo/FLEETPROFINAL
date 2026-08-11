// Performance analysis and optimization recommendations
import { createLogger } from './logger';

const log = createLogger('PerformanceAnalyzer');

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'pass' | 'warn' | 'fail';
}

export interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetric[];
  recommendations: string[];
  overallScore: number;
  status: 'optimal' | 'acceptable' | 'needs-improvement' | 'critical';
}

export class PerformanceAnalyzer {
  private metrics: PerformanceMetric[] = [];

  analyzeResponseTime(time: number): PerformanceMetric {
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (time > 1000) status = 'fail';
    else if (time > 500) status = 'warn';

    return {
      name: 'Average Response Time',
      value: time,
      unit: 'ms',
      threshold: 200,
      status,
    };
  }

  analyzeMemoryUsage(used: number, limit: number): PerformanceMetric {
    const percent = (used / limit) * 100;
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (percent > 90) status = 'fail';
    else if (percent > 75) status = 'warn';

    return {
      name: 'Memory Usage',
      value: percent,
      unit: '%',
      threshold: 75,
      status,
    };
  }

  analyzeDatabaseQueryTime(time: number): PerformanceMetric {
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (time > 500) status = 'fail';
    else if (time > 200) status = 'warn';

    return {
      name: 'Database Query Time',
      value: time,
      unit: 'ms',
      threshold: 100,
      status,
    };
  }

  analyzeThroughput(requestsPerSecond: number): PerformanceMetric {
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (requestsPerSecond < 50) status = 'fail';
    else if (requestsPerSecond < 100) status = 'warn';

    return {
      name: 'Throughput',
      value: requestsPerSecond,
      unit: 'req/s',
      threshold: 100,
      status,
    };
  }

  analyzeErrorRate(errorCount: number, totalRequests: number): PerformanceMetric {
    const errorRate = (errorCount / totalRequests) * 100;
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (errorRate > 5) status = 'fail';
    else if (errorRate > 1) status = 'warn';

    return {
      name: 'Error Rate',
      value: errorRate,
      unit: '%',
      threshold: 1,
      status,
    };
  }

  generateReport(
    responseTime: number,
    memoryUsed: number,
    memoryLimit: number,
    queryTime: number,
    rps: number,
    errorCount: number,
    totalRequests: number
  ): PerformanceReport {
    this.metrics = [
      this.analyzeResponseTime(responseTime),
      this.analyzeMemoryUsage(memoryUsed, memoryLimit),
      this.analyzeDatabaseQueryTime(queryTime),
      this.analyzeThroughput(rps),
      this.analyzeErrorRate(errorCount, totalRequests),
    ];

    const recommendations = this.generateRecommendations();
    const overallScore = this.calculateScore();
    const status = this.determineStatus();

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      recommendations,
      overallScore,
      status,
    };

    log.info('Performance report generated', { status, score: overallScore });

    return report;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const failingMetrics = this.metrics.filter((m) => m.status === 'fail');
    const warningMetrics = this.metrics.filter((m) => m.status === 'warn');

    if (failingMetrics.some((m) => m.name.includes('Response Time'))) {
      recommendations.push('Optimize database queries - add indexes for slow queries');
      recommendations.push('Implement response caching for frequently accessed data');
      recommendations.push('Consider horizontal scaling with load balancing');
    }

    if (failingMetrics.some((m) => m.name.includes('Memory'))) {
      recommendations.push('Reduce memory footprint - check for memory leaks');
      recommendations.push('Implement garbage collection optimization');
      recommendations.push('Consider streaming for large data responses');
    }

    if (failingMetrics.some((m) => m.name.includes('Error Rate'))) {
      recommendations.push('Investigate error logs - identify root causes');
      recommendations.push('Implement circuit breakers for external dependencies');
      recommendations.push('Add retry logic with exponential backoff');
    }

    if (warningMetrics.length > 0) {
      recommendations.push('Monitor metrics closely - consider proactive optimization');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal - continue monitoring');
    }

    return recommendations;
  }

  private calculateScore(): number {
    if (this.metrics.length === 0) return 0;

    const passCount = this.metrics.filter((m) => m.status === 'pass').length;
    const warnCount = this.metrics.filter((m) => m.status === 'warn').length;
    const failCount = this.metrics.filter((m) => m.status === 'fail').length;

    return (passCount * 100 - warnCount * 30 - failCount * 100) / (this.metrics.length * 100);
  }

  private determineStatus(): 'optimal' | 'acceptable' | 'needs-improvement' | 'critical' {
    const failCount = this.metrics.filter((m) => m.status === 'fail').length;

    if (failCount > 0) return 'critical';
    if (this.calculateScore() < 50) return 'needs-improvement';
    if (this.calculateScore() < 80) return 'acceptable';
    return 'optimal';
  }

  formatReport(report: PerformanceReport): string {
    let formatted = '\n=== PERFORMANCE ANALYSIS REPORT ===\n\n';
    formatted += `Timestamp: ${report.timestamp}\n`;
    formatted += `Overall Status: ${report.status.toUpperCase()}\n`;
    formatted += `Performance Score: ${Math.round(report.overallScore * 100)}%\n\n`;

    formatted += 'Metrics:\n';
    report.metrics.forEach((metric) => {
      const status = metric.status === 'pass' ? '✅' : metric.status === 'warn' ? '⚠️' : '❌';
      formatted += `  ${status} ${metric.name}: ${Math.round(metric.value)}${metric.unit}\n`;
    });

    formatted += '\nRecommendations:\n';
    report.recommendations.forEach((rec) => {
      formatted += `  • ${rec}\n`;
    });

    return formatted;
  }
}

export const performanceAnalyzer = new PerformanceAnalyzer();

export default PerformanceAnalyzer;
