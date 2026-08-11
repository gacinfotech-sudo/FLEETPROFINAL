import { EventEmitter } from "events";

export interface DriverMetrics {
  driverId: string;
  totalRides: number;
  totalDistance: number;
  totalEarnings: number;
  averageRating: number;
  acceptanceRate: number; // 0-100
  cancellationRate: number; // 0-100
  onTimePercentage: number; // 0-100
  completionRate: number; // 0-100
  customerComplaints: number;
  safetyIncidents: number; // hard braking, speeding, etc
  fuelEfficiency: number; // km/liter
  vehicleViolations: number;
  avgSpeedingInstances: number; // per 100 rides
  avgHardBrakingInstances: number; // per 100 rides
  idleTimePercentage: number; // 0-100
  weeklyEarnings: number;
  weeklyRides: number;
  joinDate: Date;
  lastRideDate: Date;
  verificationStatus: "verified" | "unverified" | "suspended" | "inactive";
}

export interface DriverScore {
  driverId: string;
  overallScore: number; // 0-100
  safetyScore: number; // 0-100
  efficiencyScore: number; // 0-100
  customerServiceScore: number; // 0-100
  reliabilityScore: number; // 0-100
  performanceGrade: "A+" | "A" | "B" | "C" | "D" | "F";
  riskLevel: "excellent" | "good" | "moderate" | "high" | "critical";
  recommendations: string[];
  earningsPotential: number; // Estimated monthly ₹
  targetEarnings: number; // Benchmark for their segment
  lastUpdated: Date;
}

export interface DriverBehaviorAlert {
  id: string;
  driverId: string;
  type: "speeding" | "harsh_braking" | "idle_time" | "customer_complaint" | "acceptance_decline" | "collision" | "maintenance_due";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  location?: string;
  timestamp: Date;
  actionTaken?: string;
}

export interface IncentiveProgram {
  driverId: string;
  week: Date;
  bonusEarned: number; // Based on performance
  rideBonus: number; // Per high-rated ride
  safetyBonus: number; // No incidents this week
  efficiencyBonus: number; // Fuel efficiency bonus
  customerServiceBonus: number; // High ratings
  totalPotential: number;
  unlocked: boolean;
}

class DriverIntelligenceEngine extends EventEmitter {
  private driverMetrics: Map<string, DriverMetrics> = new Map();
  private driverScores: Map<string, DriverScore> = new Map();
  private behaviorAlerts: Map<string, DriverBehaviorAlert[]> = new Map();
  private incentivePrograms: Map<string, IncentiveProgram[]> = new Map();
  private performanceHistory: Map<string, DriverScore[]> = new Map();

  constructor() {
    super();
  }

  updateDriverMetrics(driverId: string, metrics: Partial<DriverMetrics>): void {
    const existing = this.driverMetrics.get(driverId) || {
      driverId,
      totalRides: 0,
      totalDistance: 0,
      totalEarnings: 0,
      averageRating: 4.5,
      acceptanceRate: 95,
      cancellationRate: 5,
      onTimePercentage: 92,
      completionRate: 98,
      customerComplaints: 0,
      safetyIncidents: 0,
      fuelEfficiency: 6.5,
      vehicleViolations: 0,
      avgSpeedingInstances: 0,
      avgHardBrakingInstances: 0,
      idleTimePercentage: 5,
      weeklyEarnings: 8000,
      weeklyRides: 25,
      joinDate: new Date(),
      lastRideDate: new Date(),
      verificationStatus: "verified" as const,
    };

    const updated = { ...existing, ...metrics };
    this.driverMetrics.set(driverId, updated);

    // Calculate score
    this.calculateDriverScore(driverId, updated);

    // Check for alerts
    this.checkBehaviorAlerts(driverId, updated);

    // Calculate incentives
    this.calculateIncentives(driverId, updated);

    this.emit("driver:updated", { driverId, metrics: updated });
  }

  private calculateDriverScore(driverId: string, metrics: DriverMetrics): void {
    // Safety Score (0-100)
    const safetyScore = Math.max(
      0,
      100 -
        (metrics.safetyIncidents * 10 +
         metrics.avgSpeedingInstances * 2 +
         metrics.avgHardBrakingInstances * 3 +
         metrics.customerComplaints * 5)
    );

    // Efficiency Score (0-100)
    const efficiencyScore = Math.max(
      0,
      (metrics.fuelEfficiency / 8) * 50 + // Max 50 points for fuel
        Math.min(50, (100 - metrics.idleTimePercentage) / 2) // Max 50 points for idle time
    );

    // Customer Service Score (0-100)
    const customerServiceScore =
      (metrics.averageRating / 5) * 50 + // 50 points for rating
      Math.min(50, metrics.acceptanceRate / 2); // 50 points for acceptance

    // Reliability Score (0-100)
    const reliabilityScore =
      (metrics.onTimePercentage / 100) * 50 + // 50 points for on-time
      (metrics.completionRate / 100) * 50; // 50 points for completion

    // Overall Score (weighted average)
    const overallScore =
      safetyScore * 0.3 +
      efficiencyScore * 0.2 +
      customerServiceScore * 0.25 +
      reliabilityScore * 0.25;

    // Grade assignment
    let performanceGrade: "A+" | "A" | "B" | "C" | "D" | "F";
    if (overallScore >= 95) performanceGrade = "A+";
    else if (overallScore >= 85) performanceGrade = "A";
    else if (overallScore >= 75) performanceGrade = "B";
    else if (overallScore >= 60) performanceGrade = "C";
    else if (overallScore >= 45) performanceGrade = "D";
    else performanceGrade = "F";

    // Risk level
    let riskLevel: "excellent" | "good" | "moderate" | "high" | "critical";
    if (overallScore >= 90) riskLevel = "excellent";
    else if (overallScore >= 75) riskLevel = "good";
    else if (overallScore >= 60) riskLevel = "moderate";
    else if (overallScore >= 40) riskLevel = "high";
    else riskLevel = "critical";

    // Earnings potential
    const earningsPotential = metrics.weeklyRides *
      (300 + (overallScore / 100) * 200) * 4.3; // Monthly estimate

    // Recommendations
    const recommendations = this.generateRecommendations(metrics, safetyScore, efficiencyScore);

    const score: DriverScore = {
      driverId,
      overallScore: Math.round(overallScore),
      safetyScore: Math.round(safetyScore),
      efficiencyScore: Math.round(efficiencyScore),
      customerServiceScore: Math.round(customerServiceScore),
      reliabilityScore: Math.round(reliabilityScore),
      performanceGrade,
      riskLevel,
      recommendations,
      earningsPotential: Math.round(earningsPotential),
      targetEarnings: 45000, // Benchmark
      lastUpdated: new Date(),
    };

    this.driverScores.set(driverId, score);

    // Store history
    if (!this.performanceHistory.has(driverId)) {
      this.performanceHistory.set(driverId, []);
    }
    this.performanceHistory.get(driverId)!.push(score);

    // Keep last 52 scores (weekly)
    const history = this.performanceHistory.get(driverId)!;
    if (history.length > 52) {
      history.shift();
    }

    this.emit("driver:scored", score);
  }

  private generateRecommendations(
    metrics: DriverMetrics,
    safetyScore: number,
    efficiencyScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (safetyScore < 70) {
      recommendations.push("⚠️ Safety Score Low - Review dashcam footage and attend safety training");
    }

    if (metrics.avgSpeedingInstances > 5) {
      recommendations.push("📍 Reduce Speeding - Maintain speed limits for safety and fuel efficiency");
    }

    if (metrics.avgHardBrakingInstances > 3) {
      recommendations.push("🛑 Improve Braking - Anticipate traffic and brake smoothly");
    }

    if (efficiencyScore < 60) {
      recommendations.push("⛽ Fuel Efficiency - Reduce idle time and maintain steady acceleration");
    }

    if (metrics.acceptanceRate < 90) {
      recommendations.push("📞 Increase Acceptance - Accept more rides to boost earnings");
    }

    if (metrics.averageRating < 4.5) {
      recommendations.push("⭐ Improve Ratings - Focus on customer service and cleanliness");
    }

    if (metrics.completionRate < 95) {
      recommendations.push("✅ Reduce Cancellations - Minimize ride cancellations");
    }

    if (metrics.verificationStatus === "unverified") {
      recommendations.push("🔒 Complete Verification - Pass background check for better opportunities");
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ Excellent Performance - Keep maintaining high standards");
    }

    return recommendations;
  }

  private checkBehaviorAlerts(driverId: string, metrics: DriverMetrics): void {
    const alerts: DriverBehaviorAlert[] = [];

    if (metrics.avgSpeedingInstances > 10) {
      alerts.push({
        id: `alert_${Date.now()}_speed`,
        driverId,
        type: "speeding",
        severity: metrics.avgSpeedingInstances > 20 ? "critical" : "high",
        message: `${metrics.avgSpeedingInstances} speeding instances detected in recent rides`,
        timestamp: new Date(),
      });
    }

    if (metrics.avgHardBrakingInstances > 5) {
      alerts.push({
        id: `alert_${Date.now()}_brake`,
        driverId,
        type: "harsh_braking",
        severity: metrics.avgHardBrakingInstances > 10 ? "critical" : "high",
        message: `${metrics.avgHardBrakingInstances} harsh braking instances detected`,
        timestamp: new Date(),
      });
    }

    if (metrics.idleTimePercentage > 15) {
      alerts.push({
        id: `alert_${Date.now()}_idle`,
        driverId,
        type: "idle_time",
        severity: "medium",
        message: `High idle time: ${metrics.idleTimePercentage}% of ride time spent idling`,
        timestamp: new Date(),
      });
    }

    if (metrics.customerComplaints > 2) {
      alerts.push({
        id: `alert_${Date.now()}_complaint`,
        driverId,
        type: "customer_complaint",
        severity: metrics.customerComplaints > 5 ? "critical" : "high",
        message: `${metrics.customerComplaints} customer complaints received`,
        timestamp: new Date(),
      });
    }

    if (metrics.acceptanceRate < 80) {
      alerts.push({
        id: `alert_${Date.now()}_acceptance`,
        driverId,
        type: "acceptance_decline",
        severity: "medium",
        message: `Low acceptance rate: ${metrics.acceptanceRate}%. May lose priority booking access`,
        timestamp: new Date(),
      });
    }

    if (metrics.verificationStatus === "suspended") {
      alerts.push({
        id: `alert_${Date.now()}_suspended`,
        driverId,
        type: "collision",
        severity: "critical",
        message: "Account suspended. Contact support to resolve issues",
        timestamp: new Date(),
      });
    }

    this.behaviorAlerts.set(driverId, alerts);
  }

  private calculateIncentives(driverId: string, metrics: DriverMetrics): void {
    const week = this.getWeekStart(new Date());
    let bonusEarned = 0;

    // Ride quality bonus (₹50 per high-rated ride)
    if (metrics.averageRating >= 4.8) {
      bonusEarned += metrics.weeklyRides * 50;
    } else if (metrics.averageRating >= 4.5) {
      bonusEarned += metrics.weeklyRides * 30;
    }

    // Safety bonus (₹500 if no incidents this week)
    if (metrics.safetyIncidents === 0) {
      bonusEarned += 500;
    }

    // Efficiency bonus (₹200 if above 6.5 km/liter)
    if (metrics.fuelEfficiency >= 6.5) {
      bonusEarned += 200;
    }

    // Customer service bonus (₹300 if rating ≥ 4.8)
    if (metrics.averageRating >= 4.8) {
      bonusEarned += 300;
    }

    const totalPotential = metrics.weeklyEarnings + bonusEarned;

    const incentive: IncentiveProgram = {
      driverId,
      week,
      bonusEarned,
      rideBonus: metrics.averageRating >= 4.5 ? metrics.weeklyRides * 30 : 0,
      safetyBonus: metrics.safetyIncidents === 0 ? 500 : 0,
      efficiencyBonus: metrics.fuelEfficiency >= 6.5 ? 200 : 0,
      customerServiceBonus: metrics.averageRating >= 4.8 ? 300 : 0,
      totalPotential,
      unlocked: bonusEarned > 0,
    };

    if (!this.incentivePrograms.has(driverId)) {
      this.incentivePrograms.set(driverId, []);
    }
    this.incentivePrograms.get(driverId)!.push(incentive);

    this.emit("driver:incentive", incentive);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  getDriverScore(driverId: string): DriverScore | null {
    return this.driverScores.get(driverId) || null;
  }

  getDriverAlerts(driverId: string): DriverBehaviorAlert[] {
    return this.behaviorAlerts.get(driverId) || [];
  }

  getIncentives(driverId: string): IncentiveProgram[] {
    return this.incentivePrograms.get(driverId) || [];
  }

  getPerformanceHistory(driverId: string, limit: number = 52): DriverScore[] {
    const history = this.performanceHistory.get(driverId) || [];
    return history.slice(Math.max(0, history.length - limit));
  }

  getFleetStats(): {
    totalDrivers: number;
    avgOverallScore: number;
    avgRating: number;
    avgAcceptanceRate: number;
    safetyIncidents: number;
    highPerformers: string[];
    needsAttention: string[];
  } {
    const drivers = Array.from(this.driverMetrics.values());
    const scores = Array.from(this.driverScores.values());

    const totalDrivers = drivers.length;
    const avgOverallScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length)
      : 0;

    const avgRating = totalDrivers > 0
      ? parseFloat((drivers.reduce((sum, d) => sum + d.averageRating, 0) / totalDrivers).toFixed(2))
      : 0;

    const avgAcceptanceRate = totalDrivers > 0
      ? Math.round(drivers.reduce((sum, d) => sum + d.acceptanceRate, 0) / totalDrivers)
      : 0;

    const safetyIncidents = drivers.reduce((sum, d) => sum + d.safetyIncidents, 0);

    const highPerformers = scores
      .filter((s) => s.performanceGrade === "A+" || s.performanceGrade === "A")
      .map((s) => s.driverId)
      .slice(0, 10);

    const needsAttention = scores
      .filter((s) => s.riskLevel === "critical" || s.riskLevel === "high")
      .map((s) => s.driverId)
      .slice(0, 10);

    return {
      totalDrivers,
      avgOverallScore,
      avgRating,
      avgAcceptanceRate,
      safetyIncidents,
      highPerformers,
      needsAttention,
    };
  }
}

export const driverIntelligenceEngine = new DriverIntelligenceEngine();
