// STEP 42: Caching Layer Service
// Redis-based caching for performance

import NodeCache from 'node-cache';

interface CacheEntry {
  data: any;
  expiry: number;
  hits: number;
}

export class CacheService {
  private cache: NodeCache;
  private stats: Map<string, CacheEntry> = new Map();

  constructor() {
    // In-memory cache (can be replaced with Redis in production)
    // TTL: 5 min std, 10 min for lists, 1 hour for analytics
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
  }

  // Set cache value
  set(key: string, value: any, ttl: number = 600) {
    this.cache.set(key, value, ttl);
    this.stats.set(key, {
      data: value,
      expiry: Date.now() + ttl * 1000,
      hits: 0
    });
    console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
  }

  // Get cache value
  get(key: string) {
    const value = this.cache.get(key);
    if (value) {
      const stat = this.stats.get(key);
      if (stat) stat.hits++;
      console.log(`✅ Cache HIT: ${key}`);
    } else {
      console.log(`❌ Cache MISS: ${key}`);
    }
    return value;
  }

  // Check if key exists
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // Delete cache value
  delete(key: string) {
    this.cache.del(key);
    this.stats.delete(key);
    console.log(`🗑️ Cache DELETE: ${key}`);
  }

  // Clear all cache
  clear() {
    this.cache.flushAll();
    this.stats.clear();
    console.log('🧹 Cache cleared');
  }

  // Dashboard KPIs cache (5 min TTL)
  cacheKPIs(kpis: any) {
    this.set('dashboard:kpis', kpis, 300);
  }

  getKPIs() {
    return this.get('dashboard:kpis');
  }

  // Analytics cache (1 hour TTL)
  cacheMRR(mrr: any) {
    this.set('analytics:mrr', mrr, 3600);
  }

  getMRR() {
    return this.get('analytics:mrr');
  }

  cacheARR(arr: any) {
    this.set('analytics:arr', arr, 3600);
  }

  getARR() {
    return this.get('analytics:arr');
  }

  // Tenant list cache (10 min TTL)
  cacheTenants(page: number, tenants: any) {
    this.set(`tenants:page:${page}`, tenants, 600);
  }

  getTenants(page: number) {
    return this.get(`tenants:page:${page}`);
  }

  // SLA summary cache (5 min TTL)
  cacheSLASummary(summary: any) {
    this.set('sla:summary', summary, 300);
  }

  getSLASummary() {
    return this.get('sla:summary');
  }

  // Invalidate related caches
  invalidateTenantCache(tenantId: string) {
    // Invalidate tenant-specific caches
    this.delete(`tenant:${tenantId}:dashboard`);
    this.delete(`tenant:${tenantId}:invoices`);
    this.delete(`tenant:${tenantId}:tickets`);
    console.log(`🔄 Invalidated cache for tenant ${tenantId}`);
  }

  invalidatePlatformCache() {
    // Invalidate platform-wide caches
    this.delete('dashboard:kpis');
    this.delete('analytics:mrr');
    this.delete('analytics:arr');
    this.delete('sla:summary');
    // Clear all tenant list pages
    for (let i = 1; i <= 100; i++) {
      this.delete(`tenants:page:${i}`);
    }
    console.log('🔄 Invalidated all platform cache');
  }

  // Get cache statistics
  getStats() {
    const stats = Array.from(this.stats.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      expiry: new Date(entry.expiry),
      size: JSON.stringify(entry.data).length
    }));

    return {
      total: stats.length,
      totalSize: stats.reduce((sum, s) => sum + s.size, 0),
      hitRate: stats.length > 0 ?
        (stats.reduce((sum, s) => sum + s.hits, 0) / stats.length / 10).toFixed(2) + '%' : '0%',
      entries: stats.sort((a, b) => b.hits - a.hits).slice(0, 10)
    };
  }
}

export const cacheService = new CacheService();
