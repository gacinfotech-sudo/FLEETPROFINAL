import { EventEmitter } from "events";

export interface ResourceMetrics {
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  utilizationRate: number; // 0-100
  avgRidesPerDay: number;
  avgRevenuePerVehicle: number;
  avgCostPerVehicle: number;
  fleetHealthScore: number;
}

export interface AllocationZone {
  zoneId: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  demand: number; // estimated rides/hour
  supply: number; // available vehicles
  optimalSupply: number; // AI recommended
  imbalanceRatio: number; // demand / supply
  priority: "critical" | "high" | "medium" | "low";
}

export interface ResourceAllocationPlan {
  planId: string;
  timestamp: Date;
  horizon: number; // hours ahead
  zones: AllocationZone[];
  actions: AllocationAction[];
  expectedImprovement: {
    utilizationGain: number; // percentage points
    revenueGain: number; // estimated ₹
    costSavings: number; // estimated ₹
    waitTimeReduction: number; // seconds
  };
  confidence: number; // 0-100
}

export interface AllocationAction {
  actionId: string;
  type: "rebalance" | "schedule" | "recall" | "activate";
  source?: string; // zone or resource pool
  destination: string;
  resourceType: "vehicle" | "driver";
  quantity: number;
  eta: number; // minutes
  cost: number;
  expectedBenefit: number;
  priority: "urgent" | "high" | "normal" | "low";
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface DriverSchedule {
  driverId: string;
  shifts: Shift[];
  weeklyHours: number;
  utilizationTarget: number; // percentage
  preferredZones?: string[];
  skills?: string[]; // vehicle types, languages, etc.
}

export interface Shift {
  shiftId: string;
  date: Date;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  assignedZone?: string;
  estimatedRides: number;
  estimatedRevenue: number;
  breaks?: { start: string; end: string }[];
  status: "scheduled" | "active" | "completed" | "cancelled";
}

export interface VehicleAllocation {
  vehicleId: string;
  currentZone: string;
  targetZone: string;
  status: "idle" | "active" | "allocated" | "maintenance";
  utilizationHours: number; // daily
  revenue: number; // daily
  costs: number; // daily
  profitMargin: number; // percentage
  maintenanceDue?: Date;
  fuelLevel: number; // percentage
}

export interface CapacityForecast {
  forecastDate: Date;
  horizon: number; // days
  expectedDemand: number[];
  recommendedSupply: number[];
  seasonalFactors: Record<string, number>;
  trendFactors: Record<string, number>;
  confidence: number;
}

class ResourceAllocationEngine extends EventEmitter {
  private zones: Map<string, AllocationZone> = new Map();
  private allocationPlans: Map<string, ResourceAllocationPlan> = new Map();
  private vehicleAllocations: Map<string, VehicleAllocation> = new Map();
  private driverSchedules: Map<string, DriverSchedule> = new Map();
  private actions: Map<string, AllocationAction> = new Map();
  private capacityForecasts: Map<string, CapacityForecast> = new Map();

  constructor() {
    super();
    this.setupDefaultZones();
  }

  private setupDefaultZones() {
    const zones: AllocationZone[] = [
      {
        zoneId: "zone_downtown",
        name: "Downtown Core",
        bounds: { north: 23.20, south: 23.15, east: 79.95, west: 79.85 },
        demand: 150,
        supply: 80,
        optimalSupply: 120,
        imbalanceRatio: 1.875,
        priority: "critical",
      },
      {
        zoneId: "zone_airport",
        name: "Airport Corridor",
        bounds: { north: 23.25, south: 23.10, east: 80.10, west: 79.90 },
        demand: 120,
        supply: 60,
        optimalSupply: 100,
        imbalanceRatio: 2.0,
        priority: "critical",
      },
      {
        zoneId: "zone_business",
        name: "Business District",
        bounds: { north: 23.22, south: 23.17, east: 80.00, west: 79.92 },
        demand: 95,
        supply: 70,
        optimalSupply: 85,
        imbalanceRatio: 1.357,
        priority: "high",
      },
      {
        zoneId: "zone_residential",
        name: "Residential Areas",
        bounds: { north: 23.30, south: 23.10, east: 79.90, west: 79.70 },
        demand: 80,
        supply: 90,
        optimalSupply: 75,
        imbalanceRatio: 0.889,
        priority: "medium",
      },
      {
        zoneId: "zone_suburbs",
        name: "Suburban Zones",
        bounds: { north: 23.40, south: 23.20, east: 80.20, west: 79.80 },
        demand: 50,
        supply: 70,
        optimalSupply: 45,
        imbalanceRatio: 0.714,
        priority: "low",
      },
    ];

    zones.forEach((zone) => {
      this.zones.set(zone.zoneId, zone);
    });
  }

  generateAllocationPlan(horizon: number = 4): ResourceAllocationPlan {
    const zones = Array.from(this.zones.values());
    const actions: AllocationAction[] = [];

    // Identify underserved zones
    const criticalZones = zones.filter((z) => z.imbalanceRatio > 1.5);
    const oversuppliedZones = zones.filter((z) => z.imbalanceRatio < 0.8);

    // Generate rebalancing actions
    for (const criticalZone of criticalZones) {
      const deficit = Math.ceil(
        criticalZone.optimalSupply - criticalZone.supply
      );

      // Find nearest oversupplied zone
      let bestSource: AllocationZone | null = null;
      let minDistance = Infinity;

      for (const sourceZone of oversuppliedZones) {
        const surplus = sourceZone.supply - sourceZone.optimalSupply;
        if (surplus > 0) {
          const distance = this.calculateZoneDistance(
            criticalZone.bounds,
            sourceZone.bounds
          );
          if (distance < minDistance) {
            minDistance = distance;
            bestSource = sourceZone;
          }
        }
      }

      if (bestSource && deficit > 0) {
        const transferQty = Math.min(
          deficit,
          bestSource.supply - bestSource.optimalSupply
        );
        const eta = Math.ceil(minDistance / 40); // Assume 40 km/h avg speed

        actions.push({
          actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "rebalance",
          source: bestSource.zoneId,
          destination: criticalZone.zoneId,
          resourceType: "vehicle",
          quantity: transferQty,
          eta,
          cost: transferQty * 50, // ₹50 per vehicle movement
          expectedBenefit: transferQty * criticalZone.demand * 200, // Estimated revenue
          priority: criticalZone.priority === "critical" ? "urgent" : "high",
          status: "pending",
        });
      }
    }

    // Calculate expected improvements
    const currentUtilization = this.calculateCurrentUtilization();
    const newUtilization =
      currentUtilization + (actions.length * 2.5); // Est 2.5% improvement per action
    const utilizationGain = Math.min(15, newUtilization - currentUtilization);
    const revenueGain = actions.reduce((sum, a) => sum + a.expectedBenefit, 0);
    const costSavings = actions.reduce((sum, a) => sum + a.cost, 0) * 0.6; // Cost reduction from optimization

    const plan: ResourceAllocationPlan = {
      planId: `plan_${Date.now()}`,
      timestamp: new Date(),
      horizon,
      zones,
      actions,
      expectedImprovement: {
        utilizationGain: Math.round(utilizationGain * 100) / 100,
        revenueGain: Math.round(revenueGain),
        costSavings: Math.round(costSavings),
        waitTimeReduction: Math.round(10 * actions.length), // seconds
      },
      confidence: 75 + Math.random() * 20,
    };

    this.allocationPlans.set(plan.planId, plan);
    this.emit("plan:generated", plan);

    return plan;
  }

  private calculateZoneDistance(
    bounds1: { north: number; south: number; east: number; west: number },
    bounds2: { north: number; south: number; east: number; west: number }
  ): number {
    // Calculate distance between zone centers
    const lat1 = (bounds1.north + bounds1.south) / 2;
    const lng1 = (bounds1.east + bounds1.west) / 2;
    const lat2 = (bounds2.north + bounds2.south) / 2;
    const lng2 = (bounds2.east + bounds2.west) / 2;

    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateCurrentUtilization(): number {
    const allocations = Array.from(this.vehicleAllocations.values());
    if (allocations.length === 0) return 0;

    const avgUtilization =
      allocations.reduce((sum, a) => sum + (a.utilizationHours / 24) * 100, 0) /
      allocations.length;
    return avgUtilization;
  }

  executeAction(actionId: string): AllocationAction | null {
    const action = this.actions.get(actionId);
    if (!action) return null;

    action.status = "in_progress";
    setTimeout(() => {
      action.status = "completed";
      this.emit("action:completed", action);
    }, action.eta * 60 * 1000);

    this.emit("action:executed", action);
    return action;
  }

  optimizeDriverSchedules(drivers: string[]): Map<string, DriverSchedule> {
    const schedules = new Map<string, DriverSchedule>();

    drivers.forEach((driverId) => {
      const shifts: Shift[] = [];

      // Create optimal weekly schedule
      for (let day = 0; day < 6; day++) {
        // 6-day work week
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + day);

        // Morning shift (6 AM - 2 PM)
        shifts.push({
          shiftId: `shift_${driverId}_${day}_morning`,
          date: new Date(shiftDate),
          startTime: "06:00",
          endTime: "14:00",
          estimatedRides: 12,
          estimatedRevenue: 2400,
          status: "scheduled",
        });

        // Evening shift (2 PM - 10 PM)
        if (Math.random() > 0.3) {
          // 70% chance of evening shift
          shifts.push({
            shiftId: `shift_${driverId}_${day}_evening`,
            date: new Date(shiftDate),
            startTime: "14:00",
            endTime: "22:00",
            estimatedRides: 14,
            estimatedRevenue: 2800,
            status: "scheduled",
          });
        }
      }

      schedules.set(driverId, {
        driverId,
        shifts,
        weeklyHours: 48,
        utilizationTarget: 85,
      });
    });

    return schedules;
  }

  forecastCapacity(days: number = 30): CapacityForecast {
    const forecast: CapacityForecast = {
      forecastDate: new Date(),
      horizon: days,
      expectedDemand: [],
      recommendedSupply: [],
      seasonalFactors: {},
      trendFactors: {},
      confidence: 80 + Math.random() * 15,
    };

    // Generate demand forecast
    const baseDemand = 2000; // rides/day baseline
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();

      // Higher demand on weekends
      const dayFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1.0;
      // Trend: slight growth
      const trendFactor = 1 + (i / days) * 0.1;
      // Random variation
      const randomFactor = 0.9 + Math.random() * 0.2;

      const demand = Math.round(baseDemand * dayFactor * trendFactor * randomFactor);
      forecast.expectedDemand.push(demand);

      // Recommended supply: 1.2x demand for comfort buffer
      forecast.recommendedSupply.push(Math.ceil(demand * 1.2));
    }

    forecast.seasonalFactors = {
      weekday: 1.0,
      weekend: 1.3,
      holiday: 1.5,
      monsoon: 1.2,
    };

    forecast.trendFactors = {
      growth: 0.15, // 15% expected growth over 30 days
      churn: -0.05,
      newMarkets: 0.08,
    };

    this.capacityForecasts.set(`forecast_${Date.now()}`, forecast);
    this.emit("forecast:generated", forecast);

    return forecast;
  }

  getResourceMetrics(): ResourceMetrics {
    const allocations = Array.from(this.vehicleAllocations.values());
    const totalVehicles = allocations.length;
    const activeVehicles = allocations.filter((a) => a.status === "active").length;
    const idleVehicles = allocations.filter((a) => a.status === "idle").length;

    const utilizationRate =
      totalVehicles > 0
        ? (activeVehicles / totalVehicles) * 100 +
          (allocations.reduce((sum, a) => sum + a.utilizationHours, 0) /
            (totalVehicles * 24)) *
            20
        : 0;

    const avgRidesPerDay =
      totalVehicles > 0
        ? allocations.reduce((sum, a) => sum + a.revenue / 200, 0) / totalVehicles
        : 0;

    const avgRevenuePerVehicle =
      totalVehicles > 0
        ? allocations.reduce((sum, a) => sum + a.revenue, 0) / totalVehicles
        : 0;

    const avgCostPerVehicle =
      totalVehicles > 0
        ? allocations.reduce((sum, a) => sum + a.costs, 0) / totalVehicles
        : 0;

    const profitMargins = allocations.map((a) => a.profitMargin);
    const fleetHealthScore =
      profitMargins.length > 0
        ? profitMargins.reduce((a, b) => a + b) / profitMargins.length
        : 0;

    return {
      totalVehicles,
      activeVehicles,
      idleVehicles,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      avgRidesPerDay: Math.round(avgRidesPerDay * 10) / 10,
      avgRevenuePerVehicle: Math.round(avgRevenuePerVehicle),
      avgCostPerVehicle: Math.round(avgCostPerVehicle),
      fleetHealthScore: Math.round(fleetHealthScore * 100) / 100,
    };
  }

  getZones(): AllocationZone[] {
    return Array.from(this.zones.values());
  }

  getActions(status?: string): AllocationAction[] {
    const actions = Array.from(this.actions.values());
    return status ? actions.filter((a) => a.status === status) : actions;
  }

  getAllocationStats(): {
    totalPlans: number;
    pendingActions: number;
    completedActions: number;
    totalRevenueOpportunity: number;
    totalCostSavings: number;
    avgConfidence: number;
    utilizationTrend: number;
  } {
    const plans = Array.from(this.allocationPlans.values());
    const actions = Array.from(this.actions.values());

    const pendingActions = actions.filter((a) => a.status === "pending").length;
    const completedActions = actions.filter((a) => a.status === "completed").length;

    const totalRevenueOpportunity = plans.reduce(
      (sum, p) => sum + p.expectedImprovement.revenueGain,
      0
    );
    const totalCostSavings = plans.reduce(
      (sum, p) => sum + p.expectedImprovement.costSavings,
      0
    );
    const avgConfidence =
      plans.length > 0
        ? plans.reduce((sum, p) => sum + p.confidence, 0) / plans.length
        : 0;

    const utilizationTrend = plans.length > 0
      ? plans[plans.length - 1].expectedImprovement.utilizationGain
      : 0;

    return {
      totalPlans: plans.length,
      pendingActions,
      completedActions,
      totalRevenueOpportunity: Math.round(totalRevenueOpportunity),
      totalCostSavings: Math.round(totalCostSavings),
      avgConfidence: Math.round(avgConfidence),
      utilizationTrend: Math.round(utilizationTrend * 100) / 100,
    };
  }
}

export const resourceAllocationEngine = new ResourceAllocationEngine();
