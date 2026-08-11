import { EventEmitter } from "events";

export interface CustomerLtvMetrics {
  customerId: string;
  totalSpent: number;
  totalRides: number;
  averageRideValue: number;
  frequencyPerMonth: number; // rides per month
  daysSinceFirstRide: number;
  daysSinceLastRide: number;
  rideValueTrend: "increasing" | "stable" | "decreasing";
  frequencyTrend: "increasing" | "stable" | "decreasing";
  averageRating: number; // rating given to drivers
  customerComplaints: number;
  refundRequests: number;
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
  referralCount: number;
  promotionalDiscountUsage: number; // count of promos used
}

export interface ChurnPrediction {
  customerId: string;
  churnRisk: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  primaryRiskFactors: Array<{
    factor: string;
    impact: number; // 0-100
  }>;
  likelyChurnDate: Date;
  estimatedLtvAtRisk: number;
  interventionStrategy: string;
  recommendedActions: string[];
  predictionConfidence: number; // 0-100
  lastUpdated: Date;
}

export interface CustomerSegment {
  segment: string;
  description: string;
  avgLtv: number;
  avgChurnRisk: number;
  characteristics: string[];
  retentionStrategies: string[];
}

interface LtvFactors {
  baseSpent: number;
  frequencyBonus: number;
  loyaltyBonus: number;
  rideValueBonus: number;
  referralBonus: number;
  retentionBonus: number;
}

class CustomerLtvChurnEngine extends EventEmitter {
  private customerMetrics: Map<string, CustomerLtvMetrics> = new Map();
  private churnPredictions: Map<string, ChurnPrediction> = new Map();
  private ltvHistory: Map<string, number[]> = new Map();
  private interventions: Map<string, string[]> = new Map();

  constructor() {
    super();
  }

  updateCustomerMetrics(customerId: string, metrics: Partial<CustomerLtvMetrics>): void {
    const existing = this.customerMetrics.get(customerId) || {
      customerId,
      totalSpent: 0,
      totalRides: 0,
      averageRideValue: 400,
      frequencyPerMonth: 0,
      daysSinceFirstRide: 0,
      daysSinceLastRide: 0,
      rideValueTrend: "stable" as const,
      frequencyTrend: "stable" as const,
      averageRating: 4.5,
      customerComplaints: 0,
      refundRequests: 0,
      loyaltyTier: "bronze" as const,
      referralCount: 0,
      promotionalDiscountUsage: 0,
    };

    const updated = { ...existing, ...metrics };
    this.customerMetrics.set(customerId, updated);

    // Calculate LTV and churn
    this.calculateLtv(customerId, updated);
    this.predictChurn(customerId, updated);

    this.emit("customer:updated", { customerId, metrics: updated });
  }

  private calculateLtv(customerId: string, metrics: CustomerLtvMetrics): void {
    const factors: LtvFactors = {
      baseSpent: metrics.totalSpent,
      frequencyBonus: 0,
      loyaltyBonus: 0,
      rideValueBonus: 0,
      referralBonus: 0,
      retentionBonus: 0,
    };

    // Frequency bonus (₹100 per ride if frequency > 10/month)
    if (metrics.frequencyPerMonth > 10) {
      factors.frequencyBonus = metrics.frequencyPerMonth * 100;
    }

    // Loyalty bonus based on tier
    const loyaltyBonuses: Record<string, number> = {
      bronze: 500,
      silver: 2000,
      gold: 5000,
      platinum: 10000,
    };
    factors.loyaltyBonus = loyaltyBonuses[metrics.loyaltyTier] || 0;

    // Ride value bonus (Higher avg ride = higher LTV)
    if (metrics.averageRideValue > 500) {
      factors.rideValueBonus = metrics.averageRideValue * 10;
    }

    // Referral bonus (₹500 per successful referral)
    factors.referralBonus = metrics.referralCount * 500;

    // Retention bonus (₹2000 if not churned for 6+ months)
    if (metrics.daysSinceLastRide < 180) {
      factors.retentionBonus = 2000;
    }

    const totalLtv =
      factors.baseSpent +
      factors.frequencyBonus +
      factors.loyaltyBonus +
      factors.rideValueBonus +
      factors.referralBonus +
      factors.retentionBonus;

    // Store history
    if (!this.ltvHistory.has(customerId)) {
      this.ltvHistory.set(customerId, []);
    }
    const history = this.ltvHistory.get(customerId)!;
    history.push(totalLtv);

    // Keep last 12 months
    if (history.length > 12) {
      history.shift();
    }

    this.emit("customer:ltv", {
      customerId,
      totalLtv,
      breakdown: factors,
    });
  }

  private predictChurn(customerId: string, metrics: CustomerLtvMetrics): void {
    const riskFactors: Array<{ factor: string; impact: number }> = [];
    let totalRiskScore = 0;

    // Factor 1: Inactivity (highest impact - 40 points max)
    if (metrics.daysSinceLastRide > 90) {
      const inactivityRisk = Math.min(40, (metrics.daysSinceLastRide - 90) / 5);
      riskFactors.push({ factor: "Long inactivity period", impact: inactivityRisk });
      totalRiskScore += inactivityRisk;
    }

    // Factor 2: Declining frequency (30 points max)
    if (metrics.frequencyTrend === "decreasing") {
      riskFactors.push({ factor: "Booking frequency declining", impact: 30 });
      totalRiskScore += 30;
    }

    // Factor 3: Declining ride value (20 points max)
    if (metrics.rideValueTrend === "decreasing") {
      riskFactors.push({ factor: "Average ride value decreasing", impact: 20 });
      totalRiskScore += 20;
    }

    // Factor 4: Customer complaints (25 points max)
    const complaintRisk = Math.min(25, metrics.customerComplaints * 8);
    if (complaintRisk > 0) {
      riskFactors.push({ factor: `${metrics.customerComplaints} complaints received`, impact: complaintRisk });
      totalRiskScore += complaintRisk;
    }

    // Factor 5: Refund requests (15 points max)
    const refundRisk = Math.min(15, metrics.refundRequests * 5);
    if (refundRisk > 0) {
      riskFactors.push({ factor: `${metrics.refundRequests} refund requests`, impact: refundRisk });
      totalRiskScore += refundRisk;
    }

    // Factor 6: Low ratings (15 points max)
    if (metrics.averageRating < 4.0) {
      const ratingRisk = (4.0 - metrics.averageRating) * 5;
      riskFactors.push({ factor: "Low driver ratings given", impact: ratingRisk });
      totalRiskScore += ratingRisk;
    }

    // Loyalty tier discount (reduce risk by tier)
    const tierDiscounts: Record<string, number> = {
      bronze: 0,
      silver: 10,
      gold: 20,
      platinum: 30,
    };
    const loyaltyDiscount = tierDiscounts[metrics.loyaltyTier] || 0;
    totalRiskScore = Math.max(0, totalRiskScore - loyaltyDiscount);

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (totalRiskScore < 20) riskLevel = "low";
    else if (totalRiskScore < 50) riskLevel = "medium";
    else if (totalRiskScore < 75) riskLevel = "high";
    else riskLevel = "critical";

    // Estimate churn date
    const daysToChurn = Math.max(7, 90 - (metrics.daysSinceLastRide / 2));
    const likelyChurnDate = new Date(Date.now() + daysToChurn * 24 * 60 * 60 * 1000);

    // Estimated LTV at risk
    const ltvHistory = this.ltvHistory.get(customerId) || [];
    const estimatedLtvAtRisk = ltvHistory.length > 0
      ? ltvHistory[ltvHistory.length - 1]
      : metrics.totalSpent;

    // Intervention strategy
    const interventionStrategy = this.getInterventionStrategy(riskLevel, metrics);

    // Recommended actions
    const recommendedActions = this.getRecommendedActions(riskLevel, metrics, riskFactors);

    // Confidence in prediction
    const confidenceFactors = [
      metrics.daysSinceLastRide > 0 ? 25 : 0,
      metrics.frequencyTrend !== "stable" ? 20 : 0,
      metrics.customerComplaints > 0 ? 15 : 0,
      metrics.averageRating < 4.5 ? 15 : 0,
      metrics.loyaltyTier === "bronze" ? 25 : 0,
    ];
    const confidence = Math.min(100, confidenceFactors.reduce((a, b) => a + b, 0));

    const prediction: ChurnPrediction = {
      customerId,
      churnRisk: Math.round(totalRiskScore),
      riskLevel,
      primaryRiskFactors: riskFactors.sort((a, b) => b.impact - a.impact).slice(0, 3),
      likelyChurnDate,
      estimatedLtvAtRisk,
      interventionStrategy,
      recommendedActions,
      predictionConfidence: confidence,
      lastUpdated: new Date(),
    };

    this.churnPredictions.set(customerId, prediction);

    this.emit("customer:churn_prediction", prediction);
  }

  private getInterventionStrategy(
    riskLevel: string,
    metrics: CustomerLtvMetrics
  ): string {
    const strategies: Record<string, string> = {
      low: "Maintain engagement - Continue offering regular promotions",
      medium: "Proactive outreach - Send personalized discounts and engagement messages",
      high: "Urgent intervention - Offer loyalty rewards and personalized service",
      critical: "Emergency retention - Offer significant discounts and dedicated support",
    };

    return strategies[riskLevel] || strategies.low;
  }

  private getRecommendedActions(
    riskLevel: string,
    metrics: CustomerLtvMetrics,
    riskFactors: Array<{ factor: string; impact: number }>
  ): string[] {
    const actions: string[] = [];

    if (riskLevel === "critical" || riskLevel === "high") {
      actions.push("🎁 Send personalized 40% discount coupon");
      actions.push("📞 Call customer to understand concerns");
      actions.push("👑 Offer loyalty tier upgrade");
    }

    if (riskLevel === "medium") {
      actions.push("💌 Send personalized re-engagement email");
      actions.push("🎉 Offer 25% referral bonus");
      actions.push("⭐ Request review of recent experience");
    }

    if (metrics.daysSinceLastRide > 60) {
      actions.push("📱 Send push notification with fresh offers");
    }

    if (metrics.frequencyTrend === "decreasing") {
      actions.push("📊 Analyze booking patterns and suggest routes");
    }

    if (metrics.customerComplaints > 0) {
      actions.push("✅ Resolve complaints immediately with compensation");
    }

    if (metrics.averageRating < 4.5) {
      actions.push("🌟 Incentivize premium driver selection");
    }

    if (actions.length === 0) {
      actions.push("✅ Maintain current engagement strategy");
    }

    return actions;
  }

  getCustomerSegmentation(): CustomerSegment[] {
    const metrics = Array.from(this.customerMetrics.values());
    const predictions = Array.from(this.churnPredictions.values());

    const segments: CustomerSegment[] = [
      {
        segment: "VIP Champions",
        description: "Highest value, most loyal customers",
        avgLtv: 50000,
        avgChurnRisk: 5,
        characteristics: [
          "Platinum loyalty tier",
          "Monthly rides > 20",
          "Average ride > ₹600",
          "No complaints",
          "Churn risk < 20%",
        ],
        retentionStrategies: [
          "Exclusive perks and early access",
          "Dedicated concierge support",
          "Premium driver matching",
          "VIP event invitations",
        ],
      },
      {
        segment: "Growth Drivers",
        description: "High frequency, increasing value",
        avgLtv: 25000,
        avgChurnRisk: 15,
        characteristics: [
          "Gold/Silver tier",
          "Monthly rides 10-20",
          "Increasing frequency trend",
          "Growing spend",
          "Churn risk < 40%",
        ],
        retentionStrategies: [
          "Gamified loyalty rewards",
          "Milestone bonuses",
          "Referral incentives",
          "Premium tier progression",
        ],
      },
      {
        segment: "At-Risk Customers",
        description: "Declining engagement, retention needed",
        avgLtv: 8000,
        avgChurnRisk: 70,
        characteristics: [
          "Declining frequency",
          "Long inactive periods (60+ days)",
          "Decreasing ride value",
          "Recent complaints",
          "Churn risk > 60%",
        ],
        retentionStrategies: [
          "Aggressive discount campaigns",
          "Win-back offers (50% off)",
          "Customer success outreach",
          "Root cause analysis",
        ],
      },
      {
        segment: "Casual Users",
        description: "Occasional users, moderate value",
        avgLtv: 5000,
        avgChurnRisk: 45,
        characteristics: [
          "Monthly rides < 5",
          "Bronze tier",
          "Stable but low frequency",
          "Churn risk 40-60%",
        ],
        retentionStrategies: [
          "Regular engagement campaigns",
          "Frequency-based incentives",
          "Trial premium services",
          "Community building",
        ],
      },
    ];

    return segments;
  }

  getChurnPrediction(customerId: string): ChurnPrediction | null {
    return this.churnPredictions.get(customerId) || null;
  }

  getCustomerLtvHistory(customerId: string): number[] {
    return this.ltvHistory.get(customerId) || [];
  }

  recordIntervention(customerId: string, action: string): void {
    if (!this.interventions.has(customerId)) {
      this.interventions.set(customerId, []);
    }
    this.interventions.get(customerId)!.push(action);
    this.emit("intervention:recorded", { customerId, action });
  }

  getChurnAnalytics(): {
    atRiskCount: number;
    criticalCount: number;
    avgChurnRisk: number;
    totalAtRiskLtv: number;
    segmentDistribution: Record<string, number>;
  } {
    const predictions = Array.from(this.churnPredictions.values());

    const atRiskCount = predictions.filter((p) => p.riskLevel === "high" || p.riskLevel === "critical").length;
    const criticalCount = predictions.filter((p) => p.riskLevel === "critical").length;
    const avgChurnRisk = predictions.length > 0
      ? Math.round(predictions.reduce((sum, p) => sum + p.churnRisk, 0) / predictions.length)
      : 0;

    const totalAtRiskLtv = predictions
      .filter((p) => p.riskLevel === "high" || p.riskLevel === "critical")
      .reduce((sum, p) => sum + p.estimatedLtvAtRisk, 0);

    const segmentDistribution: Record<string, number> = {
      low: predictions.filter((p) => p.riskLevel === "low").length,
      medium: predictions.filter((p) => p.riskLevel === "medium").length,
      high: predictions.filter((p) => p.riskLevel === "high").length,
      critical: predictions.filter((p) => p.riskLevel === "critical").length,
    };

    return {
      atRiskCount,
      criticalCount,
      avgChurnRisk,
      totalAtRiskLtv,
      segmentDistribution,
    };
  }
}

export const customerLtvChurnEngine = new CustomerLtvChurnEngine();
