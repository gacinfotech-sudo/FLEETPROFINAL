import { EventEmitter } from "events";

export interface VehicleHealthMetrics {
  vehicleId: string;
  mileage: number;
  age: number; // months
  engineHours: number;
  lastServiceDate: Date;
  nextServiceDate: Date;
  fuelEfficiency: number; // km/liter
  engineOilLevel: number; // 0-100%
  coolantLevel: number; // 0-100%
  brakePadWear: number; // 0-100% (0 = new, 100 = worn)
  tireCondition: number; // 0-100 (100 = perfect)
  batteryHealth: number; // 0-100%
  transmissionFluidLevel: number; // 0-100%
  faultCodes: string[];
  lastDiagnosticDate: Date;
}

export interface MaintenancePrediction {
  vehicleId: string;
  component: string;
  failureRisk: number; // 0-100
  estimatedDaysToFailure: number;
  recommendedAction: "immediate" | "urgent" | "scheduled" | "monitor";
  priority: "critical" | "high" | "medium" | "low";
  estimatedCost: number;
  serviceType: string;
  reason: string;
  timestamp: Date;
}

export interface FleetHealthReport {
  timestamp: Date;
  totalVehicles: number;
  healthyVehicles: number;
  warningVehicles: number;
  criticalVehicles: number;
  healthScore: number; // 0-100
  averageMileage: number;
  averageAge: number;
  upcomingServices: MaintenancePrediction[];
  costProjection: {
    nextMonth: number;
    next3Months: number;
    next6Months: number;
  };
  recommendations: string[];
}

export interface ServiceSchedule {
  vehicleId: string;
  serviceType: string; // "oil_change", "tire_rotation", "brake_service", "coolant_flush", etc.
  dueDate: Date;
  estimatedDuration: number; // minutes
  estimatedCost: number;
  priority: "critical" | "high" | "medium" | "low";
  status: "pending" | "scheduled" | "in_progress" | "completed" | "overdue";
}

interface ComponentThresholds {
  [key: string]: {
    critical: number;
    warning: number;
    safe: number;
  };
}

class PredictiveMaintenanceEngine extends EventEmitter {
  private vehicleMetrics: Map<string, VehicleHealthMetrics> = new Map();
  private predictions: Map<string, MaintenancePrediction[]> = new Map();
  private schedules: Map<string, ServiceSchedule[]> = new Map();
  private healthHistory: Map<string, FleetHealthReport[]> = new Map();

  private componentThresholds: ComponentThresholds = {
    engineOilLevel: { critical: 20, warning: 40, safe: 70 },
    coolantLevel: { critical: 20, warning: 40, safe: 70 },
    brakePadWear: { critical: 80, warning: 60, safe: 40 },
    tireCondition: { critical: 30, warning: 50, safe: 80 },
    batteryHealth: { critical: 40, warning: 60, safe: 85 },
    transmissionFluidLevel: { critical: 20, warning: 40, safe: 70 },
    fuelEfficiency: { critical: 3, warning: 4.5, safe: 6 },
  };

  private maintenanceIntervals = {
    oil_change: 5000, // km
    tire_rotation: 10000,
    air_filter: 15000,
    cabin_filter: 15000,
    brake_service: 50000,
    transmission_fluid: 60000,
    coolant_flush: 100000,
    spark_plugs: 30000,
    suspension_check: 20000,
  };

  constructor() {
    super();
  }

  updateVehicleMetrics(vehicleId: string, metrics: Partial<VehicleHealthMetrics>): void {
    const existing = this.vehicleMetrics.get(vehicleId) || {
      vehicleId,
      mileage: 0,
      age: 0,
      engineHours: 0,
      lastServiceDate: new Date(),
      nextServiceDate: new Date(),
      fuelEfficiency: 6,
      engineOilLevel: 100,
      coolantLevel: 100,
      brakePadWear: 0,
      tireCondition: 100,
      batteryHealth: 100,
      transmissionFluidLevel: 100,
      faultCodes: [],
      lastDiagnosticDate: new Date(),
    };

    const updated = { ...existing, ...metrics };
    this.vehicleMetrics.set(vehicleId, updated);

    // Auto-generate predictions
    this.predictMaintenance(vehicleId, updated);

    this.emit("vehicle:updated", { vehicleId, metrics: updated });
  }

  predictMaintenance(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];

    // Check each component
    predictions.push(...this.checkOilHealth(vehicleId, metrics));
    predictions.push(...this.checkCoolantHealth(vehicleId, metrics));
    predictions.push(...this.checkBrakeHealth(vehicleId, metrics));
    predictions.push(...this.checkTireHealth(vehicleId, metrics));
    predictions.push(...this.checkBatteryHealth(vehicleId, metrics));
    predictions.push(...this.checkTransmissionHealth(vehicleId, metrics));
    predictions.push(...this.checkScheduledServices(vehicleId, metrics));
    predictions.push(...this.checkFaultCodes(vehicleId, metrics));

    // Store predictions
    this.predictions.set(vehicleId, predictions);

    // Generate service schedules
    this.generateServiceSchedules(vehicleId, predictions);

    // Sort by priority
    predictions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    this.emit("maintenance:predicted", { vehicleId, predictions });
    return predictions;
  }

  private checkOilHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.engineOilLevel;

    if (metrics.engineOilLevel <= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Engine Oil",
        failureRisk: 95,
        estimatedDaysToFailure: 1,
        recommendedAction: "immediate",
        priority: "critical",
        estimatedCost: 1500,
        serviceType: "oil_change",
        reason: `Oil level critically low at ${metrics.engineOilLevel}%. Risk of engine damage.`,
        timestamp: new Date(),
      });
    } else if (metrics.engineOilLevel <= thresholds.warning) {
      predictions.push({
        vehicleId,
        component: "Engine Oil",
        failureRisk: 75,
        estimatedDaysToFailure: 3,
        recommendedAction: "urgent",
        priority: "high",
        estimatedCost: 1500,
        serviceType: "oil_change",
        reason: `Oil level low at ${metrics.engineOilLevel}%. Schedule oil change within 3 days.`,
        timestamp: new Date(),
      });
    }

    // Check mileage-based oil change
    const kmSinceLastService = metrics.mileage -
      (this.vehicleMetrics.get(vehicleId)?.mileage || metrics.mileage - 5000);
    if (kmSinceLastService >= this.maintenanceIntervals.oil_change) {
      predictions.push({
        vehicleId,
        component: "Engine Oil",
        failureRisk: 60,
        estimatedDaysToFailure: 7,
        recommendedAction: "scheduled",
        priority: "medium",
        estimatedCost: 1500,
        serviceType: "oil_change",
        reason: `${kmSinceLastService} km since last oil change. Due for scheduled service.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkCoolantHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.coolantLevel;

    if (metrics.coolantLevel <= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Coolant",
        failureRisk: 90,
        estimatedDaysToFailure: 2,
        recommendedAction: "immediate",
        priority: "critical",
        estimatedCost: 2000,
        serviceType: "coolant_check",
        reason: `Coolant level critically low at ${metrics.coolantLevel}%. Risk of engine overheating.`,
        timestamp: new Date(),
      });
    } else if (metrics.coolantLevel <= thresholds.warning) {
      predictions.push({
        vehicleId,
        component: "Coolant",
        failureRisk: 70,
        estimatedDaysToFailure: 5,
        recommendedAction: "urgent",
        priority: "high",
        estimatedCost: 2000,
        serviceType: "coolant_check",
        reason: `Coolant level low at ${metrics.coolantLevel}%. Refill needed soon.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkBrakeHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.brakePadWear;

    if (metrics.brakePadWear >= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Brake Pads",
        failureRisk: 95,
        estimatedDaysToFailure: 1,
        recommendedAction: "immediate",
        priority: "critical",
        estimatedCost: 4000,
        serviceType: "brake_service",
        reason: `Brake pads severely worn at ${metrics.brakePadWear}%. Safety hazard - replace immediately.`,
        timestamp: new Date(),
      });
    } else if (metrics.brakePadWear >= thresholds.warning) {
      predictions.push({
        vehicleId,
        component: "Brake Pads",
        failureRisk: 80,
        estimatedDaysToFailure: 7,
        recommendedAction: "urgent",
        priority: "high",
        estimatedCost: 4000,
        serviceType: "brake_service",
        reason: `Brake pads worn at ${metrics.brakePadWear}%. Schedule replacement within a week.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkTireHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.tireCondition;

    if (metrics.tireCondition <= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Tires",
        failureRisk: 90,
        estimatedDaysToFailure: 2,
        recommendedAction: "immediate",
        priority: "critical",
        estimatedCost: 5000,
        serviceType: "tire_replacement",
        reason: `Tire condition critically low at ${metrics.tireCondition}/100. Blowout risk - replace immediately.`,
        timestamp: new Date(),
      });
    } else if (metrics.tireCondition <= thresholds.warning) {
      predictions.push({
        vehicleId,
        component: "Tires",
        failureRisk: 75,
        estimatedDaysToFailure: 14,
        recommendedAction: "urgent",
        priority: "high",
        estimatedCost: 5000,
        serviceType: "tire_rotation",
        reason: `Tire condition at ${metrics.tireCondition}/100. Schedule rotation/replacement within 2 weeks.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkBatteryHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.batteryHealth;

    if (metrics.batteryHealth <= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Battery",
        failureRisk: 85,
        estimatedDaysToFailure: 3,
        recommendedAction: "urgent",
        priority: "high",
        estimatedCost: 6000,
        serviceType: "battery_replacement",
        reason: `Battery health critically low at ${metrics.batteryHealth}%. Risk of failure - replace soon.`,
        timestamp: new Date(),
      });
    } else if (metrics.batteryHealth <= thresholds.warning) {
      predictions.push({
        vehicleId,
        component: "Battery",
        failureRisk: 65,
        estimatedDaysToFailure: 14,
        recommendedAction: "scheduled",
        priority: "medium",
        estimatedCost: 6000,
        serviceType: "battery_replacement",
        reason: `Battery health at ${metrics.batteryHealth}%. Monitor closely - plan replacement.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkTransmissionHealth(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];
    const thresholds = this.componentThresholds.transmissionFluidLevel;

    if (metrics.transmissionFluidLevel <= thresholds.critical) {
      predictions.push({
        vehicleId,
        component: "Transmission Fluid",
        failureRisk: 80,
        estimatedDaysToFailure: 2,
        recommendedAction: "immediate",
        priority: "critical",
        estimatedCost: 3000,
        serviceType: "transmission_fluid_check",
        reason: `Transmission fluid critically low at ${metrics.transmissionFluidLevel}%. Risk of transmission damage.`,
        timestamp: new Date(),
      });
    }

    return predictions;
  }

  private checkScheduledServices(
    vehicleId: string,
    metrics: VehicleHealthMetrics
  ): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];

    // Check each scheduled service
    const services = [
      { key: "air_filter", name: "Air Filter", cost: 800 },
      { key: "cabin_filter", name: "Cabin Filter", cost: 1000 },
      { key: "spark_plugs", name: "Spark Plugs", cost: 1500 },
      { key: "suspension_check", name: "Suspension Check", cost: 2000 },
    ];

    services.forEach((service) => {
      const intervalKm = this.maintenanceIntervals[service.key as keyof typeof this.maintenanceIntervals];
      const daysSinceService = Math.floor(
        (new Date().getTime() - metrics.lastServiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const estimatedKmSinceService = Math.floor(daysSinceService * (metrics.mileage / Math.max(daysSinceService, 1)));

      if (estimatedKmSinceService >= intervalKm) {
        predictions.push({
          vehicleId,
          component: service.name,
          failureRisk: 50,
          estimatedDaysToFailure: 30,
          recommendedAction: "scheduled",
          priority: "medium",
          estimatedCost: service.cost,
          serviceType: service.key,
          reason: `${service.name} due. Last serviced ${daysSinceService} days ago.`,
          timestamp: new Date(),
        });
      }
    });

    return predictions;
  }

  private checkFaultCodes(vehicleId: string, metrics: VehicleHealthMetrics): MaintenancePrediction[] {
    const predictions: MaintenancePrediction[] = [];

    metrics.faultCodes.forEach((code) => {
      const severity = this.decodeFaultSeverity(code);
      predictions.push({
        vehicleId,
        component: `Fault Code: ${code}`,
        failureRisk: severity.risk,
        estimatedDaysToFailure: severity.daysToFailure,
        recommendedAction: severity.action,
        priority: severity.priority,
        estimatedCost: severity.estimatedCost,
        serviceType: "diagnostic",
        reason: severity.description,
        timestamp: new Date(),
      });
    });

    return predictions;
  }

  private decodeFaultSeverity(
    code: string
  ): {
    risk: number;
    daysToFailure: number;
    action: "immediate" | "urgent" | "scheduled" | "monitor";
    priority: "critical" | "high" | "medium" | "low";
    estimatedCost: number;
    description: string;
  } {
    // Simplified fault code interpretation
    const faultMap: Record<string, any> = {
      P0300: {
        risk: 75,
        daysToFailure: 7,
        action: "urgent",
        priority: "high",
        estimatedCost: 3000,
        description: "Random misfires detected. Possible spark plug or fuel issue.",
      },
      P0500: {
        risk: 80,
        daysToFailure: 3,
        action: "immediate",
        priority: "critical",
        estimatedCost: 5000,
        description: "Vehicle speed sensor malfunction. Affects speedometer and transmission.",
      },
      P0128: {
        risk: 60,
        daysToFailure: 14,
        action: "scheduled",
        priority: "medium",
        estimatedCost: 2000,
        description: "Coolant thermostat malfunction. Engine not reaching optimal temperature.",
      },
      P0141: {
        risk: 70,
        daysToFailure: 10,
        action: "urgent",
        priority: "high",
        estimatedCost: 2000,
        description: "Oxygen sensor heater circuit malfunction. Affects fuel economy.",
      },
    };

    return (
      faultMap[code] || {
        risk: 50,
        daysToFailure: 30,
        action: "monitor",
        priority: "medium",
        estimatedCost: 1000,
        description: `Fault code ${code} detected. Requires diagnostic scan.`,
      }
    );
  }

  private generateServiceSchedules(vehicleId: string, predictions: MaintenancePrediction[]): void {
    const schedules: ServiceSchedule[] = [];

    predictions.forEach((pred) => {
      if (pred.recommendedAction !== "monitor") {
        schedules.push({
          vehicleId,
          serviceType: pred.serviceType,
          dueDate: new Date(Date.now() + pred.estimatedDaysToFailure * 24 * 60 * 60 * 1000),
          estimatedDuration: this.estimateServiceDuration(pred.serviceType),
          estimatedCost: pred.estimatedCost,
          priority: pred.priority,
          status: "pending",
        });
      }
    });

    this.schedules.set(vehicleId, schedules);
  }

  private estimateServiceDuration(serviceType: string): number {
    const durations: Record<string, number> = {
      oil_change: 30,
      tire_rotation: 45,
      air_filter: 20,
      cabin_filter: 25,
      brake_service: 120,
      transmission_fluid: 90,
      coolant_flush: 60,
      spark_plugs: 60,
      suspension_check: 45,
      diagnostic: 30,
      battery_replacement: 30,
      tire_replacement: 90,
      coolant_check: 20,
      transmission_fluid_check: 20,
    };

    return durations[serviceType] || 60;
  }

  getFleetHealthReport(): FleetHealthReport {
    let healthyVehicles = 0;
    let warningVehicles = 0;
    let criticalVehicles = 0;
    let totalMileage = 0;
    let totalAge = 0;
    const allUpcomingServices: MaintenancePrediction[] = [];
    let totalCostProjection = 0;

    this.vehicleMetrics.forEach((metrics, vehicleId) => {
      const predictions = this.predictions.get(vehicleId) || [];
      const criticalCount = predictions.filter((p) => p.priority === "critical").length;
      const warningCount = predictions.filter((p) => p.priority === "high").length;

      if (criticalCount > 0) {
        criticalVehicles++;
      } else if (warningCount > 0) {
        warningVehicles++;
      } else {
        healthyVehicles++;
      }

      totalMileage += metrics.mileage;
      totalAge += metrics.age;
      allUpcomingServices.push(...predictions.filter((p) => p.recommendedAction !== "monitor"));
      totalCostProjection += predictions.reduce((sum, p) => sum + p.estimatedCost, 0);
    });

    const totalVehicles = this.vehicleMetrics.size;
    const healthScore = totalVehicles > 0
      ? Math.round((healthyVehicles / totalVehicles) * 100)
      : 0;

    const report: FleetHealthReport = {
      timestamp: new Date(),
      totalVehicles,
      healthyVehicles,
      warningVehicles,
      criticalVehicles,
      healthScore,
      averageMileage: totalVehicles > 0 ? Math.round(totalMileage / totalVehicles) : 0,
      averageAge: totalVehicles > 0 ? Math.round(totalAge / totalVehicles) : 0,
      upcomingServices: allUpcomingServices.sort((a, b) => b.failureRisk - a.failureRisk).slice(0, 10),
      costProjection: {
        nextMonth: Math.round(totalCostProjection * 0.3),
        next3Months: Math.round(totalCostProjection * 0.6),
        next6Months: Math.round(totalCostProjection),
      },
      recommendations: this.generateFleetRecommendations(
        healthyVehicles,
        warningVehicles,
        criticalVehicles,
        totalVehicles
      ),
    };

    // Store report
    if (!this.healthHistory.has("fleet")) {
      this.healthHistory.set("fleet", []);
    }
    this.healthHistory.get("fleet")!.push(report);

    this.emit("fleet:healthreport", report);
    return report;
  }

  private generateFleetRecommendations(
    healthy: number,
    warning: number,
    critical: number,
    total: number
  ): string[] {
    const recommendations: string[] = [];

    if (critical > 0) {
      recommendations.push(`🚨 ${critical} vehicle(s) need IMMEDIATE maintenance attention`);
    }

    if (warning > 0) {
      recommendations.push(`⚠️ ${warning} vehicle(s) have upcoming urgent services`);
    }

    const criticalPercent = (critical / total) * 100;
    const healthPercent = (healthy / total) * 100;

    if (criticalPercent > 20) {
      recommendations.push("Schedule maintenance window to handle multiple critical services");
    }

    if (healthPercent > 80) {
      recommendations.push("✅ Fleet is in excellent condition. Maintain preventive maintenance schedule.");
    }

    recommendations.push("Review and prioritize services by business criticality");

    return recommendations;
  }

  getPredictions(vehicleId: string): MaintenancePrediction[] {
    return this.predictions.get(vehicleId) || [];
  }

  getSchedules(vehicleId: string): ServiceSchedule[] {
    return this.schedules.get(vehicleId) || [];
  }

  completeService(vehicleId: string, serviceType: string): boolean {
    const schedules = this.schedules.get(vehicleId) || [];
    const schedule = schedules.find((s) => s.serviceType === serviceType);

    if (schedule) {
      schedule.status = "completed";
      return true;
    }

    return false;
  }
}

export const predictiveMaintenanceEngine = new PredictiveMaintenanceEngine();
