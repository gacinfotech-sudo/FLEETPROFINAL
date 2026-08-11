/**
 * CacheLayer
 * Multi-level caching strategy (memory + Redis) for provider responses
 * Implements LRU eviction, TTL-based expiration, stampede prevention
 * Cache warming and automatic invalidation strategies
 */

import { createLogger } from '../../utils/logger';

/**
 * Cache entry interface
 */
interface CacheEntry<T = any> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessAt: Date;
  ttl: number; // milliseconds
}

/**
 * Cache tier type
 */
type CacheTier = 'memory' | 'redis' | 'both';

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hitRate: number; // percentage
  missRate: number; // percentage
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  memorySize: number;
  redisSize: number;
  averageAccessTime: number; // milliseconds
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  tier?: CacheTier; // Default: 'memory'
  maxMemorySize?: number; // Default: 100MB
  maxRedisSize?: number; // Default: 1GB
  defaultTTL?: number; // Default: 5 minutes
  maxEntriesMemory?: number; // Default: 10000
  maxEntriesRedis?: number; // Default: 100000
  enableStampedeProtection?: boolean; // Default: true
  enableWarmup?: boolean; // Default: true
  compressionEnabled?: boolean; // Default: false
  redisClient?: any; // Redis client instance
}

/**
 * Cache stampede lock
 */
interface StampedeLock {
  key: string;
  lockedAt: Date;
  expiresAt: Date;
  acquiring: Promise<any>;
}

/**
 * CacheLayer
 * Multi-level caching system with memory and Redis tiers
 */
export class CacheLayer {
  private logger: any;
  private config: Required<CacheConfig>;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redisClient: any;
  private stampedeLocks: Map<string, StampedeLock> = new Map();
  private statistics: {
    hits: number;
    misses: number;
    evictions: number;
    totalAccessTime: number;
    accessCount: number;
  } = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };

  constructor(config: CacheConfig = {}) {
    this.logger = createLogger('CacheLayer');
    this.config = this.normalizeConfig(config);
    this.redisClient = config.redisClient || null;
  }

  /**
   * Normalize and validate configuration
   */
  private normalizeConfig(config: CacheConfig): Required<CacheConfig> {
    return {
      tier: config.tier ?? 'memory',
      maxMemorySize: config.maxMemorySize ?? 100 * 1024 * 1024,
      maxRedisSize: config.maxRedisSize ?? 1024 * 1024 * 1024,
      defaultTTL: config.defaultTTL ?? 5 * 60 * 1000,
      maxEntriesMemory: config.maxEntriesMemory ?? 10000,
      maxEntriesRedis: config.maxEntriesRedis ?? 100000,
      enableStampedeProtection: config.enableStampedeProtection ?? true,
      enableWarmup: config.enableWarmup ?? true,
      compressionEnabled: config.compressionEnabled ?? false,
      redisClient: config.redisClient ?? null,
    };
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && !this.isExpired(memoryEntry)) {
        this.recordHit();
        this.updateAccessTime(memoryEntry);
        return memoryEntry.value as T;
      }

      // Try Redis if configured
      if (this.config.tier === 'both' || this.config.tier === 'redis') {
        if (this.redisClient) {
          try {
            const redisValue = await this.redisClient.get(key);
            if (redisValue) {
              this.recordHit();
              const value = JSON.parse(redisValue);
              // Populate memory cache
              this.memoryCache.set(key, {
                key,
                value,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + this.config.defaultTTL),
                accessCount: 1,
                lastAccessAt: new Date(),
                ttl: this.config.defaultTTL,
              });
              return value as T;
            }
          } catch (error) {
            this.logger.warn('Redis get error', error as Error);
          }
        }
      }

      this.recordMiss();
      return null;
    } finally {
      const elapsed = Date.now() - startTime;
      this.statistics.totalAccessTime += elapsed;
      this.statistics.accessCount++;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl?: number,
  ): Promise<void> {
    const effectiveTTL = ttl || this.config.defaultTTL;
    const expiresAt = new Date(Date.now() + effectiveTTL);

    // Create cache entry
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(),
      expiresAt,
      accessCount: 0,
      lastAccessAt: new Date(),
      ttl: effectiveTTL,
    };

    // Store in memory cache
    if (this.config.tier === 'memory' || this.config.tier === 'both') {
      this.memoryCache.set(key, entry as CacheEntry);
      this.enforceMemoryLimit();
    }

    // Store in Redis if configured
    if (
      this.config.tier === 'both' ||
      this.config.tier === 'redis'
    ) {
      if (this.redisClient) {
        try {
          const serialized = JSON.stringify(value);
          const ttlSeconds = Math.ceil(effectiveTTL / 1000);
          await this.redisClient.setex(key, ttlSeconds, serialized);
        } catch (error) {
          this.logger.warn('Redis set error', error as Error);
        }
      }
    }

    this.logger.debug('Cache set', {
      key,
      ttl: effectiveTTL,
      tier: this.config.tier,
    });
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        this.logger.warn('Redis delete error', error as Error);
      }
    }

    this.logger.debug('Cache invalidated', { key });
  }

  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate in memory cache
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    const entries = Array.from(this.memoryCache.entries());
    for (const [key] of entries) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.memoryCache.delete(key));

    // Invalidate in Redis
    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (error) {
        this.logger.warn('Redis pattern delete error', error as Error);
      }
    }

    this.logger.debug('Cache pattern invalidated', {
      pattern,
      deletedCount: keysToDelete.length,
    });
  }

  /**
   * Get with fallback (cache stampede protection)
   */
  async getOrFetch<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached) {
      return cached;
    }

    // Check for existing stampede lock
    if (this.config.enableStampedeProtection) {
      const lock = this.stampedeLocks.get(key);
      if (lock && !this.isExpired({ expiresAt: lock.expiresAt } as CacheEntry)) {
        // Wait for the lock to be released
        return lock.acquiring as Promise<T>;
      }
    }

    // Create stampede lock
    let releaseLock: (() => void) | null = null;
    const lockPromise = (async () => {
      try {
        const value = await fetcher();
        await this.set(key, value, ttl);
        return value;
      } finally {
        if (releaseLock) {
          releaseLock();
        }
      }
    })();

    if (this.config.enableStampedeProtection) {
      const lock: StampedeLock = {
        key,
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 30000), // 30 second lock timeout
        acquiring: lockPromise,
      };
      this.stampedeLocks.set(key, lock);

      releaseLock = () => {
        this.stampedeLocks.delete(key);
      };
    }

    return lockPromise;
  }

  /**
   * Warm cache with preloaded values
   */
  async warmCache<T = any>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void> {
    if (!this.config.enableWarmup) {
      return;
    }

    this.logger.info('Warming cache', { entryCount: entries.length });

    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(): void {
    this.statistics.hits++;
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.statistics.misses++;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return new Date() > entry.expiresAt;
  }

  /**
   * Update access time
   */
  private updateAccessTime(entry: CacheEntry): void {
    entry.lastAccessAt = new Date();
    entry.accessCount++;
  }

  /**
   * Enforce memory limit (LRU eviction)
   */
  private enforceMemoryLimit(): void {
    if (this.memoryCache.size > this.config.maxEntriesMemory) {
      // Sort by access time and remove least recently used
      const entries = Array.from(this.memoryCache.values());
      entries.sort((a, b) => a.lastAccessAt.getTime() - b.lastAccessAt.getTime());

      const toRemove =
        this.memoryCache.size - this.config.maxEntriesMemory + 1;
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.memoryCache.delete(entries[i].key);
        this.statistics.evictions++;
      }

      this.logger.warn('Memory cache limit enforced', {
        evicted: toRemove,
        remaining: this.memoryCache.size,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    const totalRequests =
      this.statistics.hits + this.statistics.misses;
    const hitRate =
      totalRequests > 0
        ? (this.statistics.hits / totalRequests) * 100
        : 0;

    return {
      hitRate,
      missRate: 100 - hitRate,
      totalHits: this.statistics.hits,
      totalMisses: this.statistics.misses,
      totalEvictions: this.statistics.evictions,
      memorySize: this.memoryCache.size,
      redisSize: this.redisClient ? 0 : 0, // Would need Redis stats
      averageAccessTime:
        this.statistics.accessCount > 0
          ? this.statistics.totalAccessTime /
            this.statistics.accessCount
          : 0,
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.stampedeLocks.clear();

    if (this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (error) {
        this.logger.warn('Redis flush error', error as Error);
      }
    }

    this.logger.info('Cache cleared');
  }

  /**
   * Get cache entry count
   */
  getSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Get memory cache entries
   */
  getMemoryCacheEntries(): CacheEntry[] {
    return Array.from(this.memoryCache.values());
  }
}

export default CacheLayer;
