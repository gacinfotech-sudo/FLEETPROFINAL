import { EventEmitter } from "events";

export type IncidentType =
  | "accident"
  | "near_miss"
  | "violation"
  | "complaint"
  | "hazard"
  | "maintenance_issue"
  | "safety_concern"
  | "theft"
  | "vandalism";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type IncidentStatus =
  | "reported"
  | "investigating"
  | "under_review"
  | "resolved"
  | "closed"
  | "escalated";

export type ResponseAction =
  | "driver_warning"
  | "driver_suspension"
  | "vehicle_repair"
  | "insurance_claim"
  | "police_report"
  | "training_required"
  | "monitoring"
  | "investigation";

export interface Incident {
  incidentId: string;
  vehicleId: string;
  driverId: string;
  customerId?: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  title: string;
  description: string;
  location?: { latitude: number; longitude: number };
  timestamp: Date;
  reportedBy: "driver" | "customer" | "system" | "admin";
  injuries?: boolean;
  damageEstimate?: number; // ₹
  witnesses?: number;
  photos?: string[];
  videoUrl?: string;
  policeReport?: {
    fir: string;
    station: string;
    date: Date;
  };
  investiga tion?: {
    investigatorId: string;
    startDate: Date;
    findings?: string;
    completedDate?: Date;
  };
  assignedTo?: string; // admin/investigator ID
  responseActions: ResponseAction[];
  resolutionNotes?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  riskScore: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyViolation {
  violationId: string;
  driverId: string;
  violationType: string; // "speeding", "rash_driving", "traffic_violation", etc.
  severity: Severity;
  timestamp: Date;
  location?: { latitude: number; longitude: number };
  details: string;
  photographic_evidence?: string[];
  penalty?: number; // ₹
  penaltyType?: "fine" | "suspension" | "warning";
  resolved: boolean;
  resolvedAt?: Date;
}

export interface IncidentReport {
  reportId: string;
  incidentId: string;
  generatedBy: string;
  generatedAt: Date;
  summary: string;
  details: {
    whatHappened: string;
    causeAnalysis: string;
    consequences: {
      injuriesCount: number;
      damageAmount: number;
      vehicleDowntime: number; // hours
    };
    preventiveMeasures: string[];
    recommendations: string[];
  };
  attachments?: string[];
}

export interface SafetyMetrics {
  timestamp: Date;
  totalIncidents: number;
  criticalIncidents: number;
  accidents: number;
  violations: number;
  nearMisses: number;
  avgSeverityScore: number;
  driversInvolved: number;
  vehiclesInvolved: number;
  injuryCount: number;
  estimatedDamage: number; // ₹
  resolutionRate: number; // percentage
  averageResolutionTime: number; // hours
  safetyIndex: number; // 0-100, higher is better
  topViolationTypes: { type: string; count: number }[];
  highRiskDrivers: { driverId: string; incidents: number }[];
}

export interface DriverSafetyProfile {
  profileId: string;
  driverId: string;
  safetyScore: number; // 0-100
  incidentCount: number;
  violationCount: number;
  accidentCount: number;
  injuryCount: number;
  status: "safe" | "caution" | "high_risk" | "suspended";
  lastIncident?: Date;
  trainingRequired: boolean;
  certifications: { name: string; expiryDate: Date }[];
  nextReviewDate?: Date;
  lastUpdated: Date;
}

export interface SafetyTraining {
  trainingId: string;
  driverId: string;
  trainingType: "defensive_driving" | "safety_awareness" | "customer_service" | "vehicle_maintenance";
  status: "assigned" | "in_progress" | "completed" | "failed";
  startDate: Date;
  completedDate?: Date;
  score?: number;
  certificateUrl?: string;
  expiryDate?: Date;
}

class SafetyIncidentEngine extends EventEmitter {
  private incidents: Map<string, Incident> = new Map();
  private violations: Map<string, SafetyViolation> = new Map();
  private reports: Map<string, IncidentReport> = new Map();
  private driverProfiles: Map<string, DriverSafetyProfile> = new Map();
  private trainings: Map<string, SafetyTraining> = new Map();
  private incidentHistory: Incident[] = [];

  constructor() {
    super();
  }

  reportIncident(
    vehicleId: string,
    driverId: string,
    type: IncidentType,
    title: string,
    description: string,
    reportedBy: "driver" | "customer" | "system" | "admin",
    customerId?: string
  ): Incident {
    const incident: Incident = {
      incidentId: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vehicleId,
      driverId,
      customerId,
      type,
      severity: this.assessSeverity(type, description),
      status: "reported",
      title,
      description,
      timestamp: new Date(),
      reportedBy,
      injuries: false,
      responseActions: [],
      riskScore: this.calculateRiskScore(type, description),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.incidents.set(incident.incidentId, incident);
    this.incidentHistory.push(incident);
    this.updateDriverSafetyProfile(driverId);

    // Auto-escalate critical incidents
    if (incident.severity === "critical") {
      incident.status = "escalated";
      incident.responseActions.push("police_report");
    }

    this.emit("incident:reported", incident);
    return incident;
  }

  private assessSeverity(type: IncidentType, description: string): Severity {
    const lower = description.toLowerCase();

    if (type === "accident") {
      if (lower.includes("critical") || lower.includes("fatal"))
        return "critical";
      if (lower.includes("severe") || lower.includes("injury"))
        return "high";
      if (lower.includes("minor")) return "low";
      return "high"; // Default for accidents
    }

    if (type === "safety_concern") {
      if (lower.includes("critical")) return "critical";
      return "high";
    }

    if (type === "violation") {
      if (lower.includes("rash") || lower.includes("dangerous"))
        return "high";
      return "medium";
    }

    if (type === "near_miss") return "low";
    if (type === "complaint") return "medium";

    return "medium";
  }

  private calculateRiskScore(type: IncidentType, description: string): number {
    let score = 0;

    const typeScores: { [key in IncidentType]: number } = {
      accident: 85,
      near_miss: 60,
      violation: 70,
      complaint: 40,
      hazard: 55,
      maintenance_issue: 50,
      safety_concern: 75,
      theft: 80,
      vandalism: 65,
    };

    score = typeScores[type];

    // Add modifiers based on description keywords
    const lower = description.toLowerCase();
    if (lower.includes("critical")) score += 15;
    if (lower.includes("injury")) score += 20;
    if (lower.includes("death")) score += 25;
    if (lower.includes("repeat")) score += 10;
    if (lower.includes("reckless")) score += 15;

    return Math.min(100, score);
  }

  recordViolation(
    driverId: string,
    violationType: string,
    details: string,
    location?: { latitude: number; longitude: number }
  ): SafetyViolation {
    const violation: SafetyViolation = {
      violationId: `viol_${Date.now()}`,
      driverId,
      violationType,
      severity: this.getViolationSeverity(violationType),
      timestamp: new Date(),
      location,
      details,
      resolved: false,
    };

    this.violations.set(violation.violationId, violation);
    this.updateDriverSafetyProfile(driverId);

    this.emit("violation:recorded", violation);
    return violation;
  }

  private getViolationSeverity(violationType: string): Severity {
    const severities: { [key: string]: Severity } = {
      speeding: "high",
      rash_driving: "high",
      traffic_violation: "medium",
      lane_crossing: "medium",
      red_light: "high",
      phone_usage: "low",
      seatbelt_violation: "low",
      parking_violation: "low",
    };

    return severities[violationType] || "medium";
  }

  investigateIncident(
    incidentId: string,
    investigatorId: string,
    findings: string
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    incident.status = "investigating";
    incident.assignedTo = investigatorId;
    incident.investigation = {
      investigatorId,
      startDate: new Date(),
      findings,
    };
    incident.updatedAt = new Date();

    this.emit("incident:investigating", incident);
    return incident;
  }

  resolveIncident(
    incidentId: string,
    resolutionNotes: string,
    responseActions: ResponseAction[]
  ): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    incident.status = "resolved";
    incident.resolvedAt = new Date();
    incident.resolutionNotes = resolutionNotes;
    incident.responseActions = responseActions;

    // Apply response actions
    responseActions.forEach((action) => {
      if (action === "driver_suspension") {
        const profile = this.driverProfiles.get(incident.driverId);
        if (profile) {
          profile.status = "suspended";
        }
      } else if (action === "training_required") {
        this.assignTraining(incident.driverId, "safety_awareness");
      }
    });

    incident.updatedAt = new Date();
    this.emit("incident:resolved", incident);
    return incident;
  }

  closeIncident(incidentId: string): Incident | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    incident.status = "closed";
    incident.closedAt = new Date();
    incident.updatedAt = new Date();

    this.emit("incident:closed", incident);
    return incident;
  }

  private updateDriverSafetyProfile(driverId: string) {
    const driverIncidents = Array.from(this.incidents.values()).filter(
      (i) => i.driverId === driverId
    );
    const driverViolations = Array.from(this.violations.values()).filter(
      (v) => v.driverId === driverId
    );

    let profile = this.driverProfiles.get(driverId);
    if (!profile) {
      profile = {
        profileId: `prof_${driverId}`,
        driverId,
        safetyScore: 100,
        incidentCount: 0,
        violationCount: 0,
        accidentCount: 0,
        injuryCount: 0,
        status: "safe",
        trainingRequired: false,
        certifications: [],
        lastUpdated: new Date(),
      };
    }

    // Calculate safety score
    profile.incidentCount = driverIncidents.length;
    profile.violationCount = driverViolations.length;
    profile.accidentCount = driverIncidents.filter(
      (i) => i.type === "accident"
    ).length;
    profile.injuryCount = driverIncidents.filter((i) => i.injuries).length;

    // Calculate score (0-100)
    let score = 100;
    score -= profile.accidentCount * 20;
    score -= profile.violationCount * 5;
    score -= profile.injuryCount * 15;

    profile.safetyScore = Math.max(0, score);

    // Determine status
    if (profile.safetyScore >= 80) profile.status = "safe";
    else if (profile.safetyScore >= 60) profile.status = "caution";
    else profile.status = "high_risk";

    profile.lastIncident =
      driverIncidents.length > 0
        ? driverIncidents.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          )[0].timestamp
        : undefined;

    profile.trainingRequired = profile.safetyScore < 60;
    profile.lastUpdated = new Date();

    this.driverProfiles.set(driverId, profile);
  }

  assignTraining(driverId: string, trainingType: SafetyTraining["trainingType"]): SafetyTraining {
    const training: SafetyTraining = {
      trainingId: `train_${Date.now()}`,
      driverId,
      trainingType,
      status: "assigned",
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    this.trainings.set(training.trainingId, training);
    this.emit("training:assigned", training);
    return training;
  }

  completeTraining(trainingId: string, score: number): SafetyTraining | null {
    const training = this.trainings.get(trainingId);
    if (!training) return null;

    training.status = score >= 70 ? "completed" : "failed";
    training.completedDate = new Date();
    training.score = score;

    if (training.status === "completed") {
      training.certificateUrl = `cert_${training.trainingId}.pdf`;
      const profile = this.driverProfiles.get(training.driverId);
      if (profile) {
        profile.certifications.push({
          name: training.trainingType,
          expiryDate: training.expiryDate!,
        });
      }
    }

    this.emit("training:completed", training);
    return training;
  }

  generateIncidentReport(incidentId: string, generatedBy: string): IncidentReport | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    const report: IncidentReport = {
      reportId: `rept_${Date.now()}`,
      incidentId,
      generatedBy,
      generatedAt: new Date(),
      summary: `${incident.type.toUpperCase()}: ${incident.title}`,
      details: {
        whatHappened: incident.description,
        causeAnalysis: this.analyzeCause(incident),
        consequences: {
          injuriesCount: incident.injuries ? 1 : 0,
          damageAmount: incident.damageEstimate || 0,
          vehicleDowntime: incident.type === "accident" ? 24 : 0,
        },
        preventiveMeasures: this.suggestPreventiveMeasures(incident.type),
        recommendations: this.generateRecommendations(incident),
      },
    };

    this.reports.set(report.reportId, report);
    return report;
  }

  private analyzeCause(incident: Incident): string {
    const type = incident.type;
    const desc = incident.description.toLowerCase();

    if (type === "accident") {
      if (desc.includes("speed")) return "Excessive speed";
      if (desc.includes("collision")) return "Vehicle collision";
      if (desc.includes("traffic")) return "Traffic violation";
      return "Unknown cause - investigation required";
    }

    if (type === "violation") {
      if (desc.includes("signal")) return "Traffic signal violation";
      if (desc.includes("lane")) return "Improper lane change";
      return "Driving violation";
    }

    return "Cause under investigation";
  }

  private suggestPreventiveMeasures(type: IncidentType): string[] {
    const measures: { [key in IncidentType]: string[] } = {
      accident: [
        "Speed reduction training",
        "Defensive driving course",
        "Vehicle maintenance check",
      ],
      near_miss: ["Heightened awareness training", "Speed monitoring"],
      violation: ["Traffic rules refresher", "Driving discipline"],
      complaint: ["Customer service training", "Communication skills"],
      hazard: ["Safety equipment check", "Route optimization"],
      maintenance_issue: ["Regular maintenance schedule", "Pre-trip inspections"],
      safety_concern: ["Safety protocol review", "Emergency response training"],
      theft: ["Security measures", "Parking location guidelines"],
      vandalism: ["Incident reporting training", "Documentation"],
    };

    return measures[type];
  }

  private generateRecommendations(incident: Incident): string[] {
    const recommendations = [];

    if (incident.severity === "critical") {
      recommendations.push("Immediate driver suspension pending investigation");
      recommendations.push("Vehicle removal from service for inspection");
    }

    if (incident.type === "accident") {
      recommendations.push("Mandatory defensive driving course");
      recommendations.push("Insurance claim processing");
    }

    if (incident.injuries) {
      recommendations.push("Medical documentation collection");
      recommendations.push("Customer compensation review");
    }

    return recommendations;
  }

  getDriverSafetyProfile(driverId: string): DriverSafetyProfile | undefined {
    return this.driverProfiles.get(driverId);
  }

  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  getIncidentsByDriver(driverId: string): Incident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.driverId === driverId
    );
  }

  getSafetyMetrics(): SafetyMetrics {
    const allIncidents = Array.from(this.incidents.values());
    const allViolations = Array.from(this.violations.values());
    const allProfiles = Array.from(this.driverProfiles.values());

    const critical = allIncidents.filter((i) => i.severity === "critical").length;
    const accidents = allIncidents.filter((i) => i.type === "accident").length;
    const nearMisses = allIncidents.filter((i) => i.type === "near_miss").length;
    const resolved = allIncidents.filter((i) => i.status === "resolved").length;

    const avgSeverity =
      allIncidents.length > 0
        ? allIncidents.reduce((sum, i) => sum + i.riskScore, 0) /
          allIncidents.length
        : 0;

    const totalDamage = allIncidents.reduce(
      (sum, i) => sum + (i.damageEstimate || 0),
      0
    );

    const injuryCount = allIncidents.filter((i) => i.injuries).length;

    const resolutionRate =
      allIncidents.length > 0
        ? (resolved / allIncidents.length) * 100
        : 0;

    const avgResolutionTime =
      resolved > 0
        ? allIncidents
            .filter((i) => i.resolvedAt)
            .reduce(
              (sum, i) =>
                sum +
                (i.resolvedAt!.getTime() - i.createdAt.getTime()) /
                  (1000 * 60 * 60),
              0
            ) / resolved
        : 0;

    const safetyIndex = Math.max(
      0,
      100 - avgSeverity - (allIncidents.length * 2) / Math.max(1, allProfiles.length)
    );

    const violationTypes = new Map<string, number>();
    allViolations.forEach((v) => {
      violationTypes.set(
        v.violationType,
        (violationTypes.get(v.violationType) || 0) + 1
      );
    });

    return {
      timestamp: new Date(),
      totalIncidents: allIncidents.length,
      criticalIncidents: critical,
      accidents,
      violations: allViolations.length,
      nearMisses,
      avgSeverityScore: Math.round(avgSeverity * 10) / 10,
      driversInvolved: new Set(allIncidents.map((i) => i.driverId)).size,
      vehiclesInvolved: new Set(allIncidents.map((i) => i.vehicleId)).size,
      injuryCount,
      estimatedDamage: totalDamage,
      resolutionRate: Math.round(resolutionRate),
      averageResolutionTime: Math.round(avgResolutionTime * 100) / 100,
      safetyIndex: Math.round(safetyIndex),
      topViolationTypes: Array.from(violationTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
      highRiskDrivers: allProfiles
        .filter((p) => p.status === "high_risk")
        .map((p) => ({ driverId: p.driverId, incidents: p.incidentCount }))
        .slice(0, 10),
    };
  }

  getPendingInvestigations(): Incident[] {
    return Array.from(this.incidents.values()).filter(
      (i) => i.status === "investigating"
    );
  }
}

export const safetyIncidentEngine = new SafetyIncidentEngine();
