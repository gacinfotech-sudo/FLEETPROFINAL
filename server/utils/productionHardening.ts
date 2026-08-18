// Production Hardening - Security + Performance + Observability
import { createLogger } from './logger';
import crypto from 'crypto';

const log = createLogger('ProductionHardening');

// ============ SECURITY ============

export class WebhookSecurity {
  static generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  static validateIpWhitelist(ip: string, whitelist: string[]): boolean {
    return whitelist.includes(ip) || whitelist.includes('*');
  }
}

// ============ PERFORMANCE ============

export class CacheManager {
  private cache = new Map<string, { value: any; expiry: number }>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; memory: string } {
    return {
      size: this.cache.size,
      memory: `${(this.cache.size * 100).toFixed(2)} bytes` // Rough estimate
    };
  }
}

// ============ RATE LIMITING ============

export class RateLimiter {
  private counters = new Map<string, number[]>();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests: number;

  constructor(maxRequests: number = 100) {
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.counters.has(key)) {
      this.counters.set(key, [now]);
      return true;
    }

    const timestamps = this.counters.get(key)!;
    const recentRequests = timestamps.filter(ts => ts > windowStart);

    if (recentRequests.length < this.maxRequests) {
      recentRequests.push(now);
      this.counters.set(key, recentRequests);
      return true;
    }

    return false;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.counters.get(key) || [];
    const recentRequests = timestamps.filter(ts => ts > windowStart);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  resetKey(key: string): void {
    this.counters.delete(key);
  }
}

// ============ OBSERVABILITY ============

export interface Metrics {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export class MetricsCollector {
  private metrics: Metrics[] = [];
  private readonly maxMetrics = 10000;

  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: new Date(),
      tags
    });

    // Keep memory in check
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(this.metrics.length - this.maxMetrics);
    }

    log.debug(`Metric recorded: ${name} = ${value}`);
  }

  getMetrics(name: string, lastN: number = 100): Metrics[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(-lastN);
  }

  getPrometheusFormat(): string {
    const byName = new Map<string, number>();

    for (const metric of this.metrics) {
      const sum = byName.get(metric.name) || 0;
      byName.set(metric.name, sum + metric.value);
    }

    let output = '';
    for (const [name, value] of byName.entries()) {
      output += `# TYPE fleetpro_${name} gauge\n`;
      output += `fleetpro_${name} ${value}\n`;
    }

    return output;
  }

  stats(): { total: number; byName: Record<string, number> } {
    const byName: Record<string, number> = {};

    for (const metric of this.metrics) {
      byName[metric.name] = (byName[metric.name] || 0) + 1;
    }

    return {
      total: this.metrics.length,
      byName
    };
  }
}

// Singleton instances
export const cacheManager = new CacheManager();
export const rateLimiter = new RateLimiter(100); // 100 requests per minute
export const metricsCollector = new MetricsCollector();

log.info('Production hardening initialized');
