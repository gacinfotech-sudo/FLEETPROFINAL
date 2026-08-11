import { EventEmitter } from "events";

export interface AnomalyDetectionRule {
  id: string;
  name: string;
  category: "driver" | "customer" | "pricing" | "demand" | "operations" | "dispatch" | "maintenance";
  metric: string;
  condition: "above" | "below" | "deviation";
  threshold: number;
  deviationSigma?: number; // For standard deviation detection
  enabled: boolean;
  severity: "info" | "warning" | "critical";
  autoResponseEnabled: boolean;
  responseActions: string[];
}

export interface DetectedAnomaly {
  id: string;
  ruleId: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  metricValue: number;
  expectedValue: number;
  deviation: number; // percentage or absolute
  timestamp: Date;
  detectedAt: Date;
  status: "detected" | "investigating" | "responded" | "resolved" | "false_alarm";
  responseAction?: string;
  resolution?: string;
  relatedAnomalies?: string[]; // IDs of related anomalies
}

export interface AutoResponse {
  id: string;
  anomalyId: string;
  action: string;
  actionType: "pricing_adjustment" | "driver_dispatch" | "customer_support" | "alert" | "auto_escalate" | "data_correction";
  parameters: Record<string, any>;
  triggered: Date;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
}

export interface IncidentReport {
  id: string;
  anomalies: string[]; // anomaly IDs
  startTime: Date;
  endTime?: Date;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  rootCause?: string;
  resolutionActions: string[];
  estimatedImpact: {
    affectedRides: number;
    affectedDrivers: number;
    affectedCustomers: number;
    estimatedLoss: number; // ₹
  };
}

class AnomalyDetectionEngine extends EventEmitter {
  private detectionRules: Map<string, AnomalyDetectionRule> = new Map();
  private detectedAnomalies: Map<string, DetectedAnomaly> = new Map();
  private autoResponses: Map<string, AutoResponse> = new Map();
  private incidentReports: Map<string, IncidentReport> = new Map();
  private metricHistory: Map<string, number[]> = new Map();
  private baselineMetrics: Map<string, { mean: number; stdDev: number }> = new Map();

  constructor() {
    super();
    this.setupDetectionRules();
  }

  private setupDetectionRules() {
    const rules: AnomalyDetectionRule[] = [
      // DRIVER ANOMALIES
      {
        id: "driver-acceptance-drop",
        name: "Driver Acceptance Rate Drop",
        category: "driver",
        metric: "acceptanceRate",
        condition: "below",
        threshold: 70,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["alert_driver", "offer_incentive", "reduce_request_volume"],
      },
      {
        id: "driver-rating-collapse",
        name: "Driver Rating Collapse",
        category: "driver",
        metric: "averageRating",
        condition: "below",
        threshold: 3.5,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["suspend_driver", "notify_support", "redistribute_rides"],
      },
      {
        id: "driver-offline-spike",
        name: "Drivers Going Offline Spike",
        category: "driver",
        metric: "offlinePercentage",
        condition: "above",
        threshold: 40,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["alert_ops", "surge_pricing", "activate_reserves"],
      },

      // CUSTOMER ANOMALIES
      {
        id: "customer-complaint-surge",
        name: "Customer Complaint Surge",
        category: "customer",
        metric: "complaintRate",
        condition: "deviation",
        threshold: 2,
        deviationSigma: 2.5,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["alert_support", "quality_audit", "driver_coaching"],
      },
      {
        id: "churn-rate-increase",
        name: "Churn Rate Increase",
        category: "customer",
        metric: "churnRate",
        condition: "above",
        threshold: 25,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["launch_retention_campaign", "increase_discounts", "alert_ops"],
      },

      // PRICING ANOMALIES
      {
        id: "surge-pricing-stuck",
        name: "Surge Pricing Stuck",
        category: "pricing",
        metric: "surgePricingActive",
        condition: "above",
        threshold: 3,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["disable_surge", "alert_tech", "manual_review"],
      },
      {
        id: "price-manipulation",
        name: "Potential Price Manipulation",
        category: "pricing",
        metric: "priceVariance",
        condition: "deviation",
        threshold: 3,
        deviationSigma: 3.0,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["freeze_pricing", "investigate", "alert_compliance"],
      },

      // DEMAND ANOMALIES
      {
        id: "demand-cliff",
        name: "Sudden Demand Cliff",
        category: "demand",
        metric: "bookingRate",
        condition: "below",
        threshold: 30,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["reduce_supply", "increase_incentives", "investigate"],
      },
      {
        id: "demand-surge",
        name: "Unexpected Demand Surge",
        category: "demand",
        metric: "bookingRate",
        condition: "above",
        threshold: 300,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["activate_all_drivers", "surge_pricing", "alert_ops"],
      },

      // DISPATCH ANOMALIES
      {
        id: "dispatch-failure-rate",
        name: "Dispatch Failure Rate High",
        category: "dispatch",
        metric: "acceptanceRate",
        condition: "below",
        threshold: 60,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["review_algorithm", "increase_match_timeout", "alert_tech"],
      },
      {
        id: "wait-time-spike",
        name: "Wait Time Spike",
        category: "dispatch",
        metric: "avgWaitTime",
        condition: "above",
        threshold: 900,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["expand_matching_radius", "activate_reserves", "alert_ops"],
      },

      // MAINTENANCE ANOMALIES
      {
        id: "fleet-health-drop",
        name: "Fleet Health Score Drop",
        category: "maintenance",
        metric: "fleetHealthScore",
        condition: "below",
        threshold: 60,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["expedite_services", "alert_maintenance", "reduce_utilization"],
      },
      {
        id: "critical-vehicle-failures",
        name: "Critical Vehicle Failures",
        category: "maintenance",
        metric: "criticalFailureCount",
        condition: "above",
        threshold: 5,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["inspect_fleet", "ground_vehicles", "alert_ops"],
      },

      // OPERATIONS ANOMALIES
      {
        id: "revenue-drop",
        name: "Revenue Drop",
        category: "operations",
        metric: "hourlyRevenue",
        condition: "below",
        threshold: 50000,
        enabled: true,
        severity: "warning",
        autoResponseEnabled: true,
        responseActions: ["review_pricing", "increase_incentives", "alert_finance"],
      },
      {
        id: "profitability-decline",
        name: "Profitability Decline",
        category: "operations",
        metric: "operatingMargin",
        condition: "below",
        threshold: 15,
        enabled: true,
        severity: "critical",
        autoResponseEnabled: true,
        responseActions: ["cost_audit", "pricing_review", "alert_exec"],
      },
    ];

    rules.forEach((rule) => {
      this.detectionRules.set(rule.id, rule);
    });
  }

  detectAnomalies(metrics: Record<string, number>): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    for (const [ruleId, rule] of this.detectionRules.entries()) {
      if (!rule.enabled) continue;

      const metricValue = metrics[rule.metric];
      if (metricValue === undefined) continue;

      let isAnomaly = false;
      let deviation = 0;

      if (rule.condition === "above") {
        isAnomaly = metricValue > rule.threshold;
        deviation = ((metricValue - rule.threshold) / rule.threshold) * 100;
      } else if (rule.condition === "below") {
        isAnomaly = metricValue < rule.threshold;
        deviation = ((rule.threshold - metricValue) / rule.threshold) * 100;
      } else if (rule.condition === "deviation") {
        const baseline = this.baselineMetrics.get(rule.metric);
        if (baseline && rule.deviationSigma) {
          const zScore = Math.abs((metricValue - baseline.mean) / baseline.stdDev);
          isAnomaly = zScore > rule.deviationSigma;
          deviation = zScore;
        }
      }

      if (isAnomaly) {
        const anomaly: DetectedAnomaly = {
          id: `anomaly_${Date.now()}_${ruleId}`,
          ruleId,
          category: rule.category,
          severity: rule.severity,
          title: rule.name,
          description: `${rule.name}: ${rule.metric} = ${metricValue} (threshold: ${rule.threshold})`,
          metricValue,
          expectedValue: rule.threshold,
          deviation,
          timestamp: new Date(),
          detectedAt: new Date(),
          status: "detected",
        };

        this.detectedAnomalies.set(anomaly.id, anomaly);
        anomalies.push(anomaly);

        // Trigger auto-response if enabled
        if (rule.autoResponseEnabled) {
          this.triggerAutoResponse(anomaly, rule);
        }

        this.emit("anomaly:detected", anomaly);
      }
    }

    // Group related anomalies
    this.groupRelatedAnomalies(anomalies);

    // Create incident report if multiple critical anomalies
    const criticalAnomalies = anomalies.filter((a) => a.severity === "critical");
    if (criticalAnomalies.length > 1) {
      this.createIncidentReport(criticalAnomalies);
    }

    return anomalies;
  }

  private groupRelatedAnomalies(anomalies: DetectedAnomaly[]): void {
    const relatedPairs: Record<string, Set<string>> = {
      "demand-surge": new Set(["dispatch-failure-rate", "wait-time-spike"]),
      "driver-offline-spike": new Set(["demand-cliff", "wait-time-spike"]),
      "churn-rate-increase": new Set(["customer-complaint-surge", "revenue-drop"]),
      "driver-rating-collapse": new Set(["customer-complaint-surge", "revenue-drop"]),
    };

    anomalies.forEach((anomaly) => {
      const related = relatedPairs[anomaly.ruleId];
      if (related) {
        anomaly.relatedAnomalies = Array.from(related);
      }
    });
  }

  private triggerAutoResponse(anomaly: DetectedAnomaly, rule: AnomalyDetectionRule): void {
    rule.responseActions.forEach((action) => {
      const response: AutoResponse = {
        id: `response_${Date.now()}_${anomaly.id}`,
        anomalyId: anomaly.id,
        action,
        actionType: this.mapActionType(action),
        parameters: this.buildActionParameters(action, anomaly),
        triggered: new Date(),
        status: "pending",
      };

      this.autoResponses.set(response.id, response);
      this.emit("response:triggered", response);
    });
  }

  private mapActionType(
    action: string
  ): "pricing_adjustment" | "driver_dispatch" | "customer_support" | "alert" | "auto_escalate" | "data_correction" {
    if (action.includes("pricing") || action.includes("surge")) return "pricing_adjustment";
    if (action.includes("driver") || action.includes("dispatch")) return "driver_dispatch";
    if (action.includes("support") || action.includes("customer")) return "customer_support";
    if (action.includes("alert")) return "alert";
    if (action.includes("escalate")) return "auto_escalate";
    return "data_correction";
  }

  private buildActionParameters(action: string, anomaly: DetectedAnomaly): Record<string, any> {
    const params: Record<string, any> = {
      anomalyId: anomaly.id,
      severity: anomaly.severity,
      metric: anomaly.metricValue,
    };

    if (action.includes("incentive")) {
      params.incentiveAmount = anomaly.deviation > 50 ? 500 : 250;
    }
    if (action.includes("surge")) {
      params.surgeFactor = 1.5;
    }
    if (action.includes("suspend")) {
      params.suspensionReason = anomaly.description;
    }
    if (action.includes("campaign")) {
      params.campaignType = "retention";
      params.discountPercent = 30;
    }

    return params;
  }

  private createIncidentReport(anomalies: DetectedAnomaly[]): void {
    const incident: IncidentReport = {
      id: `incident_${Date.now()}`,
      anomalies: anomalies.map((a) => a.id),
      startTime: new Date(),
      severity: "high",
      status: "open",
      resolutionActions: [],
      estimatedImpact: {
        affectedRides: 0,
        affectedDrivers: 0,
        affectedCustomers: 0,
        estimatedLoss: 0,
      },
    };

    this.incidentReports.set(incident.id, incident);
    this.emit("incident:created", incident);
  }

  recordMetricHistory(metricName: string, value: number): void {
    if (!this.metricHistory.has(metricName)) {
      this.metricHistory.set(metricName, []);
    }
    const history = this.metricHistory.get(metricName)!;
    history.push(value);

    // Keep last 1000 data points
    if (history.length > 1000) {
      history.shift();
    }

    // Update baseline if we have enough data
    if (history.length >= 100) {
      this.updateBaseline(metricName, history);
    }
  }

  private updateBaseline(metricName: string, history: number[]): void {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    this.baselineMetrics.set(metricName, { mean, stdDev });
  }

  resolveAnomaly(anomalyId: string, resolution: string): boolean {
    const anomaly = this.detectedAnomalies.get(anomalyId);
    if (anomaly) {
      anomaly.status = "resolved";
      anomaly.resolution = resolution;
      this.emit("anomaly:resolved", { anomalyId, resolution });
      return true;
    }
    return false;
  }

  getActiveAnomalies(): DetectedAnomaly[] {
    return Array.from(this.detectedAnomalies.values()).filter(
      (a) => a.status === "detected" || a.status === "investigating"
    );
  }

  getIncidents(status?: string): IncidentReport[] {
    const incidents = Array.from(this.incidentReports.values());
    if (status) {
      return incidents.filter((i) => i.status === status);
    }
    return incidents;
  }

  getAnomalyStats(): {
    totalDetected: number;
    totalResolved: number;
    activeAnomalies: number;
    criticalAnomalies: number;
    resolutionRate: number;
    avgTimeToResolution: number;
    anomaliesByCategory: Record<string, number>;
    anomaliesBySeverity: Record<string, number>;
  } {
    const anomalies = Array.from(this.detectedAnomalies.values());
    const totalDetected = anomalies.length;
    const resolved = anomalies.filter((a) => a.status === "resolved");
    const totalResolved = resolved.length;
    const activeAnomalies = anomalies.filter((a) => a.status === "detected").length;
    const criticalAnomalies = anomalies.filter((a) => a.severity === "critical").length;

    const resolutionRate =
      totalDetected > 0 ? Math.round((totalResolved / totalDetected) * 100) : 0;

    const avgTimeToResolution =
      resolved.length > 0
        ? Math.round(
            resolved.reduce(
              (sum, a) =>
                sum +
                (new Date(a.resolution || a.detectedAt).getTime() -
                  new Date(a.detectedAt).getTime()),
              0
            ) / resolved.length
          ) / 60000 // Convert to minutes
        : 0;

    const anomaliesByCategory: Record<string, number> = {};
    const anomaliesBySeverity: Record<string, number> = {};

    anomalies.forEach((a) => {
      anomaliesByCategory[a.category] = (anomaliesByCategory[a.category] || 0) + 1;
      anomaliesBySeverity[a.severity] = (anomaliesBySeverity[a.severity] || 0) + 1;
    });

    return {
      totalDetected,
      totalResolved,
      activeAnomalies,
      criticalAnomalies,
      resolutionRate,
      avgTimeToResolution,
      anomaliesByCategory,
      anomaliesBySeverity,
    };
  }
}

export const anomalyDetectionEngine = new AnomalyDetectionEngine();
