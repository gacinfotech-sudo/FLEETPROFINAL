import { EventEmitter } from "events";

export interface SupplyMetrics {
  route: string;
  totalVehicles: number;
  availableVehicles: number;
  activeBookings: number;
  utilizationRate: number; // 0-100
  expectedDowntime: number; // hours
  avgResponseTime: number; // minutes
}

export interface DemandMetrics {
  route: string;
  currentDemand: number; // bookings per hour
  predictedDemand: number; // next 1-2 hours
  peakDemand: number; // max bookings expected
  peakTime: Date;
  demandTrend: "increasing" | "stable" | "decreasing";
}

export interface MatchingResult {
  route: string;
  timestamp: Date;
  supply: SupplyMetrics;
  demand: DemandMetrics;
  matchRatio: number; // supply / demand (1 = perfect match)
  status: "surplus" | "balanced" | "shortage" | "critical";
  shortfall: number; // negative = surplus, positive = shortage
  recommendations: string[];
  alerts: Alert[];
  actionItems: ActionItem[];
}

export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  type: "shortage" | "surplus" | "bottleneck" | "efficiency";
  title: string;
  message: string;
  route: string;
  timestamp: Date;
  actionable: boolean;
}

export interface ActionItem {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  route: string;
  reason: string;
  estimatedImpact: string;
  estimatedTime: number; // minutes to complete
}

export interface MatchingStrategy {
  id: string;
  name: string;
  type: "rebalancing" | "incentive" | "route_optimization" | "pricing" | "booking_control";
  triggers: Record<string, any>;
  actions: string[];
  enabled: boolean;
  priority: number;
}

class DemandSupplyMatchingEngine extends EventEmitter {
  private supplyMetrics: Map<string, SupplyMetrics> = new Map();
  private demandMetrics: Map<string, DemandMetrics> = new Map();
  private matchingResults: Map<string, MatchingResult[]> = new Map();
  private alerts: Map<string, Alert[]> = new Map();
  private strategies: Map<string, MatchingStrategy> = new Map();

  constructor() {
    super();
    this.setupMatchingStrategies();
  }

  private setupMatchingStrategies() {
    const strategies: MatchingStrategy[] = [
      // Rebalancing strategies
      {
        id: "rebalance-vehicle-redistribution",
        name: "Vehicle Rebalancing",
        type: "rebalancing",
        triggers: { matchRatio: 0.5, status: "shortage" },
        actions: [
          "redistribute vehicles from surplus routes",
          "activate parked vehicles",
          "call backup drivers",
        ],
        enabled: true,
        priority: 95,
      },
      {
        id: "rebalance-driver-reassignment",
        name: "Driver Reassignment",
        type: "rebalancing",
        triggers: { matchRatio: 0.6, status: "shortage" },
        actions: [
          "reassign drivers from low-demand routes",
          "offer overtime incentives",
          "request contractor availability",
        ],
        enabled: true,
        priority: 90,
      },

      // Incentive strategies
      {
        id: "incentive-surge-pricing",
        name: "Surge Pricing Incentive",
        type: "incentive",
        triggers: { matchRatio: 0.3, status: "critical" },
        actions: [
          "trigger dynamic pricing surge",
          "offer driver bonuses for high-demand routes",
          "alert premium customers of higher rates",
        ],
        enabled: true,
        priority: 85,
      },
      {
        id: "incentive-driver-bonus",
        name: "Driver Bonus Program",
        type: "incentive",
        triggers: { matchRatio: 0.4, status: "shortage" },
        actions: [
          "offer ₹500+ bonus per ride on shortage routes",
          "accelerate payment cycles",
          "increase commission rates",
        ],
        enabled: true,
        priority: 80,
      },
      {
        id: "incentive-customer-discount",
        name: "Customer Off-Peak Discount",
        type: "incentive",
        triggers: { matchRatio: 2.5, status: "surplus" },
        actions: [
          "offer 20-30% discounts for off-peak booking",
          "promote light-traffic routes",
          "suggest nearby destination alternatives",
        ],
        enabled: true,
        priority: 70,
      },

      // Route optimization
      {
        id: "optimize-route-consolidation",
        name: "Route Consolidation",
        type: "route_optimization",
        triggers: { matchRatio: 2.0, status: "surplus" },
        actions: [
          "consolidate low-demand routes",
          "merge nearby pickup/dropoff zones",
          "suggest alternate efficient routes",
        ],
        enabled: true,
        priority: 75,
      },
      {
        id: "optimize-shared-rides",
        name: "Shared Ride Matching",
        type: "route_optimization",
        triggers: { matchRatio: 1.2, status: "balanced" },
        actions: [
          "match customers on similar routes",
          "offer 15% discount for shared rides",
          "optimize pickup/dropoff sequence",
        ],
        enabled: true,
        priority: 65,
      },

      // Pricing strategies
      {
        id: "pricing-dynamic-adjustment",
        name: "Dynamic Price Adjustment",
        type: "pricing",
        triggers: { matchRatio: 0.5, status: "shortage" },
        actions: [
          "increase base price 20-30%",
          "apply surge multiplier",
          "maintain premium tier discounts",
        ],
        enabled: true,
        priority: 85,
      },

      // Booking control
      {
        id: "control-cap-bookings",
        name: "Booking Cap Strategy",
        type: "booking_control",
        triggers: { matchRatio: 0.2, status: "critical" },
        actions: [
          "cap new bookings temporarily",
          "redirect to premium service tier",
          "queue bookings for next 2 hours",
        ],
        enabled: true,
        priority: 100,
      },
      {
        id: "control-pause-bookings",
        name: "Pause Booking Strategy",
        type: "booking_control",
        triggers: { matchRatio: 0.1, status: "critical" },
        actions: [
          "pause booking acceptance",
          "notify customers of wait times",
          "activate emergency vehicle pool",
        ],
        enabled: true,
        priority: 100,
      },
    ];

    strategies.forEach((strategy) => {
      this.strategies.set(strategy.id, strategy);
    });
  }

  updateSupply(route: string, metrics: SupplyMetrics): void {
    this.supplyMetrics.set(route, metrics);
    this.emit("supply:updated", { route, metrics });
  }

  updateDemand(route: string, metrics: DemandMetrics): void {
    this.demandMetrics.set(route, metrics);
    this.emit("demand:updated", { route, metrics });
  }

  calculateMatch(route: string): MatchingResult | null {
    const supply = this.supplyMetrics.get(route);
    const demand = this.demandMetrics.get(route);

    if (!supply || !demand) return null;

    // Calculate match ratio
    const matchRatio = supply.availableVehicles / Math.max(demand.predictedDemand, 1);

    // Determine status
    let status: "surplus" | "balanced" | "shortage" | "critical";
    if (matchRatio >= 1.5) {
      status = "surplus";
    } else if (matchRatio >= 0.8) {
      status = "balanced";
    } else if (matchRatio >= 0.3) {
      status = "shortage";
    } else {
      status = "critical";
    }

    const shortfall = demand.predictedDemand - supply.availableVehicles;

    // Generate recommendations
    const recommendations = this.generateRecommendations(supply, demand, status);

    // Generate alerts
    const alerts = this.generateAlerts(route, supply, demand, status, shortfall);

    // Generate action items
    const actionItems = this.generateActionItems(route, supply, demand, status, shortfall);

    const result: MatchingResult = {
      route,
      timestamp: new Date(),
      supply,
      demand,
      matchRatio: parseFloat(matchRatio.toFixed(2)),
      status,
      shortfall,
      recommendations,
      alerts,
      actionItems,
    };

    // Store result
    if (!this.matchingResults.has(route)) {
      this.matchingResults.set(route, []);
    }
    this.matchingResults.get(route)!.push(result);

    // Keep only last 100 results
    const results = this.matchingResults.get(route)!;
    if (results.length > 100) {
      results.shift();
    }

    this.emit("match:calculated", result);
    return result;
  }

  private generateRecommendations(
    supply: SupplyMetrics,
    demand: DemandMetrics,
    status: string
  ): string[] {
    const recommendations: string[] = [];

    if (status === "surplus") {
      recommendations.push("Excess supply available. Consider offering discounts to boost demand.");
      recommendations.push("Consolidate routes to reduce operational costs.");
      recommendations.push("Allocate surplus vehicles to high-demand routes.");
    } else if (status === "balanced") {
      recommendations.push("Supply-demand is balanced. Monitor for changes.");
      recommendations.push("Consider implementing shared rides to improve efficiency.");
    } else if (status === "shortage") {
      recommendations.push("Activate emergency vehicle pool immediately.");
      recommendations.push("Offer driver incentives to encourage additional shifts.");
      recommendations.push("Implement surge pricing to manage demand.");
    } else if (status === "critical") {
      recommendations.push("CRITICAL: Pause new bookings and activate all reserve vehicles.");
      recommendations.push("Contact partner fleets for emergency support.");
      recommendations.push("Implement maximum surge pricing to limit bookings.");
    }

    return recommendations;
  }

  private generateAlerts(
    route: string,
    supply: SupplyMetrics,
    demand: DemandMetrics,
    status: string,
    shortfall: number
  ): Alert[] {
    const alerts: Alert[] = [];

    if (status === "critical") {
      alerts.push({
        id: `alert_${Date.now()}_critical`,
        severity: "critical",
        type: "shortage",
        title: "CRITICAL: Supply Shortage",
        message: `${Math.ceil(shortfall)} vehicles needed immediately on ${route}. Demand exceeds supply by ${((shortfall / demand.predictedDemand) * 100).toFixed(0)}%.`,
        route,
        timestamp: new Date(),
        actionable: true,
      });
    } else if (status === "shortage") {
      alerts.push({
        id: `alert_${Date.now()}_shortage`,
        severity: "warning",
        type: "shortage",
        title: "Supply Shortage Alert",
        message: `${Math.ceil(shortfall)} additional vehicles needed on ${route} in next 1-2 hours.`,
        route,
        timestamp: new Date(),
        actionable: true,
      });
    }

    if (supply.utilizationRate > 90) {
      alerts.push({
        id: `alert_${Date.now()}_efficiency`,
        severity: "warning",
        type: "efficiency",
        title: "High Utilization Rate",
        message: `${supply.utilizationRate.toFixed(0)}% vehicle utilization on ${route}. Consider rebalancing.`,
        route,
        timestamp: new Date(),
        actionable: true,
      });
    }

    if (supply.avgResponseTime > 15) {
      alerts.push({
        id: `alert_${Date.now()}_bottleneck`,
        severity: "warning",
        type: "bottleneck",
        title: "Response Time Bottleneck",
        message: `Average response time is ${supply.avgResponseTime} minutes on ${route}. Customers may be waiting.`,
        route,
        timestamp: new Date(),
        actionable: true,
      });
    }

    if (status === "surplus") {
      alerts.push({
        id: `alert_${Date.now()}_surplus`,
        severity: "info",
        type: "surplus",
        title: "Excess Supply Available",
        message: `${supply.availableVehicles} idle vehicles on ${route}. Consider promotional pricing.`,
        route,
        timestamp: new Date(),
        actionable: false,
      });
    }

    return alerts;
  }

  private generateActionItems(
    route: string,
    supply: SupplyMetrics,
    demand: DemandMetrics,
    status: string,
    shortfall: number
  ): ActionItem[] {
    const actionItems: ActionItem[] = [];

    if (status === "critical") {
      actionItems.push({
        id: `action_${Date.now()}_1`,
        priority: "critical",
        action: "PAUSE BOOKINGS IMMEDIATELY",
        route,
        reason: "Critical vehicle shortage prevents accepting new bookings",
        estimatedImpact: "Prevents customer disappointment and service delays",
        estimatedTime: 5,
      });

      actionItems.push({
        id: `action_${Date.now()}_2`,
        priority: "critical",
        action: "Activate Emergency Vehicle Pool",
        route,
        reason: `Need ${Math.ceil(shortfall)} additional vehicles`,
        estimatedImpact: "Addresses 50-75% of supply gap",
        estimatedTime: 15,
      });

      actionItems.push({
        id: `action_${Date.now()}_3`,
        priority: "critical",
        action: "Contact Partner Fleets",
        route,
        reason: "Emergency vehicle support needed",
        estimatedImpact: "Can provide 10-20 vehicles within 30 min",
        estimatedTime: 10,
      });
    } else if (status === "shortage") {
      actionItems.push({
        id: `action_${Date.now()}_1`,
        priority: "high",
        action: "Activate Additional Drivers",
        route,
        reason: `${Math.ceil(shortfall)} vehicle shortage in 1-2 hours`,
        estimatedImpact: "Adds 5-10 vehicles to fleet",
        estimatedTime: 20,
      });

      actionItems.push({
        id: `action_${Date.now()}_2`,
        priority: "high",
        action: "Offer Driver Incentive Bonus",
        route,
        reason: "Encourage drivers to take extra shifts",
        estimatedImpact: "₹2,000-5,000 additional commitment cost, prevents shortage",
        estimatedTime: 10,
      });

      actionItems.push({
        id: `action_${Date.now()}_3`,
        priority: "medium",
        action: "Implement Surge Pricing",
        route,
        reason: "Manage demand to match available supply",
        estimatedImpact: "Reduces new bookings by 15-30%",
        estimatedTime: 5,
      });
    } else if (status === "surplus") {
      actionItems.push({
        id: `action_${Date.now()}_1`,
        priority: "medium",
        action: "Launch Promotional Discount",
        route,
        reason: "Excess supply available",
        estimatedImpact: "Can boost bookings 20-30%, utilize idle fleet",
        estimatedTime: 15,
      });

      actionItems.push({
        id: `action_${Date.now()}_2`,
        priority: "low",
        action: "Rebalance Vehicles to Shortage Routes",
        route,
        reason: "Optimize fleet distribution",
        estimatedImpact: "Improve overall system efficiency",
        estimatedTime: 30,
      });
    }

    return actionItems;
  }

  getMatchingHistory(route: string, limit: number = 50): MatchingResult[] {
    const results = this.matchingResults.get(route) || [];
    return results.slice(Math.max(0, results.length - limit));
  }

  getLatestAlerts(route?: string, severity?: string): Alert[] {
    const allAlerts: Alert[] = [];

    if (route) {
      allAlerts.push(...(this.alerts.get(route) || []));
    } else {
      this.alerts.forEach((alerts) => {
        allAlerts.push(...alerts);
      });
    }

    return allAlerts.filter((a) => !severity || a.severity === severity);
  }

  getSystemMetrics(): {
    totalRoutes: number;
    balancedRoutes: number;
    shortageRoutes: number;
    criticalRoutes: number;
    avgMatchRatio: number;
    totalVehicles: number;
    totalAvailableVehicles: number;
    overallUtilization: number;
  } {
    let totalRoutes = 0;
    let balancedRoutes = 0;
    let shortageRoutes = 0;
    let criticalRoutes = 0;
    let totalMatchRatio = 0;
    let totalVehicles = 0;
    let totalAvailableVehicles = 0;

    this.supplyMetrics.forEach((supply) => {
      const demand = this.demandMetrics.get(supply.route);
      if (!demand) return;

      totalRoutes++;
      totalVehicles += supply.totalVehicles;
      totalAvailableVehicles += supply.availableVehicles;

      const matchRatio = supply.availableVehicles / Math.max(demand.predictedDemand, 1);
      totalMatchRatio += matchRatio;

      if (matchRatio >= 0.8) {
        balancedRoutes++;
      } else if (matchRatio >= 0.3) {
        shortageRoutes++;
      } else {
        criticalRoutes++;
      }
    });

    return {
      totalRoutes,
      balancedRoutes,
      shortageRoutes,
      criticalRoutes,
      avgMatchRatio: totalRoutes > 0 ? parseFloat((totalMatchRatio / totalRoutes).toFixed(2)) : 0,
      totalVehicles,
      totalAvailableVehicles,
      overallUtilization: totalVehicles > 0 ? parseFloat((((totalVehicles - totalAvailableVehicles) / totalVehicles) * 100).toFixed(1)) : 0,
    };
  }

  getStrategies(status?: string): MatchingStrategy[] {
    const strategies = Array.from(this.strategies.values()).filter((s) => s.enabled);
    if (!status) return strategies;
    return strategies.filter((s) => {
      // Match status to strategy triggers
      return s.triggers.status === status;
    });
  }

  enableStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.enabled = true;
      this.emit("strategy:enabled", strategy);
      return true;
    }
    return false;
  }

  disableStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.enabled = false;
      this.emit("strategy:disabled", strategy);
      return true;
    }
    return false;
  }
}

export const demandSupplyMatchingEngine = new DemandSupplyMatchingEngine();
