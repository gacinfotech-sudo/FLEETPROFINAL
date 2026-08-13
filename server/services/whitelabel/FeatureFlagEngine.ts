import { EventEmitter } from "events";

interface FeatureFlag {
  flagId: string;
  name: string;
  description: string;
  enabled: boolean;
  tenantIds?: string[]; // if undefined, applies to all tenants
  rolloutPercentage: number; // 0-100
  rolloutStages: Array<{
    percentage: number;
    startDate: Date;
    endDate?: Date;
  }>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface FlagEvaluation {
  flagId: string;
  tenantId: string;
  userId?: string;
  enabled: boolean;
  reason: "flag_disabled" | "not_in_rollout" | "enabled" | "tenant_excluded";
  rolloutPercentage: number;
}

interface FlagCache {
  flag: FeatureFlag;
  cachedAt: Date;
  ttl: number; // seconds
}

export class FeatureFlagEngine extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: Map<string, FlagCache> = new Map();
  private evaluationLog: FlagEvaluation[] = [];
  private cacheTTL: number = 60; // 60 seconds default

  /**
   * Create a new feature flag
   */
  createFlag(flag: Omit<FeatureFlag, "createdAt" | "updatedAt">): FeatureFlag {
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(flag.flagId, newFlag);
    this.cache.delete(flag.flagId); // Invalidate cache
    this.emit("flag-created", newFlag);

    return newFlag;
  }

  /**
   * Get flag by ID
   */
  getFlag(flagId: string): FeatureFlag | undefined {
    return this.flags.get(flagId);
  }

  /**
   * Enable flag
   */
  enableFlag(flagId: string): void {
    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    flag.enabled = true;
    flag.updatedAt = new Date();
    this.cache.delete(flagId);
    this.emit("flag-enabled", flag);
  }

  /**
   * Disable flag
   */
  disableFlag(flagId: string): void {
    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    flag.enabled = false;
    flag.updatedAt = new Date();
    this.cache.delete(flagId);
    this.emit("flag-disabled", flag);
  }

  /**
   * Set rollout percentage
   */
  setRolloutPercentage(flagId: string, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Percentage must be between 0 and 100");
    }

    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    flag.rolloutPercentage = percentage;
    flag.updatedAt = new Date();
    this.cache.delete(flagId);
    this.emit("rollout-updated", { flagId, percentage });
  }

  /**
   * Add rollout stage (gradual rollout)
   */
  addRolloutStage(flagId: string, percentage: number, startDate: Date, endDate?: Date): void {
    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    flag.rolloutStages.push({
      percentage,
      startDate,
      endDate,
    });

    flag.updatedAt = new Date();
    this.cache.delete(flagId);
    this.emit("stage-added", { flagId, percentage });
  }

  /**
   * Evaluate flag for tenant/user
   */
  evaluateFlag(
    flagId: string,
    tenantId: string,
    userId?: string
  ): FlagEvaluation {
    // Check cache first
    const cached = this.cache.get(flagId);
    if (cached && Date.now() - cached.cachedAt.getTime() < cached.ttl * 1000) {
      const flag = cached.flag;
      return this.evaluateFlagLogic(flag, tenantId, userId);
    }

    const flag = this.flags.get(flagId);
    if (!flag) {
      return {
        flagId,
        tenantId,
        userId,
        enabled: false,
        reason: "flag_disabled",
        rolloutPercentage: 0,
      };
    }

    // Cache the flag
    this.cache.set(flagId, {
      flag,
      cachedAt: new Date(),
      ttl: this.cacheTTL,
    });

    const evaluation = this.evaluateFlagLogic(flag, tenantId, userId);
    this.evaluationLog.push(evaluation);

    return evaluation;
  }

  /**
   * Evaluate flag logic
   */
  private evaluateFlagLogic(
    flag: FeatureFlag,
    tenantId: string,
    userId?: string
  ): FlagEvaluation {
    // Check if flag is enabled
    if (!flag.enabled) {
      return {
        flagId: flag.flagId,
        tenantId,
        userId,
        enabled: false,
        reason: "flag_disabled",
        rolloutPercentage: flag.rolloutPercentage,
      };
    }

    // Check if tenant is excluded
    if (flag.tenantIds && flag.tenantIds.length > 0) {
      if (!flag.tenantIds.includes(tenantId)) {
        return {
          flagId: flag.flagId,
          tenantId,
          userId,
          enabled: false,
          reason: "tenant_excluded",
          rolloutPercentage: flag.rolloutPercentage,
        };
      }
    }

    // Check current rollout stage
    const now = new Date();
    let currentPercentage = flag.rolloutPercentage;

    for (const stage of flag.rolloutStages) {
      if (now >= stage.startDate && (!stage.endDate || now <= stage.endDate)) {
        currentPercentage = stage.percentage;
        break;
      }
    }

    // Determine if user gets the flag based on rollout percentage
    const hash = this.hashUserId(userId || tenantId);
    const shouldEnable = (hash % 100) < currentPercentage;

    return {
      flagId: flag.flagId,
      tenantId,
      userId,
      enabled: shouldEnable,
      reason: shouldEnable ? "enabled" : "not_in_rollout",
      rolloutPercentage: currentPercentage,
    };
  }

  /**
   * Hash userId for consistent rollout
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Bulk evaluate flags
   */
  evaluateFlags(
    flagIds: string[],
    tenantId: string,
    userId?: string
  ): FlagEvaluation[] {
    return flagIds.map((flagId) =>
      this.evaluateFlag(flagId, tenantId, userId)
    );
  }

  /**
   * Hot reload flag cache
   */
  reloadCache(flagId: string): void {
    this.cache.delete(flagId);
    this.emit("cache-invalidated", { flagId });
  }

  /**
   * Reload all flags
   */
  reloadAllCaches(): void {
    this.cache.clear();
    this.emit("all-caches-invalidated");
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * List all flags
   */
  listFlags(tag?: string): FeatureFlag[] {
    let flags = Array.from(this.flags.values());
    if (tag) {
      flags = flags.filter((f) => f.tags.includes(tag));
    }
    return flags;
  }

  /**
   * Add tag to flag
   */
  addTag(flagId: string, tag: string): void {
    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    if (!flag.tags.includes(tag)) {
      flag.tags.push(tag);
      flag.updatedAt = new Date();
      this.cache.delete(flagId);
    }
  }

  /**
   * Remove tag from flag
   */
  removeTag(flagId: string, tag: string): void {
    const flag = this.flags.get(flagId);
    if (!flag) throw new Error("Flag not found");

    flag.tags = flag.tags.filter((t) => t !== tag);
    flag.updatedAt = new Date();
    this.cache.delete(flagId);
  }

  /**
   * Get evaluation log
   */
  getEvaluationLog(limit: number = 100): FlagEvaluation[] {
    return this.evaluationLog.slice(-limit);
  }

  /**
   * Get flag stats
   */
  getFlagStats(flagId: string): {
    enabled: number;
    disabled: number;
    total: number;
  } {
    const logs = this.evaluationLog.filter((e) => e.flagId === flagId);
    return {
      enabled: logs.filter((e) => e.enabled).length,
      disabled: logs.filter((e) => !e.enabled).length,
      total: logs.length,
    };
  }

  /**
   * Delete flag
   */
  deleteFlag(flagId: string): void {
    this.flags.delete(flagId);
    this.cache.delete(flagId);
    this.emit("flag-deleted", { flagId });
  }

  /**
   * Export flags as JSON
   */
  exportFlags(): string {
    const flags = Array.from(this.flags.values());
    return JSON.stringify(flags, null, 2);
  }

  /**
   * Import flags from JSON
   */
  importFlags(json: string): void {
    try {
      const flags: FeatureFlag[] = JSON.parse(json);
      flags.forEach((flag) => {
        flag.createdAt = new Date(flag.createdAt);
        flag.updatedAt = new Date(flag.updatedAt);
        flag.rolloutStages.forEach((stage) => {
          stage.startDate = new Date(stage.startDate);
          if (stage.endDate) {
            stage.endDate = new Date(stage.endDate);
          }
        });
        this.flags.set(flag.flagId, flag);
      });
      this.reloadAllCaches();
    } catch (error) {
      throw new Error("Invalid flags JSON");
    }
  }
}
