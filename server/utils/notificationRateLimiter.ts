// Notification Rate Limiting & Throttling
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationRateLimiter');

export enum RateLimitWindow {
  PER_MINUTE = 'minute',
  PER_HOUR = 'hour',
  PER_DAY = 'day',
}

export interface RateLimitPolicy {
  _id?: string;
  name: string;
  scope: 'global' | 'user' | 'category' | 'channel';
  window: RateLimitWindow;
  maxRequests: number; // How many notifications allowed
  cooldownSeconds?: number; // Seconds before bucket refills
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitBucket {
  _id?: string;
  policyId: string;
  scope: 'global' | 'user' | 'category' | 'channel';
  scopeId?: string; // userId, category, or channel if not global
  tokens: number; // Remaining tokens in bucket
  lastRefillTime: Date; // When bucket was last refilled
  createdAt: Date;
  expiresAt: Date; // Auto-cleanup after 24 hours
}

export interface RateLimitCheckResult {
  allowed: boolean;
  tokensRemaining: number;
  resetTime: Date;
  retryAfterSeconds?: number;
}

export interface RateLimitStats {
  blockedCount: number;
  allowedCount: number;
  blockRate: number; // percentage
  topBlockedUsers: Array<{ userId: string; count: number }>;
  topBlockedCategories: Array<{ category: string; count: number }>;
}

class NotificationRateLimiter {
  private isRunning = false;
  private cleanupInterval = 3600000; // Clean every hour

  private get db() {
    return mongoose.connection.db;
  }

  // Default policies
  private defaultPolicies: Omit<RateLimitPolicy, '_id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'global_per_hour',
      scope: 'global',
      window: RateLimitWindow.PER_HOUR,
      maxRequests: 10000,
      status: 'active'
    },
    {
      name: 'user_per_hour',
      scope: 'user',
      window: RateLimitWindow.PER_HOUR,
      maxRequests: 100,
      status: 'active'
    },
    {
      name: 'category_per_hour',
      scope: 'category',
      window: RateLimitWindow.PER_HOUR,
      maxRequests: 1000,
      status: 'active'
    },
    {
      name: 'user_per_minute',
      scope: 'user',
      window: RateLimitWindow.PER_MINUTE,
      maxRequests: 5,
      status: 'active'
    }
  ];

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Rate limiter already running');
      return;
    }

    this.isRunning = true;
    log.info('Notification rate limiter started');

    // Initialize default policies
    await this.initializeDefaultPolicies();

    // Cleanup expired buckets periodically
    setInterval(() => {
      this.cleanupExpiredBuckets();
    }, this.cleanupInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    log.info('Notification rate limiter stopped');
  }

  async createPolicy(policy: Omit<RateLimitPolicy, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notification_rate_limit_policies');

      const record: RateLimitPolicy = {
        ...policy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(record as any);

      log.info('Rate limit policy created', {
        id: result.insertedId,
        name: policy.name
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create rate limit policy', { error });
      throw error;
    }
  }

  async getPolicies(scope?: string, status?: string): Promise<RateLimitPolicy[]> {
    try {
      const collection = this.db.collection('notification_rate_limit_policies');

      const filter: any = {};
      if (scope) filter.scope = scope;
      if (status) filter.status = status;

      const policies = await collection
        .find(filter)
        .sort({ scope: 1, window: 1 })
        .toArray();

      return policies as RateLimitPolicy[];
    } catch (error) {
      log.error('Failed to get rate limit policies', { error });
      throw error;
    }
  }

  async checkRateLimit(
    userId: string,
    category: string,
    channel: string
  ): Promise<RateLimitCheckResult> {
    try {
      // Get all active policies
      const policies = await this.getPolicies(undefined, 'active');

      // Check each policy in order
      for (const policy of policies) {
        const result = await this.checkPolicy(policy, userId, category, channel);

        if (!result.allowed) {
          log.warn('Rate limit exceeded', {
            userId,
            category,
            channel,
            policy: policy.name
          });
          return result;
        }
      }

      // All checks passed
      return {
        allowed: true,
        tokensRemaining: -1, // Not applicable when all pass
        resetTime: new Date()
      };
    } catch (error) {
      log.error('Rate limit check failed', { userId, category, error });
      // On error, allow (fail open)
      return {
        allowed: true,
        tokensRemaining: -1,
        resetTime: new Date()
      };
    }
  }

  private async checkPolicy(
    policy: RateLimitPolicy,
    userId: string,
    category: string,
    channel: string
  ): Promise<RateLimitCheckResult> {
    const collection = this.db.collection('notification_rate_limit_buckets');

    // Determine scope ID
    let scopeId: string | undefined;
    if (policy.scope === 'user') {
      scopeId = userId;
    } else if (policy.scope === 'category') {
      scopeId = category;
    } else if (policy.scope === 'channel') {
      scopeId = channel;
    }

    // Get or create bucket
    const bucket = await collection.findOne({
      policyId: policy._id?.toString(),
      scopeId
    });

    const now = new Date();
    const windowMs = this.getWindowMs(policy.window);

    let tokens = policy.maxRequests;
    let lastRefillTime = now;

    if (bucket) {
      // Calculate elapsed time since last refill
      const elapsedMs = now.getTime() - bucket.lastRefillTime.getTime();
      const elapsedWindows = Math.floor(elapsedMs / windowMs);

      if (elapsedWindows > 0) {
        // Bucket has refilled, reset tokens
        tokens = policy.maxRequests;
        lastRefillTime = new Date(bucket.lastRefillTime.getTime() + elapsedWindows * windowMs);
      } else {
        // Still in same window, use current tokens
        tokens = bucket.tokens;
        lastRefillTime = bucket.lastRefillTime;
      }
    }

    // Check if we have tokens
    if (tokens <= 0) {
      const resetTime = new Date(lastRefillTime.getTime() + windowMs);
      const retryAfterSeconds = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);

      // Record blocked request
      await this.recordBlockedRequest(userId, category);

      return {
        allowed: false,
        tokensRemaining: 0,
        resetTime,
        retryAfterSeconds
      };
    }

    // Consume one token
    tokens--;

    // Update or create bucket
    const expiresAt = new Date(lastRefillTime.getTime() + windowMs + 86400000); // +24h for TTL

    if (bucket) {
      await collection.updateOne(
        { _id: bucket._id },
        {
          $set: {
            tokens,
            lastRefillTime,
            expiresAt
          }
        }
      );
    } else {
      await collection.insertOne({
        policyId: policy._id?.toString(),
        scope: policy.scope,
        scopeId,
        tokens,
        lastRefillTime,
        createdAt: new Date(),
        expiresAt
      } as any);
    }

    return {
      allowed: true,
      tokensRemaining: tokens,
      resetTime: new Date(lastRefillTime.getTime() + windowMs)
    };
  }

  async getRateLimitStats(): Promise<RateLimitStats> {
    try {
      const collection = this.db.collection('notification_rate_limit_blocks');

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86400000);

      const totalBlocked = await collection.countDocuments({
        blockedAt: { $gte: oneDayAgo }
      });

      const totalAllowed = await this.getTotalAllowedCount();

      const topBlockedUsers = await collection
        .aggregate([
          {
            $match: { blockedAt: { $gte: oneDayAgo } }
          },
          {
            $group: {
              _id: '$userId',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
        .toArray();

      const topBlockedCategories = await collection
        .aggregate([
          {
            $match: { blockedAt: { $gte: oneDayAgo } }
          },
          {
            $group: {
              _id: '$category',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
        .toArray();

      const totalRequests = totalBlocked + totalAllowed;
      const blockRate = totalRequests > 0 ? (totalBlocked / totalRequests) * 100 : 0;

      return {
        blockedCount: totalBlocked,
        allowedCount: totalAllowed,
        blockRate: Math.round(blockRate * 100) / 100,
        topBlockedUsers: topBlockedUsers.map(doc => ({
          userId: doc._id,
          count: doc.count
        })),
        topBlockedCategories: topBlockedCategories.map(doc => ({
          category: doc._id,
          count: doc.count
        }))
      };
    } catch (error) {
      log.error('Failed to get rate limit stats', { error });
      throw error;
    }
  }

  private async recordBlockedRequest(userId: string, category: string): Promise<void> {
    try {
      const collection = this.db.collection('notification_rate_limit_blocks');

      await collection.insertOne({
        userId,
        category,
        blockedAt: new Date()
      } as any);
    } catch (error) {
      log.error('Failed to record blocked request', { error });
    }
  }

  private async getTotalAllowedCount(): Promise<number> {
    try {
      // Estimate based on successful notifications from analytics
      const analyticsCollection = this.db.collection('notification_logs');
      const oneDayAgo = new Date(Date.now() - 86400000);

      const count = await analyticsCollection.countDocuments({
        status: 'sent',
        sentAt: { $gte: oneDayAgo }
      });

      return count;
    } catch (error) {
      return 0;
    }
  }

  private async cleanupExpiredBuckets(): Promise<void> {
    try {
      const collection = this.db.collection('notification_rate_limit_buckets');
      const now = new Date();

      const result = await collection.deleteMany({
        expiresAt: { $lt: now }
      });

      if (result.deletedCount > 0) {
        log.info('Cleaned up expired rate limit buckets', { deleted: result.deletedCount });
      }
    } catch (error) {
      log.error('Failed to cleanup expired buckets', { error });
    }
  }

  private async initializeDefaultPolicies(): Promise<void> {
    try {
      if (!this.db) {
        log.warn('Database not initialized yet, skipping default policies initialization');
        return;
      }

      const collection = this.db.collection('notification_rate_limit_policies');

      // Check if default policies exist
      const count = await collection.countDocuments();

      if (count === 0) {
        log.info('Initializing default rate limit policies');

        const policies = this.defaultPolicies.map(p => ({
          ...p,
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await collection.insertMany(policies as any);

        log.info(`Created ${policies.length} default rate limit policies`);
      }
    } catch (error) {
      log.error('Failed to initialize default policies', { error });
    }
  }

  private getWindowMs(window: RateLimitWindow): number {
    switch (window) {
      case RateLimitWindow.PER_MINUTE:
        return 60000; // 60 seconds
      case RateLimitWindow.PER_HOUR:
        return 3600000; // 1 hour
      case RateLimitWindow.PER_DAY:
        return 86400000; // 24 hours
      default:
        return 3600000;
    }
  }
}

export const notificationRateLimiter = new NotificationRateLimiter();
