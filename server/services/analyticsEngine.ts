import { EventEmitter } from "events";

export interface AnalyticsMetric {
  timestamp: Date;
  name: string;
  value: number;
  category: "revenue" | "bookings" | "efficiency" | "quality";
  comparison?: {
    previous: number;
    change: number;
    percentChange: number;
  };
}

export interface BusinessInsight {
  id: string;
  type: "opportunity" | "warning" | "anomaly" | "prediction" | "recommendation";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  metric: string;
  impact: string;
  suggestedAction: string;
  confidence: number; // 0-100
  timestamp: Date;
}

export interface PredictedDemand {
  timeSlot: string;
  predictedBookings: number;
  confidence: number;
  recommendedVehicles: number;
  recommendedDrivers: number;
  peakHours: string[];
}

class AnalyticsEngine extends EventEmitter {
  private metrics: Map<string, AnalyticsMetric[]> = new Map();
  private insights: Map<string, BusinessInsight> = new Map();
  private predictions: Map<string, PredictedDemand> = new Map();

  constructor() {
    super();
    this.initializeMetrics();
    this.setupAnalyticsWorker();
  }

  private initializeMetrics() {
    const metricNames = [
      "total_bookings",
      "completed_bookings",
      "cancelled_bookings",
      "total_revenue",
      "average_fare",
      "completion_rate",
      "customer_satisfaction",
      "driver_utilization",
      "vehicle_utilization",
      "payment_collection_rate",
      "average_trip_duration",
      "average_trip_distance",
      "repeat_customer_rate",
    ];

    metricNames.forEach((name) => {
      this.metrics.set(name, []);
    });
  }

  private setupAnalyticsWorker() {
    // Run analytics every 5 minutes
    setInterval(() => {
      this.generateInsights();
      this.generatePredictions();
      this.detectAnomalies();
    }, 5 * 60 * 1000);
  }

  recordMetric(
    name: string,
    value: number,
    category: "revenue" | "bookings" | "efficiency" | "quality"
  ) {
    const metrics = this.metrics.get(name) || [];

    const metric: AnalyticsMetric = {
      timestamp: new Date(),
      name,
      value,
      category,
      comparison: this.calculateComparison(name, value, metrics),
    };

    metrics.push(metric);
    // Keep only last 1000 records per metric
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.metrics.set(name, metrics);
    this.emit("metric:recorded", metric);
  }

  private calculateComparison(
    metricName: string,
    currentValue: number,
    history: AnalyticsMetric[]
  ): { previous: number; change: number; percentChange: number } | undefined {
    if (history.length === 0) return undefined;

    const previousValue = history[history.length - 1].value;
    const change = currentValue - previousValue;
    const percentChange = (change / previousValue) * 100;

    return {
      previous: previousValue,
      change,
      percentChange,
    };
  }

  private generateInsights() {
    console.log("📊 Generating business insights...");

    const insights: BusinessInsight[] = [];

    // Get current metrics
    const totalBookings = this.getLatestMetric("total_bookings") || 0;
    const completedBookings = this.getLatestMetric("completed_bookings") || 0;
    const totalRevenue = this.getLatestMetric("total_revenue") || 0;
    const completionRate = this.getLatestMetric("completion_rate") || 0;
    const driverUtilization = this.getLatestMetric("driver_utilization") || 0;
    const vehicleUtilization = this.getLatestMetric("vehicle_utilization") || 0;
    const paymentCollectionRate = this.getLatestMetric("payment_collection_rate") || 0;
    const repeatCustomerRate = this.getLatestMetric("repeat_customer_rate") || 0;
    const customerSatisfaction = this.getLatestMetric("customer_satisfaction") || 0;

    // Insight 1: Low Completion Rate
    if (completionRate < 85) {
      insights.push({
        id: `insight_${Date.now()}_completion`,
        type: "warning",
        priority: "high",
        title: "⚠️ Low Completion Rate Detected",
        description: `Completion rate is ${completionRate}%. Cancellations are higher than target.`,
        metric: "completion_rate",
        impact: "Lost revenue from cancellations. Reduced customer trust.",
        suggestedAction: "Analyze top cancellation reasons. Improve vehicle availability.",
        confidence: 95,
        timestamp: new Date(),
      });
    }

    // Insight 2: High Driver Utilization
    if (driverUtilization > 90) {
      insights.push({
        id: `insight_${Date.now()}_driver`,
        type: "warning",
        priority: "high",
        title: "🚨 Driver Shortage Alert",
        description: `Driver utilization is ${driverUtilization}%. High risk of service delays.`,
        metric: "driver_utilization",
        impact: "Risk of trip delays. Customer satisfaction may decrease.",
        suggestedAction: "Onboard more drivers. Offer signing bonus.",
        confidence: 92,
        timestamp: new Date(),
      });
    }

    // Insight 3: Low Vehicle Utilization
    if (vehicleUtilization < 40) {
      insights.push({
        id: `insight_${Date.now()}_vehicle`,
        type: "opportunity",
        priority: "medium",
        title: "💰 Under-utilized Fleet",
        description: `Vehicle utilization is ${vehicleUtilization}%. Fleet not fully optimized.`,
        metric: "vehicle_utilization",
        impact: "Potential revenue loss from unused vehicles.",
        suggestedAction: "Promote discount rides. Adjust pricing strategy.",
        confidence: 88,
        timestamp: new Date(),
      });
    }

    // Insight 4: High Repeat Customer Rate
    if (repeatCustomerRate > 50) {
      insights.push({
        id: `insight_${Date.now()}_repeat`,
        type: "opportunity",
        priority: "medium",
        title: "✨ Strong Customer Loyalty",
        description: `${repeatCustomerRate}% of bookings are from repeat customers.`,
        metric: "repeat_customer_rate",
        impact: "High customer lifetime value. Stable revenue stream.",
        suggestedAction: "Launch loyalty program. Offer referral incentives.",
        confidence: 94,
        timestamp: new Date(),
      });
    }

    // Insight 5: Low Payment Collection
    if (paymentCollectionRate < 95) {
      insights.push({
        id: `insight_${Date.now()}_payment`,
        type: "warning",
        priority: "high",
        title: "💳 Payment Collection Issue",
        description: `Only ${paymentCollectionRate}% of payments collected. ${(100 - paymentCollectionRate).toFixed(1)}% pending.`,
        metric: "payment_collection_rate",
        impact: `Uncollected revenue: ₹${Math.round(totalRevenue * (100 - paymentCollectionRate) / 100)}`,
        suggestedAction: "Send payment reminders. Offer flexible payment options.",
        confidence: 96,
        timestamp: new Date(),
      });
    }

    // Insight 6: Low Customer Satisfaction
    if (customerSatisfaction < 4.0) {
      insights.push({
        id: `insight_${Date.now()}_satisfaction`,
        type: "warning",
        priority: "critical",
        title: "🚨 Customer Satisfaction Declining",
        description: `Average rating is ${customerSatisfaction}/5. Below target.`,
        metric: "customer_satisfaction",
        impact: "Risk of customer churn. Negative reviews and word-of-mouth.",
        suggestedAction: "Investigate low ratings. Improve driver training. Upgrade vehicles.",
        confidence: 93,
        timestamp: new Date(),
      });
    }

    // Insight 7: Revenue Trend
    const revenueChange = this.calculateTrend("total_revenue");
    if (revenueChange < -5) {
      insights.push({
        id: `insight_${Date.now()}_revenue`,
        type: "warning",
        priority: "high",
        title: "📉 Revenue Declining",
        description: `Revenue down ${Math.abs(revenueChange).toFixed(1)}% compared to previous period.`,
        metric: "total_revenue",
        impact: `Potential lost revenue of ₹${Math.round(totalRevenue * Math.abs(revenueChange) / 100)}.`,
        suggestedAction: "Analyze market trends. Adjust pricing. Launch promotional campaigns.",
        confidence: 87,
        timestamp: new Date(),
      });
    }

    if (revenueChange > 10) {
      insights.push({
        id: `insight_${Date.now()}_revenue_growth`,
        type: "opportunity",
        priority: "medium",
        title: "📈 Strong Revenue Growth",
        description: `Revenue up ${revenueChange.toFixed(1)}% compared to previous period.`,
        metric: "total_revenue",
        impact: `Additional revenue: ₹${Math.round(totalRevenue * revenueChange / 100)}.`,
        suggestedAction: "Capitalize on momentum. Expand to new areas. Increase marketing.",
        confidence: 91,
        timestamp: new Date(),
      });
    }

    // Store insights
    insights.forEach((insight) => {
      this.insights.set(insight.id, insight);
    });

    // Emit insights event
    this.emit("insights:generated", {
      count: insights.length,
      insights,
      criticalCount: insights.filter((i) => i.priority === "critical").length,
      highCount: insights.filter((i) => i.priority === "high").length,
    });
  }

  private generatePredictions() {
    console.log("🔮 Generating demand predictions...");

    const predictions: PredictedDemand[] = [];

    // Predict for next 4 time slots (morning, afternoon, evening, night)
    const timeSlots = [
      { name: "Morning (6-9 AM)", offset: 1 },
      { name: "Afternoon (12-3 PM)", offset: 4 },
      { name: "Evening (5-8 PM)", offset: 7 },
      { name: "Night (8-11 PM)", offset: 10 },
    ];

    timeSlots.forEach(({ name, offset }) => {
      const baseDemand = this.getLatestMetric("total_bookings") || 20;
      const trend = this.calculateTrend("total_bookings");

      // Simple prediction: base + trend + seasonal adjustment
      const seasonalFactor = this.getSeasonalFactor(offset);
      const predictedBookings = Math.round(
        baseDemand * (1 + trend / 100) * seasonalFactor
      );

      const prediction: PredictedDemand = {
        timeSlot: name,
        predictedBookings,
        confidence: 75 + Math.random() * 20, // 75-95%
        recommendedVehicles: Math.ceil(predictedBookings / 3), // ~3 bookings per vehicle
        recommendedDrivers: Math.ceil(predictedBookings / 2.5), // ~2.5 bookings per driver
        peakHours: this.predictPeakHours(offset),
      };

      predictions.push(prediction);
      this.predictions.set(name, prediction);
    });

    this.emit("predictions:generated", predictions);
  }

  private detectAnomalies() {
    console.log("🔍 Detecting anomalies...");

    const anomalies: BusinessInsight[] = [];

    // Check for unusual patterns
    const completionRate = this.getLatestMetric("completion_rate") || 0;
    const averageFare = this.getLatestMetric("average_fare") || 0;
    const tripDuration = this.getLatestMetric("average_trip_duration") || 0;

    // Anomaly 1: Completion rate dropped suddenly
    const completionHistory = this.metrics.get("completion_rate") || [];
    if (completionHistory.length > 5) {
      const recent = completionHistory.slice(-5);
      const avg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
      if (Math.abs(completionRate - avg) > 15) {
        anomalies.push({
          id: `anomaly_${Date.now()}_completion`,
          type: "anomaly",
          priority: "high",
          title: "🚨 Unusual Completion Rate Drop",
          description: `Completion rate dropped from ${avg.toFixed(1)}% to ${completionRate}%.`,
          metric: "completion_rate",
          impact: "Possible service issue or external factor.",
          suggestedAction: "Investigate recent changes. Check driver feedback.",
          confidence: 89,
          timestamp: new Date(),
        });
      }
    }

    // Anomaly 2: Average fare changed significantly
    const fareHistory = this.metrics.get("average_fare") || [];
    if (fareHistory.length > 10) {
      const avgFare = fareHistory.slice(-10).reduce((sum, m) => sum + m.value, 0) / 10;
      if (Math.abs(averageFare - avgFare) / avgFare > 0.25) {
        anomalies.push({
          id: `anomaly_${Date.now()}_fare`,
          type: "anomaly",
          priority: "medium",
          title: "💰 Unusual Fare Change",
          description: `Average fare changed from ₹${avgFare.toFixed(0)} to ₹${averageFare.toFixed(0)}.`,
          metric: "average_fare",
          impact: "Could be due to distance, demand, or pricing changes.",
          suggestedAction: "Review pricing rules and recent route changes.",
          confidence: 81,
          timestamp: new Date(),
        });
      }
    }

    anomalies.forEach((anomaly) => {
      this.insights.set(anomaly.id, anomaly);
    });

    this.emit("anomalies:detected", anomalies);
  }

  private calculateTrend(metricName: string): number {
    const history = this.metrics.get(metricName) || [];
    if (history.length < 2) return 0;

    const recent = history.slice(-10); // Last 10 records
    if (recent.length < 2) return 0;

    const oldAvg = recent.slice(0, 5).reduce((sum, m) => sum + m.value, 0) / 5;
    const newAvg = recent.slice(-5).reduce((sum, m) => sum + m.value, 0) / 5;

    return ((newAvg - oldAvg) / oldAvg) * 100;
  }

  private getSeasonalFactor(timeOfDay: number): number {
    // 0-6: Night (low), 6-9: Morning (high), 9-12: Mid-day (medium)
    // 12-17: Afternoon (high), 17-21: Evening (very high), 21-24: Night (low)
    const factors: Record<number, number> = {
      1: 0.8, // Early morning
      4: 1.0, // Mid morning
      7: 1.3, // Rush hour
      10: 0.9, // Late afternoon
    };

    return factors[timeOfDay] || 1.0;
  }

  private predictPeakHours(offset: number): string[] {
    // Simple peak hour prediction
    if (offset === 1) return ["7-9 AM"]; // Morning rush
    if (offset === 4) return ["1-3 PM"]; // Lunch time
    if (offset === 7) return ["5:30-8 PM"]; // Evening rush
    if (offset === 10) return ["9-11 PM"]; // Night traffic
    return [];
  }

  private getLatestMetric(metricName: string): number | null {
    const history = this.metrics.get(metricName) || [];
    if (history.length === 0) return null;
    return history[history.length - 1].value;
  }

  getMetricHistory(metricName: string, limit: number = 50): AnalyticsMetric[] {
    const history = this.metrics.get(metricName) || [];
    return history.slice(-limit);
  }

  getInsights(
    type?: "opportunity" | "warning" | "anomaly" | "prediction" | "recommendation",
    priority?: "critical" | "high" | "medium" | "low"
  ): BusinessInsight[] {
    let insights = Array.from(this.insights.values());

    if (type) {
      insights = insights.filter((i) => i.type === type);
    }

    if (priority) {
      insights = insights.filter((i) => i.priority === priority);
    }

    return insights.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getPredictions(): PredictedDemand[] {
    return Array.from(this.predictions.values());
  }

  getAnalyticsSummary() {
    const insights = this.getInsights();
    const predictions = this.getPredictions();

    return {
      metrics: {
        totalMetricsTracked: this.metrics.size,
        metricsWithData: Array.from(this.metrics.entries()).filter(
          ([, data]) => data.length > 0
        ).length,
      },
      insights: {
        total: insights.length,
        critical: insights.filter((i) => i.priority === "critical").length,
        high: insights.filter((i) => i.priority === "high").length,
        medium: insights.filter((i) => i.priority === "medium").length,
        byType: {
          opportunities: insights.filter((i) => i.type === "opportunity").length,
          warnings: insights.filter((i) => i.type === "warning").length,
          anomalies: insights.filter((i) => i.type === "anomaly").length,
        },
      },
      predictions: {
        total: predictions.length,
        averageConfidence: Math.round(
          predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
        ),
      },
      timestamp: new Date(),
    };
  }
}

export const analyticsEngine = new AnalyticsEngine();
