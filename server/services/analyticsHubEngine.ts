import { EventEmitter } from "events";

export interface MetricSnapshot {
  timestamp: Date;
  revenue: number;
  rides: number;
  avgRating: number;
  driverUtilization: number;
  customerChurn: number;
  operatingCost: number;
  profitMargin: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: "uptrend" | "downtrend" | "stable";
  changePercent: number;
  dayOverDay: number;
  weekOverWeek: number;
  monthOverMonth: number;
  velocity: number; // Rate of change
  forecast7Day: number; // Predicted value in 7 days
}

export interface PredictiveInsight {
  id: string;
  category: "revenue" | "churn" | "growth" | "risk" | "opportunity";
  title: string;
  description: string;
  confidence: number; // 0-100
  impact: "high" | "medium" | "low";
  actionItems: string[];
  timeframe: string;
  estimatedValue?: number;
}

export interface SystemHealthReport {
  timestamp: Date;
  overallHealth: number; // 0-100
  systems: {
    recommendations: number;
    pricing: number;
    dispatch: number;
    maintenance: number;
    driverIntelligence: number;
    customerLtv: number;
    anomalyDetection: number;
  };
  alerts: string[];
  performanceScore: number;
  efficiencyScore: number;
  reliabilityScore: number;
}

export interface BusinessIntelligence {
  period: string; // "daily", "weekly", "monthly"
  revenue: {
    total: number;
    average: number;
    peak: number;
    trend: string;
  };
  operations: {
    totalRides: number;
    avgRideValue: number;
    utilization: number;
    customerSatisfaction: number;
  };
  growth: {
    newCustomers: number;
    retentionRate: number;
    referralRate: number;
    marketShare?: number;
  };
  risks: {
    churnRate: number;
    failureRate: number;
    costOverruns: string[];
  };
  opportunities: string[];
}

class AnalyticsHubEngine extends EventEmitter {
  private metricsHistory: Map<string, MetricSnapshot[]> = new Map();
  private trends: Map<string, TrendAnalysis> = new Map();
  private predictions: Map<string, PredictiveInsight> = new Map();
  private healthReports: Map<string, SystemHealthReport> = new Map();
  private businessIntelligence: Map<string, BusinessIntelligence> = new Map();

  constructor() {
    super();
  }

  recordMetrics(snapshot: MetricSnapshot): void {
    const key = snapshot.timestamp.toISOString().split("T")[0];

    if (!this.metricsHistory.has(key)) {
      this.metricsHistory.set(key, []);
    }

    const history = this.metricsHistory.get(key)!;
    history.push(snapshot);

    // Keep only last 30 days
    if (history.length > 1440) {
      history.shift();
    }

    // Trigger trend analysis
    this.analyzeTrends();

    this.emit("metrics:recorded", snapshot);
  }

  private analyzeTrends(): void {
    const allSnapshots: MetricSnapshot[] = [];
    for (const snapshots of this.metricsHistory.values()) {
      allSnapshots.push(...snapshots);
    }

    if (allSnapshots.length < 2) return;

    // Sort by timestamp
    allSnapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const metrics = [
      { key: "revenue", selector: (s: MetricSnapshot) => s.revenue },
      { key: "rides", selector: (s: MetricSnapshot) => s.rides },
      { key: "avgRating", selector: (s: MetricSnapshot) => s.avgRating },
      { key: "profitMargin", selector: (s: MetricSnapshot) => s.profitMargin },
      { key: "driverUtilization", selector: (s: MetricSnapshot) => s.driverUtilization },
    ];

    metrics.forEach(({ key, selector }) => {
      const values = allSnapshots.map(selector);
      const latest = values[values.length - 1];
      const previous = values.length > 1 ? values[values.length - 2] : latest;
      const weekAgo =
        values.length > 7 ? values[values.length - 8] : values[0];
      const monthAgo =
        values.length > 30 ? values[values.length - 31] : values[0];

      const dayOverDay = ((latest - previous) / previous) * 100;
      const weekOverWeek = ((latest - weekAgo) / weekAgo) * 100;
      const monthOverMonth = ((latest - monthAgo) / monthAgo) * 100;

      let trend: "uptrend" | "downtrend" | "stable";
      if (Math.abs(dayOverDay) < 2) {
        trend = "stable";
      } else if (dayOverDay > 0) {
        trend = "uptrend";
      } else {
        trend = "downtrend";
      }

      // Simple linear regression for velocity
      const velocity = this.calculateVelocity(values.slice(-7));

      // Forecast using exponential smoothing
      const forecast7Day = this.forecastValue(values, 7);

      const analysis: TrendAnalysis = {
        metric: key,
        trend,
        changePercent: Math.round(dayOverDay * 100) / 100,
        dayOverDay: Math.round(dayOverDay * 100) / 100,
        weekOverWeek: Math.round(weekOverWeek * 100) / 100,
        monthOverMonth: Math.round(monthOverMonth * 100) / 100,
        velocity,
        forecast7Day,
      };

      this.trends.set(key, analysis);
    });
  }

  private calculateVelocity(values: number[]): number {
    if (values.length < 2) return 0;

    let slope = 0;
    const mean = values.reduce((a, b) => a + b) / values.length;

    for (let i = 0; i < values.length; i++) {
      slope += ((i + 1) - (values.length + 1) / 2) * (values[i] - mean);
    }

    const denominator = (values.length * (values.length + 1) * (2 * values.length + 1)) / 6 -
      Math.pow((values.length * (values.length + 1)) / 2, 2) / values.length;

    return denominator !== 0 ? slope / denominator : 0;
  }

  private forecastValue(history: number[], periods: number): number {
    if (history.length < 3) return history[history.length - 1];

    // Exponential smoothing (alpha=0.3)
    const alpha = 0.3;
    let forecast = history[0];

    for (const value of history) {
      forecast = alpha * value + (1 - alpha) * forecast;
    }

    // Simple momentum adjustment
    const recentChange = history[history.length - 1] - history[history.length - 2];
    return forecast + recentChange * (periods / 30);
  }

  generatePredictiveInsights(metrics: {
    revenue?: number;
    churn?: number;
    customerSatisfaction?: number;
    systemHealth?: number;
  }): PredictiveInsight[] {
    const insights: PredictiveInsight[] = [];

    // Revenue insights
    if (metrics.revenue !== undefined && metrics.revenue < 50000) {
      insights.push({
        id: `insight_${Date.now()}_revenue`,
        category: "revenue",
        title: "Revenue Below Target",
        description: `Revenue is ₹${metrics.revenue}, which is below the daily target of ₹50,000. Consider activating promotional campaigns or surge pricing.`,
        confidence: 85,
        impact: "high",
        actionItems: [
          "Launch customer retention campaign",
          "Increase driver incentives",
          "Activate surge pricing in low-demand zones",
        ],
        timeframe: "Next 24-48 hours",
        estimatedValue: 15000,
      });
    }

    // Churn insights
    if (metrics.churn !== undefined && metrics.churn > 25) {
      insights.push({
        id: `insight_${Date.now()}_churn`,
        category: "churn",
        title: "High Customer Churn Detected",
        description: `Customer churn rate is ${metrics.churn}%, which is above the safe threshold of 25%. Immediate intervention required.`,
        confidence: 90,
        impact: "high",
        actionItems: [
          "Send personalized win-back offers",
          "Analyze churn reasons via feedback",
          "Implement loyalty program enhancements",
        ],
        timeframe: "Immediate",
        estimatedValue: -50000,
      });
    }

    // Satisfaction insights
    if (
      metrics.customerSatisfaction !== undefined &&
      metrics.customerSatisfaction < 3.5
    ) {
      insights.push({
        id: `insight_${Date.now()}_satisfaction`,
        category: "risk",
        title: "Customer Satisfaction Crisis",
        description: `Average rating has dropped to ${metrics.customerSatisfaction}, indicating potential quality issues.`,
        confidence: 88,
        impact: "high",
        actionItems: [
          "Conduct service quality audit",
          "Retrain driver on customer service",
          "Implement quality monitoring program",
        ],
        timeframe: "This week",
      });
    }

    // System health insights
    if (metrics.systemHealth !== undefined && metrics.systemHealth < 70) {
      insights.push({
        id: `insight_${Date.now()}_health`,
        category: "risk",
        title: "System Health Degradation",
        description: `Overall system health score is ${metrics.systemHealth}%, indicating performance issues.`,
        confidence: 92,
        impact: "high",
        actionItems: ["Review system performance", "Check anomalies", "Scale infrastructure if needed"],
        timeframe: "Urgent",
      });
    }

    // Growth opportunities
    if (metrics.revenue !== undefined && metrics.revenue > 80000) {
      insights.push({
        id: `insight_${Date.now()}_growth`,
        category: "opportunity",
        title: "Strong Growth Opportunity",
        description: `Revenue is performing well (₹${metrics.revenue}). This is an opportunity to expand into new markets or introduce premium services.`,
        confidence: 75,
        impact: "medium",
        actionItems: [
          "Analyze market demand in adjacent zones",
          "Launch premium tier service",
          "Invest in marketing for expansion",
        ],
        timeframe: "Next quarter",
        estimatedValue: 200000,
      });
    }

    this.predictions.set(`batch_${Date.now()}`, insights[0] || null);
    insights.forEach((insight) => {
      this.emit("insight:generated", insight);
    });

    return insights;
  }

  generateSystemHealthReport(systems: {
    recommendations?: number;
    pricing?: number;
    dispatch?: number;
    maintenance?: number;
    driverIntelligence?: number;
    customerLtv?: number;
    anomalyDetection?: number;
  }): SystemHealthReport {
    const scores = {
      recommendations: systems.recommendations || 85,
      pricing: systems.pricing || 82,
      dispatch: systems.dispatch || 88,
      maintenance: systems.maintenance || 80,
      driverIntelligence: systems.driverIntelligence || 84,
      customerLtv: systems.customerLtv || 81,
      anomalyDetection: systems.anomalyDetection || 79,
    };

    const overallHealth =
      Object.values(scores).reduce((a, b) => a + b) / Object.keys(scores).length;

    const alerts: string[] = [];
    for (const [system, score] of Object.entries(scores)) {
      if (score < 75) {
        alerts.push(`${system} health is critical (${score}%)`);
      } else if (score < 85) {
        alerts.push(`${system} needs attention (${score}%)`);
      }
    }

    const report: SystemHealthReport = {
      timestamp: new Date(),
      overallHealth: Math.round(overallHealth),
      systems: scores,
      alerts,
      performanceScore: Math.round(overallHealth * 0.8 + 20), // Scale to 20-100
      efficiencyScore: Math.round(overallHealth * 0.75 + 25),
      reliabilityScore: Math.round(overallHealth * 0.85 + 15),
    };

    this.healthReports.set(`report_${Date.now()}`, report);
    this.emit("health:report", report);

    return report;
  }

  generateBusinessIntelligence(period: string = "daily"): BusinessIntelligence {
    const allSnapshots: MetricSnapshot[] = [];
    for (const snapshots of this.metricsHistory.values()) {
      allSnapshots.push(...snapshots);
    }

    if (allSnapshots.length === 0) {
      return this.getEmptyBusinessIntelligence(period);
    }

    const totalRevenue = allSnapshots.reduce((sum, s) => sum + s.revenue, 0);
    const avgRevenue = totalRevenue / allSnapshots.length;
    const maxRevenue = Math.max(...allSnapshots.map((s) => s.revenue));

    const totalRides = allSnapshots.reduce((sum, s) => sum + s.rides, 0);
    const avgRating =
      allSnapshots.reduce((sum, s) => sum + s.avgRating, 0) /
      allSnapshots.length;
    const avgUtilization =
      allSnapshots.reduce((sum, s) => sum + s.driverUtilization, 0) /
      allSnapshots.length;
    const avgChurn =
      allSnapshots.reduce((sum, s) => sum + s.customerChurn, 0) /
      allSnapshots.length;
    const avgProfitMargin =
      allSnapshots.reduce((sum, s) => sum + s.profitMargin, 0) /
      allSnapshots.length;

    const bi: BusinessIntelligence = {
      period,
      revenue: {
        total: Math.round(totalRevenue),
        average: Math.round(avgRevenue),
        peak: Math.round(maxRevenue),
        trend: avgProfitMargin > 20 ? "positive" : "concerning",
      },
      operations: {
        totalRides: Math.round(totalRides),
        avgRideValue: Math.round(totalRevenue / (totalRides || 1)),
        utilization: Math.round(avgUtilization),
        customerSatisfaction: Math.round(avgRating * 100) / 100,
      },
      growth: {
        newCustomers: Math.round((totalRides * 0.15) / 30), // Estimate 15% new customers
        retentionRate: Math.round(100 - avgChurn),
        referralRate: Math.round((totalRides * 0.08) / 30),
      },
      risks: {
        churnRate: Math.round(avgChurn * 100) / 100,
        failureRate: Math.round((totalRides * 0.02) * 100) / 100, // Estimate 2% failures
        costOverruns: avgProfitMargin < 15 ? ["Operating costs increasing"] : [],
      },
      opportunities: [
        "Expansion into adjacent zones",
        "Premium tier launch",
        "Partnership opportunities",
        "Data monetization",
      ],
    };

    this.businessIntelligence.set(`bi_${period}_${Date.now()}`, bi);
    this.emit("intelligence:generated", bi);

    return bi;
  }

  private getEmptyBusinessIntelligence(period: string): BusinessIntelligence {
    return {
      period,
      revenue: { total: 0, average: 0, peak: 0, trend: "stable" },
      operations: { totalRides: 0, avgRideValue: 0, utilization: 0, customerSatisfaction: 0 },
      growth: { newCustomers: 0, retentionRate: 100, referralRate: 0 },
      risks: { churnRate: 0, failureRate: 0, costOverruns: [] },
      opportunities: [],
    };
  }

  getTrends(): Record<string, TrendAnalysis> {
    const result: Record<string, TrendAnalysis> = {};
    for (const [key, trend] of this.trends) {
      result[key] = trend;
    }
    return result;
  }

  getPredictions(): PredictiveInsight[] {
    return Array.from(this.predictions.values()).filter(Boolean);
  }

  getHealthReports(limit: number = 10): SystemHealthReport[] {
    return Array.from(this.healthReports.values()).slice(-limit);
  }

  getAnalyticsStats(): {
    metricsRecorded: number;
    trendsAnalyzed: number;
    insightsGenerated: number;
    healthReportsGenerated: number;
    averageHealthScore: number;
    topRisks: string[];
    topOpportunities: string[];
  } {
    const predictions = this.getPredictions();
    const healthReports = this.getHealthReports();

    const risks = predictions
      .filter((p) => p.impact === "high" && p.category === "risk")
      .map((p) => p.title);

    const opportunities = predictions
      .filter((p) => p.category === "opportunity")
      .map((p) => p.title);

    const avgHealth =
      healthReports.length > 0
        ? Math.round(
            healthReports.reduce((sum, r) => sum + r.overallHealth, 0) /
            healthReports.length
          )
        : 0;

    return {
      metricsRecorded: Array.from(this.metricsHistory.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
      trendsAnalyzed: this.trends.size,
      insightsGenerated: predictions.length,
      healthReportsGenerated: healthReports.length,
      averageHealthScore: avgHealth,
      topRisks: risks.slice(0, 3),
      topOpportunities: opportunities.slice(0, 3),
    };
  }
}

export const analyticsHubEngine = new AnalyticsHubEngine();
