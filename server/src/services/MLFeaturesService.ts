// ============================================================================
// ML FEATURES SERVICE - Feature store and feature engineering
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  Feature,
  FeatureVersion,
  FeatureMonitoring,
  OfflineFeatureRequest,
  OnlineFeatureRequest,
  FeatureDiscoveryRecommendation,
} from '../types/ai-ml.types';

/**
 * MLFeaturesService: Feature store management and engineering
 * - Feature store management
 * - Feature versioning
 * - Feature importance tracking
 * - Feature monitoring (data drift, missing values)
 * - Offline/online feature serving
 * - Feature engineering automation
 * - Feature discovery recommendations
 */
export class MLFeaturesService {
  private featureStore: Map<string, Feature> = new Map();
  private featureVersions: Map<string, FeatureVersion[]> = new Map();
  private featureMonitoring: FeatureMonitoring[] = [];
  private offlineFeatureCache: Map<string, any> = new Map();
  private onlineFeatureCache: Map<string, any> = new Map();

  constructor() {
    this.initializeService();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeService(): void {
    console.log('[MLFeaturesService] Service initialized');
    this.initializeSampleFeatures();
  }

  private initializeSampleFeatures(): void {
    // Sample features for common use cases
    const sampleFeatures: Feature[] = [
      {
        id: 'feature_user_tenure',
        name: 'User Tenure',
        description: 'Days since user account creation',
        featureStore: 'user_features',
        version: '1.0',
        dataType: 'numeric',
        importance: 0.85,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'feature_login_frequency',
        name: 'Login Frequency',
        description: 'Average logins per week',
        featureStore: 'engagement_features',
        version: '1.0',
        dataType: 'numeric',
        importance: 0.88,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'feature_subscription_tier',
        name: 'Subscription Tier',
        description: 'User subscription level',
        featureStore: 'billing_features',
        version: '1.0',
        dataType: 'categorical',
        importance: 0.92,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'feature_feature_usage',
        name: 'Feature Usage Count',
        description: 'Number of platform features used',
        featureStore: 'engagement_features',
        version: '1.0',
        dataType: 'numeric',
        importance: 0.89,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'feature_api_calls',
        name: 'API Call Volume',
        description: 'Monthly API calls',
        featureStore: 'usage_features',
        version: '1.0',
        dataType: 'numeric',
        importance: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    sampleFeatures.forEach(feature => {
      this.featureStore.set(feature.id, feature);
      this.featureVersions.set(feature.id, [
        {
          featureId: feature.id,
          version: '1.0',
          changes: ['Initial version'],
          createdAt: new Date(),
          validFrom: new Date(),
        },
      ]);
    });
  }

  // ========================================================================
  // FEATURE MANAGEMENT
  // ========================================================================

  /**
   * Create a new feature
   */
  async createFeature(
    name: string,
    description: string | undefined,
    featureStore: string,
    dataType: 'numeric' | 'categorical' | 'text' | 'datetime'
  ): Promise<Feature> {
    const featureId = this.generateFeatureId();

    const feature: Feature = {
      id: featureId,
      name,
      description,
      featureStore,
      version: '1.0',
      dataType,
      importance: 0.5, // Initial importance
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.featureStore.set(featureId, feature);

    // Initialize version history
    this.featureVersions.set(featureId, [
      {
        featureId,
        version: '1.0',
        changes: ['Feature created'],
        createdAt: new Date(),
        validFrom: new Date(),
      },
    ]);

    return feature;
  }

  /**
   * Get feature by ID
   */
  async getFeature(featureId: string): Promise<Feature | null> {
    return this.featureStore.get(featureId) || null;
  }

  /**
   * List all features
   */
  async listFeatures(): Promise<Feature[]> {
    return Array.from(this.featureStore.values());
  }

  /**
   * Update feature metadata
   */
  async updateFeature(
    featureId: string,
    updates: Partial<Feature>
  ): Promise<Feature | null> {
    const feature = this.featureStore.get(featureId);
    if (!feature) return null;

    const updatedFeature: Feature = {
      ...feature,
      ...updates,
      updatedAt: new Date(),
    };

    this.featureStore.set(featureId, updatedFeature);
    return updatedFeature;
  }

  /**
   * Delete feature
   */
  async deleteFeature(featureId: string): Promise<boolean> {
    return this.featureStore.delete(featureId);
  }

  // ========================================================================
  // FEATURE VERSIONING
  // ========================================================================

  /**
   * Create new feature version
   */
  async createFeatureVersion(
    featureId: string,
    changes: string[]
  ): Promise<FeatureVersion | null> {
    const feature = this.featureStore.get(featureId);
    if (!feature) return null;

    const versions = this.featureVersions.get(featureId) || [];
    const lastVersion = versions[versions.length - 1];
    const versionNumber = lastVersion ? this.incrementVersion(lastVersion.version) : '1.0';

    const newVersion: FeatureVersion = {
      featureId,
      version: versionNumber,
      changes,
      createdAt: new Date(),
      validFrom: new Date(),
    };

    versions.push(newVersion);
    this.featureVersions.set(featureId, versions);

    // Update feature version
    feature.version = versionNumber;
    feature.updatedAt = new Date();

    return newVersion;
  }

  /**
   * Get feature version history
   */
  async getFeatureVersionHistory(featureId: string): Promise<FeatureVersion[]> {
    return this.featureVersions.get(featureId) || [];
  }

  /**
   * Restore feature to previous version
   */
  async restoreFeatureVersion(featureId: string, version: string): Promise<Feature | null> {
    const versions = this.featureVersions.get(featureId);
    if (!versions) return null;

    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) return null;

    const feature = this.featureStore.get(featureId);
    if (!feature) return null;

    feature.version = version;
    feature.updatedAt = new Date();

    return feature;
  }

  /**
   * Increment version number
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    parts[parts.length - 1] = String(parseInt(parts[parts.length - 1], 10) + 1);
    return parts.join('.');
  }

  // ========================================================================
  // FEATURE IMPORTANCE
  // ========================================================================

  /**
   * Update feature importance score
   */
  async updateFeatureImportance(featureId: string, importance: number): Promise<Feature | null> {
    const feature = this.featureStore.get(featureId);
    if (!feature) return null;

    feature.importance = Math.min(1, Math.max(0, importance));
    feature.updatedAt = new Date();

    return feature;
  }

  /**
   * Get top features by importance
   */
  async getTopFeatures(limit: number = 10): Promise<Feature[]> {
    return Array.from(this.featureStore.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  // ========================================================================
  // FEATURE MONITORING
  // ========================================================================

  /**
   * Monitor feature for data drift and quality issues
   */
  async monitorFeature(
    featureId: string,
    values: number[]
  ): Promise<FeatureMonitoring> {
    if (values.length === 0) {
      throw new Error('Cannot monitor feature without values');
    }

    const monitoring: FeatureMonitoring = {
      featureId,
      monitoringDate: new Date(),
      dataDriftDetected: this.detectDataDrift(values),
      driftScore: this.calculateDriftScore(values),
      missingValues: this.countMissingValues(values),
      nullRate: this.calculateNullRate(values),
      distribution: this.calculateDistribution(values),
      anomalyDetected: this.detectAnomalies(values),
    };

    this.featureMonitoring.push(monitoring);
    return monitoring;
  }

  /**
   * Detect data drift in feature values
   */
  private detectDataDrift(values: number[]): boolean {
    if (values.length < 2) return false;

    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Check if more than 20% of values are outliers (> 3 std devs)
    const outliers = values.filter(v => Math.abs(v - mean) > 3 * stdDev).length;
    return (outliers / values.length) > 0.2;
  }

  /**
   * Calculate drift score (0-1)
   */
  private calculateDriftScore(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const outlierCount = values.filter(v => Math.abs(v - mean) > 3 * stdDev).length;
    return Math.min(1, outlierCount / values.length);
  }

  /**
   * Count missing/null values
   */
  private countMissingValues(values: number[]): number {
    return values.filter(v => v === null || v === undefined || isNaN(v)).length;
  }

  /**
   * Calculate null rate
   */
  private calculateNullRate(values: number[]): number {
    return this.countMissingValues(values) / values.length;
  }

  /**
   * Calculate value distribution
   */
  private calculateDistribution(values: number[]): Record<string, number> {
    const dist: Record<string, number> = {
      min: Math.min(...values.filter(v => !isNaN(v))),
      max: Math.max(...values.filter(v => !isNaN(v))),
      mean: values.filter(v => !isNaN(v)).reduce((a, b) => a + b, 0) / values.filter(v => !isNaN(v)).length,
      median: this.calculateMedian(values.filter(v => !isNaN(v))),
      q1: this.calculatePercentile(values.filter(v => !isNaN(v)), 0.25),
      q3: this.calculatePercentile(values.filter(v => !isNaN(v)), 0.75),
    };

    return dist;
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Detect anomalies in feature values
   */
  private detectAnomalies(values: number[]): boolean {
    if (values.length < 3) return false;

    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Flag if any value is > 5 std devs away
    return values.some(v => Math.abs(v - mean) > 5 * stdDev);
  }

  /**
   * Get monitoring history for feature
   */
  async getFeatureMonitoringHistory(featureId: string, limit: number = 30): Promise<FeatureMonitoring[]> {
    return this.featureMonitoring
      .filter(m => m.featureId === featureId)
      .slice(-limit);
  }

  // ========================================================================
  // FEATURE SERVING
  // ========================================================================

  /**
   * Get features offline (batch)
   */
  async getOfflineFeatures(request: OfflineFeatureRequest): Promise<Map<string, any>> {
    const cacheKey = JSON.stringify(request);
    const cached = this.offlineFeatureCache.get(cacheKey);

    if (cached && cached.timestamp > Date.now() - 60 * 60 * 1000) {
      return cached.data;
    }

    const features = new Map<string, any>();

    for (const entityId of request.entityIds) {
      for (const featureId of request.featureIds) {
        // In production, would fetch from data warehouse
        features.set(`${entityId}_${featureId}`, Math.random() * 100);
      }
    }

    this.offlineFeatureCache.set(cacheKey, {
      data: features,
      timestamp: Date.now(),
    });

    return features;
  }

  /**
   * Get features online (real-time)
   */
  async getOnlineFeatures(request: OnlineFeatureRequest): Promise<Map<string, any>> {
    const cacheKey = `${request.entityId}_${request.featureIds.join('_')}`;
    const cached = this.onlineFeatureCache.get(cacheKey);

    if (cached && cached.timestamp > Date.now() - 5 * 60 * 1000) {
      return cached.data;
    }

    const features = new Map<string, any>();

    for (const featureId of request.featureIds) {
      // In production, would fetch from real-time feature server
      features.set(featureId, Math.random() * 100);
    }

    this.onlineFeatureCache.set(cacheKey, {
      data: features,
      timestamp: Date.now(),
    });

    return features;
  }

  // ========================================================================
  // FEATURE DISCOVERY
  // ========================================================================

  /**
   * Get feature discovery recommendations
   */
  async getFeatureRecommendations(): Promise<FeatureDiscoveryRecommendation[]> {
    const recommendations: FeatureDiscoveryRecommendation[] = [
      {
        suggestedFeature: 'User Device Type',
        useCase: 'Platform performance analysis by device',
        expectedImpact: 'High - helps identify device-specific issues',
        difficulty: 'easy',
        estimatedEffort: 2,
      },
      {
        suggestedFeature: 'Geographic Location',
        useCase: 'Regional performance and compliance analysis',
        expectedImpact: 'High - improves regional targeting',
        difficulty: 'easy',
        estimatedEffort: 3,
      },
      {
        suggestedFeature: 'Time-based Patterns',
        useCase: 'Seasonal trends and peak usage prediction',
        expectedImpact: 'Medium - helps with capacity planning',
        difficulty: 'medium',
        estimatedEffort: 5,
      },
      {
        suggestedFeature: 'Interaction Sequences',
        useCase: 'User journey analysis and drop-off detection',
        expectedImpact: 'High - identifies conversion bottlenecks',
        difficulty: 'hard',
        estimatedEffort: 12,
      },
      {
        suggestedFeature: 'Error Frequency',
        useCase: 'System health monitoring and SLA tracking',
        expectedImpact: 'Medium - improves reliability insights',
        difficulty: 'easy',
        estimatedEffort: 4,
      },
    ];

    return recommendations;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateFeatureId(): string {
    return `feat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const mlFeaturesService = new MLFeaturesService();
