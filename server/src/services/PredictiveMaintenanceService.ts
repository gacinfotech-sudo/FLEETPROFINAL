// ============================================================================
// PREDICTIVE MAINTENANCE SERVICE - Asset health & failure prediction
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  AssetHealthScore,
  FailurePrediction,
  MaintenanceWindow,
  PartsForecast,
  AssetType,
  HealthFactor,
} from '../types/ai-ml.types';

/**
 * PredictiveMaintenanceService: Predictive maintenance analytics
 * - Asset health scoring (0-100)
 * - Failure probability prediction
 * - Maintenance window optimization
 * - Parts requirement forecasting
 * - Maintenance cost estimation
 * - Downtime risk assessment
 */
export class PredictiveMaintenanceService {
  private assetHealthScores: Map<string, AssetHealthScore> = new Map();
  private failurePredictions: Map<string, FailurePrediction> = new Map();
  private maintenanceHistory: Map<string, any[]> = new Map();
  private maintenanceWindows: MaintenanceWindow[] = [];
  private partsForecast: PartsForecast[] = [];

  constructor() {
    this.initializeService();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeService(): void {
    console.log('[PredictiveMaintenanceService] Service initialized');
  }

  // ========================================================================
  // ASSET HEALTH SCORING
  // ========================================================================

  /**
   * Calculate asset health score (0-100)
   */
  async calculateAssetHealthScore(
    assetId: string,
    assetType: AssetType,
    metricsData: Record<string, number>
  ): Promise<AssetHealthScore> {
    const factors = this.extractHealthFactors(assetType, metricsData);
    const healthScore = this.computeHealthScore(factors);

    const status = this.determineHealthStatus(healthScore);

    const assetHealth: AssetHealthScore = {
      assetId,
      assetType,
      healthScore,
      status,
      lastCalculated: new Date(),
      factors,
    };

    this.assetHealthScores.set(assetId, assetHealth);
    return assetHealth;
  }

  /**
   * Extract health factors from asset metrics
   */
  private extractHealthFactors(assetType: AssetType, metrics: Record<string, number>): HealthFactor[] {
    const factors: HealthFactor[] = [];

    if (assetType === AssetType.VEHICLE) {
      // Engine condition factor
      if (metrics.engineHours !== undefined) {
        const engineScore = Math.max(0, 100 - (metrics.engineHours / 10000) * 100);
        factors.push({
          name: 'Engine Condition',
          weight: 0.25,
          value: engineScore,
          trend: metrics.engineHoursTrend || 'stable',
        });
      }

      // Fuel efficiency factor
      if (metrics.fuelEfficiency !== undefined) {
        factors.push({
          name: 'Fuel Efficiency',
          weight: 0.15,
          value: metrics.fuelEfficiency,
          trend: metrics.fuelEfficiencyTrend || 'stable',
        });
      }

      // Tire condition factor
      if (metrics.tireWear !== undefined) {
        const tireScore = Math.max(0, 100 - metrics.tireWear * 100);
        factors.push({
          name: 'Tire Condition',
          weight: 0.2,
          value: tireScore,
          trend: metrics.tireWearTrend || 'declining',
        });
      }

      // Brake system factor
      if (metrics.brakeCondition !== undefined) {
        factors.push({
          name: 'Brake System',
          weight: 0.2,
          value: metrics.brakeCondition,
          trend: metrics.brakeConditionTrend || 'stable',
        });
      }

      // Battery condition factor
      if (metrics.batteryHealth !== undefined) {
        factors.push({
          name: 'Battery Health',
          weight: 0.1,
          value: metrics.batteryHealth,
          trend: metrics.batteryHealthTrend || 'declining',
        });
      }

      // Service history factor
      if (metrics.timeSinceLastService !== undefined) {
        const serviceScore = Math.max(0, 100 - (metrics.timeSinceLastService / 365) * 50);
        factors.push({
          name: 'Service Status',
          weight: 0.1,
          value: serviceScore,
          trend: 'declining',
        });
      }
    }

    return factors;
  }

  /**
   * Compute weighted health score from factors
   */
  private computeHealthScore(factors: HealthFactor[]): number {
    if (factors.length === 0) return 100;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      totalWeightedScore += factor.value * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 100;
  }

  /**
   * Determine health status from score
   */
  private determineHealthStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 25) return 'poor';
    return 'critical';
  }

  // ========================================================================
  // FAILURE PREDICTION
  // ========================================================================

  /**
   * Predict failure probability and timeline
   */
  async predictFailure(
    assetId: string,
    assetType: AssetType,
    historicalData: any[]
  ): Promise<FailurePrediction> {
    const assetHealth = this.assetHealthScores.get(assetId);
    if (!assetHealth) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Extract failure patterns from historical data
    const failureIndicators = this.identifyFailureIndicators(assetType, historicalData);
    const failureProbability = this.calculateFailureProbability(failureIndicators, assetHealth.healthScore);
    const timeToFailure = this.estimateTimeToFailure(failureIndicators, failureProbability);

    const prediction: FailurePrediction = {
      assetId,
      failureType: failureIndicators.primaryFailureType,
      failureProbability,
      predictedTimeToFailure: timeToFailure,
      confidenceScore: failureIndicators.confidence,
      recommendedAction: this.getRecommendedAction(failureProbability, assetHealth.status),
      estimatedCost: this.estimateRepairCost(failureIndicators.primaryFailureType, assetType),
    };

    this.failurePredictions.set(assetId, prediction);
    return prediction;
  }

  /**
   * Identify failure indicators from historical data
   */
  private identifyFailureIndicators(assetType: AssetType, data: any[]): any {
    const indicators: any = {
      primaryFailureType: 'unknown',
      confidence: 0,
      risk_factors: [],
    };

    if (data.length === 0) {
      return indicators;
    }

    // Analyze trend patterns
    let degradationTrend = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i].score < data[i - 1].score) {
        degradationTrend++;
      }
    }

    const degradationRate = degradationTrend / Math.max(1, data.length - 1);

    if (degradationRate > 0.7) {
      indicators.primaryFailureType = 'accelerated_degradation';
      indicators.confidence = 0.85;
      indicators.risk_factors.push('Rapid health decline detected');
    } else if (degradationRate > 0.4) {
      indicators.primaryFailureType = 'gradual_wear';
      indicators.confidence = 0.7;
      indicators.risk_factors.push('Consistent health decline');
    } else {
      indicators.primaryFailureType = 'normal_wear';
      indicators.confidence = 0.5;
    }

    return indicators;
  }

  /**
   * Calculate failure probability
   */
  private calculateFailureProbability(indicators: any, healthScore: number): number {
    let probability = 0;

    // Health score contribution
    if (healthScore < 25) {
      probability += 0.8;
    } else if (healthScore < 50) {
      probability += 0.5;
    } else if (healthScore < 70) {
      probability += 0.2;
    }

    // Degradation trend contribution
    if (indicators.primaryFailureType === 'accelerated_degradation') {
      probability += 0.3;
    } else if (indicators.primaryFailureType === 'gradual_wear') {
      probability += 0.15;
    }

    return Math.min(1, probability);
  }

  /**
   * Estimate time to failure
   */
  private estimateTimeToFailure(indicators: any, probability: number): Date {
    let daysToFailure = 365; // Default: 1 year

    if (probability > 0.7) {
      daysToFailure = 30; // 1 month
    } else if (probability > 0.5) {
      daysToFailure = 90; // 3 months
    } else if (probability > 0.3) {
      daysToFailure = 180; // 6 months
    }

    return new Date(Date.now() + daysToFailure * 24 * 60 * 60 * 1000);
  }

  /**
   * Get recommended action
   */
  private getRecommendedAction(probability: number, status: string): string {
    if (probability > 0.8 || status === 'critical') {
      return 'Schedule immediate maintenance - asset at critical risk';
    } else if (probability > 0.5 || status === 'poor') {
      return 'Schedule maintenance within next 2 weeks';
    } else if (probability > 0.3 || status === 'fair') {
      return 'Schedule preventive maintenance within 4 weeks';
    } else if (status === 'good') {
      return 'Continue regular maintenance schedule';
    }
    return 'Monitor asset condition';
  }

  /**
   * Estimate repair cost
   */
  private estimateRepairCost(failureType: string, assetType: AssetType): number {
    const costBase: Record<string, Record<string, number>> = {
      [AssetType.VEHICLE]: {
        accelerated_degradation: 5000,
        gradual_wear: 2000,
        normal_wear: 500,
      },
      [AssetType.EQUIPMENT]: {
        accelerated_degradation: 3000,
        gradual_wear: 1000,
        normal_wear: 300,
      },
      [AssetType.MACHINERY]: {
        accelerated_degradation: 8000,
        gradual_wear: 3000,
        normal_wear: 800,
      },
    };

    return costBase[assetType]?.[failureType] || 1000;
  }

  // ========================================================================
  // MAINTENANCE PLANNING
  // ========================================================================

  /**
   * Optimize maintenance window
   */
  async optimizeMaintenanceWindow(
    assetId: string,
    availableTimeSlots: Date[]
  ): Promise<MaintenanceWindow> {
    const prediction = this.failurePredictions.get(assetId);
    if (!prediction) {
      throw new Error(`No prediction found for asset ${assetId}`);
    }

    const optimalDate = availableTimeSlots.find(slot =>
      slot.getTime() <= (prediction.predictedTimeToFailure?.getTime() || Date.now())
    ) || new Date();

    const maintenanceWindow: MaintenanceWindow = {
      assetId,
      startDate: optimalDate,
      endDate: new Date(optimalDate.getTime() + 4 * 60 * 60 * 1000), // 4 hours
      priority: this.calculateMaintenancePriority(prediction.failureProbability),
      expectedDowntime: 4,
      estimatedCost: prediction.estimatedCost || 1000,
    };

    this.maintenanceWindows.push(maintenanceWindow);
    return maintenanceWindow;
  }

  /**
   * Calculate maintenance priority
   */
  private calculateMaintenancePriority(failureProbability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (failureProbability > 0.8) return 'critical';
    if (failureProbability > 0.6) return 'high';
    if (failureProbability > 0.3) return 'medium';
    return 'low';
  }

  // ========================================================================
  // PARTS FORECASTING
  // ========================================================================

  /**
   * Forecast required parts
   */
  async forecastParts(assetId: string, assetType: AssetType): Promise<PartsForecast[]> {
    const health = this.assetHealthScores.get(assetId);
    const prediction = this.failurePredictions.get(assetId);

    if (!health || !prediction) {
      return [];
    }

    const forecast: PartsForecast[] = [];

    if (assetType === AssetType.VEHICLE) {
      // Tire replacement
      const factors = health.factors || [];
      const tireFactors = factors.find(f => f.name === 'Tire Condition');
      if (tireFactors && tireFactors.value < 40) {
        forecast.push({
          assetId,
          partId: 'part_tire_set',
          partName: 'Tire Set (4x)',
          quantity: 4,
          estimatedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          confidence: 0.9,
        });
      }

      // Battery replacement
      const batteryFactors = factors.find(f => f.name === 'Battery Health');
      if (batteryFactors && batteryFactors.value < 30) {
        forecast.push({
          assetId,
          partId: 'part_battery',
          partName: 'Car Battery',
          quantity: 1,
          estimatedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          confidence: 0.85,
        });
      }

      // Brake pads
      const brakeFactors = factors.find(f => f.name === 'Brake System');
      if (brakeFactors && brakeFactors.value < 50) {
        forecast.push({
          assetId,
          partId: 'part_brake_pads',
          partName: 'Brake Pads',
          quantity: 2,
          estimatedDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          confidence: 0.8,
        });
      }

      // Oil and filters
      const serviceFactors = factors.find(f => f.name === 'Service Status');
      if (serviceFactors && serviceFactors.value < 60) {
        forecast.push({
          assetId,
          partId: 'part_oil_filter',
          partName: 'Oil & Filter',
          quantity: 1,
          estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          confidence: 0.95,
        });
      }
    }

    this.partsForecast.push(...forecast);
    return forecast;
  }

  // ========================================================================
  // ANALYTICS
  // ========================================================================

  /**
   * Get maintenance cost estimation
   */
  async getMaintenanceCostEstimate(assetId: string): Promise<number> {
    const prediction = this.failurePredictions.get(assetId);
    const forecast = this.partsForecast.filter(p => p.assetId === assetId);

    let totalCost = prediction?.estimatedCost || 0;
    totalCost += forecast.reduce((sum, part) => sum + 200 * part.quantity, 0); // Assume $200 per part

    return totalCost;
  }

  /**
   * Calculate downtime risk
   */
  async calculateDowntimeRisk(assetId: string): Promise<{ riskScore: number; expectedHours: number }> {
    const health = this.assetHealthScores.get(assetId);
    if (!health) return { riskScore: 0, expectedHours: 0 };

    const riskScore = 1 - health.healthScore / 100;
    const expectedHours = riskScore * 24; // Max 24 hours downtime risk

    return { riskScore, expectedHours };
  }

  /**
   * Get asset health score
   */
  async getAssetHealth(assetId: string): Promise<AssetHealthScore | null> {
    return this.assetHealthScores.get(assetId) || null;
  }

  /**
   * Get failure prediction
   */
  async getFailurePrediction(assetId: string): Promise<FailurePrediction | null> {
    return this.failurePredictions.get(assetId) || null;
  }

  /**
   * Get all maintenance windows
   */
  async getMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    return this.maintenanceWindows;
  }
}

// Export singleton instance
export const predictiveMaintenanceService = new PredictiveMaintenanceService();
