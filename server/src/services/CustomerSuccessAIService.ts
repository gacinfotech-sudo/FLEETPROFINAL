// ============================================================================
// CUSTOMER SUCCESS AI SERVICE - Health scoring & churn prediction
// Phase 5: Milestone 1 - AI & ML Enhancements
// ============================================================================

import {
  CustomerHealthScore,
  HealthFactor,
  ExpansionOpportunity,
  ChurnPrediction,
  EngagementScore,
  OutreachRecommendation,
} from '../types/ai-ml.types';

/**
 * CustomerSuccessAIService: Customer success and retention AI
 * - Health score calculation (usage, engagement, NPS)
 * - At-risk customer identification
 * - Expansion opportunities detection
 * - Churn prevention recommendations
 * - Engagement scoring and optimization
 */
export class CustomerSuccessAIService {
  private customerHealthScores: Map<string, CustomerHealthScore> = new Map();
  private churnPredictions: Map<string, ChurnPrediction> = new Map();
  private expansionOpportunities: Map<string, ExpansionOpportunity[]> = new Map();
  private engagementScores: Map<string, EngagementScore[]> = new Map();
  private outreachRecommendations: Map<string, OutreachRecommendation[]> = new Map();

  constructor() {
    this.initializeService();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeService(): void {
    console.log('[CustomerSuccessAIService] Service initialized');
  }

  // ========================================================================
  // HEALTH SCORE CALCULATION
  // ========================================================================

  /**
   * Calculate customer health score
   */
  async calculateCustomerHealth(
    customerId: string,
    tenantId: string,
    metricsData: {
      usageMetrics?: Record<string, number>;
      engagementMetrics?: Record<string, number>;
      npsScore?: number;
    }
  ): Promise<CustomerHealthScore> {
    const factors: HealthFactor[] = [];

    // Usage score (weight: 0.35)
    const usageScore = this.calculateUsageScore(metricsData.usageMetrics || {});
    factors.push({
      name: 'Usage Score',
      weight: 0.35,
      value: usageScore,
      trend: this.determineTrend(usageScore),
    });

    // Engagement score (weight: 0.35)
    const engagementScore = this.calculateEngagementScore(metricsData.engagementMetrics || {});
    factors.push({
      name: 'Engagement Score',
      weight: 0.35,
      value: engagementScore,
      trend: this.determineTrend(engagementScore),
    });

    // NPS score (weight: 0.3)
    const npsScore = metricsData.npsScore || 50;
    const npsValue = ((npsScore + 100) / 200) * 100; // Normalize -100 to 100 into 0 to 100
    factors.push({
      name: 'NPS Score',
      weight: 0.3,
      value: npsValue,
      trend: 'stable',
    });

    // Calculate overall health
    const overallHealth = this.computeHealthScore(factors);
    const status = this.determineHealthStatus(overallHealth);

    const healthScore: CustomerHealthScore = {
      customerId,
      tenantId,
      overallHealth,
      usageScore,
      engagementScore,
      npsScore,
      status,
      lastCalculated: new Date(),
      factors,
    };

    this.customerHealthScores.set(customerId, healthScore);
    return healthScore;
  }

  /**
   * Calculate usage score
   */
  private calculateUsageScore(metrics: Record<string, number>): number {
    const weights = {
      logins: 0.3,
      activeDays: 0.3,
      featuresUsed: 0.2,
      dataVolume: 0.2,
    };

    let score = 0;

    // Logins (target: 5+ per week)
    if (metrics.logins !== undefined) {
      score += Math.min(100, (metrics.logins / 5) * 100) * weights.logins;
    }

    // Active days (target: 5+ per week)
    if (metrics.activeDays !== undefined) {
      score += Math.min(100, (metrics.activeDays / 5) * 100) * weights.activeDays;
    }

    // Features used (target: 15+ features)
    if (metrics.featuresUsed !== undefined) {
      score += Math.min(100, (metrics.featuresUsed / 15) * 100) * weights.featuresUsed;
    }

    // Data volume (target: 1000+ records)
    if (metrics.dataVolume !== undefined) {
      score += Math.min(100, (metrics.dataVolume / 1000) * 100) * weights.dataVolume;
    }

    return Math.round(score);
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(metrics: Record<string, number>): number {
    const weights = {
      sessionDuration: 0.3,
      interactionCount: 0.3,
      featureDepth: 0.2,
      supportTickets: 0.2,
    };

    let score = 0;

    // Session duration (target: 30+ minutes)
    if (metrics.sessionDuration !== undefined) {
      score += Math.min(100, (metrics.sessionDuration / 30) * 100) * weights.sessionDuration;
    }

    // Interaction count (target: 50+ per week)
    if (metrics.interactionCount !== undefined) {
      score += Math.min(100, (metrics.interactionCount / 50) * 100) * weights.interactionCount;
    }

    // Feature depth (target: using 20% of platform)
    if (metrics.featureDepth !== undefined) {
      score += Math.min(100, metrics.featureDepth * 500) * weights.featureDepth;
    }

    // Support tickets (fewer is better - negative weight)
    if (metrics.supportTickets !== undefined) {
      const ticketScore = Math.max(0, 100 - metrics.supportTickets * 20);
      score += ticketScore * weights.supportTickets;
    }

    return Math.round(score);
  }

  /**
   * Compute weighted health score
   */
  private computeHealthScore(factors: HealthFactor[]): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      totalWeightedScore += factor.value * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 50;
  }

  /**
   * Determine health status
   */
  private determineHealthStatus(score: number): 'healthy' | 'at_risk' | 'critical' {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'at_risk';
    return 'critical';
  }

  /**
   * Determine score trend
   */
  private determineTrend(score: number): 'improving' | 'stable' | 'declining' {
    if (score >= 75) return 'improving';
    if (score >= 50) return 'stable';
    return 'declining';
  }

  // ========================================================================
  // CHURN PREDICTION
  // ========================================================================

  /**
   * Predict customer churn risk
   */
  async predictChurn(
    customerId: string,
    tenantId: string,
    historicalBehavior: any[]
  ): Promise<ChurnPrediction> {
    const health = this.customerHealthScores.get(customerId);
    const indicators = this.identifyChurnIndicators(customerId, historicalBehavior);
    const churnRisk = this.calculateChurnRisk(indicators, health);

    const prediction: ChurnPrediction = {
      customerId,
      churnRisk,
      riskFactors: indicators.factors,
      preventionStrategies: this.getPreventionStrategies(indicators.factors, churnRisk),
      recommendedAction: this.getChurnActionRecommendation(churnRisk),
      urgency: this.determineChurnUrgency(churnRisk),
    };

    this.churnPredictions.set(customerId, prediction);
    return prediction;
  }

  /**
   * Identify churn indicators
   */
  private identifyChurnIndicators(customerId: string, behavior: any[]): any {
    const indicators: any = {
      factors: [],
      riskScore: 0,
    };

    if (behavior.length === 0) return indicators;

    // Check for declining usage
    const recentBehavior = behavior.slice(-4); // Last 4 weeks
    const olderBehavior = behavior.slice(-8, -4); // Previous 4 weeks

    if (olderBehavior.length > 0) {
      const recentUsage = recentBehavior.reduce((sum: number, b: any) => sum + b.usage || 0, 0);
      const olderUsage = olderBehavior.reduce((sum: number, b: any) => sum + b.usage || 0, 0);

      if (olderUsage > 0 && recentUsage / olderUsage < 0.5) {
        indicators.factors.push('Significant usage decline');
        indicators.riskScore += 0.3;
      }
    }

    // Check for inactivity
    const lastActivity = behavior[behavior.length - 1]?.date || new Date();
    const daysSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 30) {
      indicators.factors.push('No activity for 30+ days');
      indicators.riskScore += 0.25;
    } else if (daysSinceActivity > 14) {
      indicators.factors.push('No activity for 14+ days');
      indicators.riskScore += 0.15;
    }

    // Check for support complaints
    const complaints = behavior.filter((b: any) => b.supportSentiment === 'negative').length;
    if (complaints > 2) {
      indicators.factors.push('Multiple negative support interactions');
      indicators.riskScore += 0.2;
    }

    // Check for feature abandonment
    if (behavior.some((b: any) => b.featuresUsed < 5)) {
      indicators.factors.push('Minimal feature adoption');
      indicators.riskScore += 0.15;
    }

    return indicators;
  }

  /**
   * Calculate churn risk probability
   */
  private calculateChurnRisk(
    indicators: any,
    health: CustomerHealthScore | undefined
  ): number {
    let risk = indicators.riskScore || 0;

    // Factor in health score
    if (health) {
      if (health.status === 'critical') {
        risk += 0.4;
      } else if (health.status === 'at_risk') {
        risk += 0.2;
      }
    }

    return Math.min(1, risk);
  }

  /**
   * Get churn prevention strategies
   */
  private getPreventionStrategies(riskFactors: string[], churnRisk: number): string[] {
    const strategies: string[] = [];

    if (riskFactors.includes('Significant usage decline')) {
      strategies.push('Conduct feature discovery call');
      strategies.push('Provide personalized usage analytics');
    }

    if (riskFactors.includes('No activity for 30+ days')) {
      strategies.push('Send re-engagement email with new features');
      strategies.push('Offer special discount or credit');
    }

    if (riskFactors.includes('Multiple negative support interactions')) {
      strategies.push('Assign dedicated account manager');
      strategies.push('Provide priority support access');
    }

    if (riskFactors.includes('Minimal feature adoption')) {
      strategies.push('Provide product training webinar');
      strategies.push('Share case studies of feature usage');
    }

    if (churnRisk > 0.7) {
      strategies.push('CEO/Leadership outreach call');
    }

    return strategies;
  }

  /**
   * Get churn action recommendation
   */
  private getChurnActionRecommendation(churnRisk: number): string {
    if (churnRisk > 0.8) {
      return 'Immediate executive outreach required';
    } else if (churnRisk > 0.6) {
      return 'Schedule account review call within 3 days';
    } else if (churnRisk > 0.4) {
      return 'Send targeted re-engagement campaign';
    } else if (churnRisk > 0.2) {
      return 'Monitor account closely';
    }
    return 'Account in good standing';
  }

  /**
   * Determine churn urgency
   */
  private determineChurnUrgency(churnRisk: number): 'low' | 'medium' | 'high' | 'critical' {
    if (churnRisk > 0.8) return 'critical';
    if (churnRisk > 0.6) return 'high';
    if (churnRisk > 0.3) return 'medium';
    return 'low';
  }

  // ========================================================================
  // EXPANSION OPPORTUNITIES
  // ========================================================================

  /**
   * Detect expansion opportunities
   */
  async detectExpansionOpportunities(
    customerId: string,
    customerProfile: any
  ): Promise<ExpansionOpportunity[]> {
    const health = this.customerHealthScores.get(customerId);
    if (!health) return [];

    const opportunities: ExpansionOpportunity[] = [];

    // Upsell based on high usage
    if (health.usageScore > 80) {
      opportunities.push({
        customerId,
        opportunity: 'Premium plan upgrade',
        category: 'upsell',
        potentialValue: 5000,
        confidence: 0.85,
        recommendation: 'Customer shows high platform engagement. Offer premium features.',
        timeline: 'Immediate',
      });
    }

    // Cross-sell based on feature adoption
    if (health.engagementScore > 75 && health.factors?.some(f => f.name === 'Features Used' && f.value > 70)) {
      opportunities.push({
        customerId,
        opportunity: 'Advanced analytics add-on',
        category: 'cross_sell',
        potentialValue: 3000,
        confidence: 0.75,
        recommendation: 'Heavy feature user. Advanced analytics would provide additional value.',
        timeline: 'Within 30 days',
      });
    }

    // Enterprise expansion
    if (customerProfile?.teamSize && customerProfile.teamSize > 20) {
      opportunities.push({
        customerId,
        opportunity: 'Enterprise SSO & advanced security',
        category: 'enterprise',
        potentialValue: 15000,
        confidence: 0.8,
        recommendation: 'Large team. Enterprise features would streamline management.',
        timeline: 'Within 60 days',
      });
    }

    // Service expansion
    if (health.overallHealth > 75) {
      opportunities.push({
        customerId,
        opportunity: 'Professional services consultation',
        category: 'services',
        potentialValue: 10000,
        confidence: 0.7,
        recommendation: 'Healthy customer. Offer strategic consultation services.',
        timeline: 'Within 45 days',
      });
    }

    this.expansionOpportunities.set(customerId, opportunities);
    return opportunities;
  }

  // ========================================================================
  // ENGAGEMENT SCORING
  // ========================================================================

  /**
   * Calculate engagement metrics over time
   */
  async trackEngagementScore(
    customerId: string,
    metric: string,
    value: number,
    benchmark: number
  ): Promise<EngagementScore> {
    const score: EngagementScore = {
      customerId,
      score: Math.round((value / benchmark) * 100),
      metric,
      value,
      benchmark,
      trend: value > benchmark ? 'up' : value < benchmark * 0.8 ? 'down' : 'stable',
    };

    if (!this.engagementScores.has(customerId)) {
      this.engagementScores.set(customerId, []);
    }
    this.engagementScores.get(customerId)!.push(score);

    return score;
  }

  // ========================================================================
  // OUTREACH RECOMMENDATIONS
  // ========================================================================

  /**
   * Get optimal outreach recommendation
   */
  async getOutreachRecommendation(customerId: string): Promise<OutreachRecommendation | null> {
    const health = this.customerHealthScores.get(customerId);
    const churn = this.churnPredictions.get(customerId);

    if (!health) return null;

    let channel: 'email' | 'sms' | 'in_app' | 'call' = 'email';
    let contentType = 'general_update';
    let message = '';
    let expectedResponse = 0.2;

    // High engagement: use email
    if (health.engagementScore > 80) {
      channel = 'email';
      contentType = 'feature_announcement';
      message = 'Check out our latest features that could help your workflow';
      expectedResponse = 0.4;
    }
    // Medium engagement: use in-app
    else if (health.engagementScore > 50) {
      channel = 'in_app';
      contentType = 'educational';
      message = 'Learn how to get more value from our platform';
      expectedResponse = 0.35;
    }
    // At-risk: use phone call
    else if (health.status === 'at_risk' || (churn && churn.urgency === 'high')) {
      channel = 'call';
      contentType = 'account_review';
      message = "Let's discuss your experience and how we can better support you";
      expectedResponse = 0.7;
    }
    // Critical: urgent call
    else if (health.status === 'critical' || (churn && churn.urgency === 'critical')) {
      channel = 'call';
      contentType = 'urgent_outreach';
      message = 'We noticed a change in your usage. We want to help.';
      expectedResponse = 0.6;
    }

    // Determine optimal time (business hours, not during peak)
    const optimalTime = new Date();
    optimalTime.setHours(10, 0, 0, 0); // 10 AM
    if (optimalTime.getTime() < Date.now()) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }

    const recommendation: OutreachRecommendation = {
      customerId,
      message,
      channel,
      optimalTime,
      contentType,
      expectedResponse,
    };

    if (!this.outreachRecommendations.has(customerId)) {
      this.outreachRecommendations.set(customerId, []);
    }
    this.outreachRecommendations.get(customerId)!.push(recommendation);

    return recommendation;
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  async getCustomerHealth(customerId: string): Promise<CustomerHealthScore | null> {
    return this.customerHealthScores.get(customerId) || null;
  }

  async getChurnPrediction(customerId: string): Promise<ChurnPrediction | null> {
    return this.churnPredictions.get(customerId) || null;
  }

  async getExpansionOpportunities(customerId: string): Promise<ExpansionOpportunity[]> {
    return this.expansionOpportunities.get(customerId) || [];
  }

  async getEngagementHistory(customerId: string): Promise<EngagementScore[]> {
    return this.engagementScores.get(customerId) || [];
  }

  async getOutreachHistory(customerId: string): Promise<OutreachRecommendation[]> {
    return this.outreachRecommendations.get(customerId) || [];
  }
}

// Export singleton instance
export const customerSuccessAIService = new CustomerSuccessAIService();
