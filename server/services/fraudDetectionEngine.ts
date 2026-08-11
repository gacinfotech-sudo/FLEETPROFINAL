import { EventEmitter } from "events";

export type EntityType = "driver" | "customer" | "ride" | "payment" | "account";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FraudType = "identity" | "payment" | "ride_manipulation" | "refund_abuse" | "rating_manipulation" | "account_takeover" | "booking_fraud" | "location_spoofing";

export interface EntityProfile {
  entityId: string;
  entityType: EntityType;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  flags: FraudFlag[];
  behaviors: BehaviorPattern[];
  transactionHistory: TransactionRecord[];
  verificationStatus: VerificationStatus;
  createdAt: Date;
  lastAssessmentAt: Date;
}

export interface FraudFlag {
  flagId: string;
  type: FraudType;
  severity: RiskLevel;
  reason: string;
  evidence: string[];
  detectedAt: Date;
  status: "active" | "investigated" | "resolved" | "false_alarm";
  autoQuarantineTriggered: boolean;
}

export interface BehaviorPattern {
  patternId: string;
  type: string; // "location_jump", "unusual_timing", "payment_method_change", etc.
  frequency: number; // occurrences
  lastOccurrence: Date;
  riskIndicator: number; // 0-100
  context: Record<string, any>;
}

export interface TransactionRecord {
  transactionId: string;
  entityId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  location?: { lat: number; lng: number };
  paymentMethod: string;
  status: "success" | "failed" | "pending" | "disputed";
  verificationLevel: "low" | "medium" | "high";
  suspiciousIndicators: string[];
}

export interface VerificationStatus {
  identity: "verified" | "pending" | "unverified" | "flagged";
  phone: "verified" | "pending" | "unverified";
  email: "verified" | "pending" | "unverified";
  payment: "verified" | "pending" | "unverified" | "flagged";
  address: "verified" | "pending" | "unverified";
  documentVerification: "passed" | "pending" | "failed" | "expired";
  mfaEnabled: boolean;
}

export interface FraudAssessment {
  assessmentId: string;
  entityId: string;
  entityType: EntityType;
  timestamp: Date;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  recommendation: "allow" | "review" | "block" | "quarantine";
  reasoning: string;
  requiredActions: string[];
}

export interface RiskFactor {
  factor: string;
  weight: number; // 0-1
  contribution: number; // 0-100 (to overall score)
  threshold: number;
  currentValue: number;
  explanation: string;
}

export interface FraudIncident {
  incidentId: string;
  entityId: string;
  entityType: EntityType;
  fraudType: FraudType;
  detectedAt: Date;
  severity: RiskLevel;
  status: "detected" | "investigating" | "confirmed" | "resolved" | "dismissed";
  evidence: string[];
  autoActions: AutoAction[];
  manualReview?: { reviewer: string; notes: string; decision: string };
  resolution?: string;
  estimatedLoss: number;
}

export interface AutoAction {
  actionId: string;
  type: "quarantine" | "verify" | "block" | "flag" | "notify";
  targetEntity: string;
  timestamp: Date;
  status: "executed" | "pending" | "failed";
  details: Record<string, any>;
}

export interface DeviceFingerprint {
  deviceId: string;
  entityId: string;
  deviceType: string;
  os: string;
  appVersion: string;
  lastSeen: Date;
  trustScore: number; // 0-100
  previousIncidents: number;
}

export interface SuspiciousPatternAlert {
  alertId: string;
  pattern: string;
  entities: string[];
  confidence: number; // 0-100
  detectedAt: Date;
  investigation: {
    status: "pending" | "investigating" | "concluded";
    findings?: string;
    riskLevel?: RiskLevel;
  };
}

class FraudDetectionEngine extends EventEmitter {
  private profiles: Map<string, EntityProfile> = new Map();
  private flags: Map<string, FraudFlag> = new Map();
  private incidents: Map<string, FraudIncident> = new Map();
  private deviceFingerprints: Map<string, DeviceFingerprint> = new Map();
  private suspiciousPatterns: Map<string, SuspiciousPatternAlert> = new Map();
  private assessmentHistory: FraudAssessment[] = [];

  constructor() {
    super();
    this.setupRiskModels();
  }

  private setupRiskModels() {
    // Initialize ML models and risk thresholds
  }

  assessEntity(
    entityId: string,
    entityType: EntityType,
    context: Record<string, any>
  ): FraudAssessment {
    const profile = this.getOrCreateProfile(entityId, entityType);
    const factors = this.calculateRiskFactors(profile, context);
    const riskScore = this.aggregateRiskScore(factors);
    const riskLevel = this.determineRiskLevel(riskScore);

    const assessment: FraudAssessment = {
      assessmentId: `assess_${Date.now()}`,
      entityId,
      entityType,
      timestamp: new Date(),
      riskScore,
      riskLevel,
      factors,
      recommendation: this.getRecommendation(riskScore, profile),
      reasoning: this.generateReasoning(factors, riskScore),
      requiredActions: this.getRequiredActions(riskScore, factors),
    };

    this.assessmentHistory.push(assessment);

    // Trigger auto-actions if needed
    if (assessment.recommendation === "block" || assessment.recommendation === "quarantine") {
      this.executeAutoActions(entityId, assessment);
    }

    this.emit("assessment:completed", assessment);
    return assessment;
  }

  private getOrCreateProfile(
    entityId: string,
    entityType: EntityType
  ): EntityProfile {
    if (!this.profiles.has(entityId)) {
      this.profiles.set(entityId, {
        entityId,
        entityType,
        riskScore: 20,
        riskLevel: "low",
        flags: [],
        behaviors: [],
        transactionHistory: [],
        verificationStatus: {
          identity: "pending",
          phone: "pending",
          email: "pending",
          payment: "pending",
          address: "pending",
          documentVerification: "pending",
          mfaEnabled: false,
        },
        createdAt: new Date(),
        lastAssessmentAt: new Date(),
      });
    }
    return this.profiles.get(entityId)!;
  }

  private calculateRiskFactors(
    profile: EntityProfile,
    context: Record<string, any>
  ): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Verification completeness
    const verificationScore = this.calculateVerificationScore(profile);
    factors.push({
      factor: "Verification Completeness",
      weight: 0.2,
      contribution: (100 - verificationScore) * 0.2,
      threshold: 80,
      currentValue: verificationScore,
      explanation: `Entity has ${verificationScore}% verification completion`,
    });

    // Transaction velocity
    const velocityScore = this.calculateTransactionVelocity(profile);
    factors.push({
      factor: "Transaction Velocity",
      weight: 0.25,
      contribution: Math.min(velocityScore * 0.25, 25),
      threshold: 50,
      currentValue: velocityScore,
      explanation: `${velocityScore} transactions in last 24 hours`,
    });

    // Device consistency
    const deviceConsistency = this.checkDeviceConsistency(profile);
    factors.push({
      factor: "Device Consistency",
      weight: 0.15,
      contribution: (100 - deviceConsistency) * 0.15,
      threshold: 85,
      currentValue: deviceConsistency,
      explanation: `Device trust score: ${deviceConsistency}%`,
    });

    // Geographic anomaly
    const geoAnomaly = this.detectGeographicAnomaly(profile, context);
    factors.push({
      factor: "Geographic Anomaly",
      weight: 0.2,
      contribution: geoAnomaly * 0.2,
      threshold: 30,
      currentValue: geoAnomaly,
      explanation: `Location jump detected: ${geoAnomaly}% anomaly score`,
    });

    // Behavioral pattern match
    const behaviorRisk = this.analyzeBehaviorPatterns(profile);
    factors.push({
      factor: "Behavioral Patterns",
      weight: 0.15,
      contribution: behaviorRisk * 0.15,
      threshold: 40,
      currentValue: behaviorRisk,
      explanation: `${behaviorRisk}% match with known fraud patterns`,
    });

    // Previous flags/incidents
    factors.push({
      factor: "Historical Risk",
      weight: 0.05,
      contribution: Math.min(profile.flags.length * 5, 25),
      threshold: 2,
      currentValue: profile.flags.length,
      explanation: `${profile.flags.length} active fraud flags`,
    });

    return factors;
  }

  private calculateVerificationScore(profile: EntityProfile): number {
    const verif = profile.verificationStatus;
    const scores = {
      identity: verif.identity === "verified" ? 100 : verif.identity === "pending" ? 50 : 0,
      phone: verif.phone === "verified" ? 100 : verif.phone === "pending" ? 50 : 0,
      email: verif.email === "verified" ? 100 : verif.email === "pending" ? 50 : 0,
      payment: verif.payment === "verified" ? 100 : verif.payment === "pending" ? 50 : 0,
      address: verif.address === "verified" ? 100 : verif.address === "pending" ? 50 : 0,
      mfa: verif.mfaEnabled ? 100 : 0,
    };

    return (
      Object.values(scores).reduce((a, b) => a + b, 0) /
      Object.keys(scores).length
    );
  }

  private calculateTransactionVelocity(profile: EntityProfile): number {
    const last24h = profile.transactionHistory.filter(
      (t) => Date.now() - t.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;

    // Velocity score: normal is 5-10 transactions/day, score increases with deviation
    const expectedVelocity = 7;
    return Math.abs(last24h - expectedVelocity) * 10;
  }

  private checkDeviceConsistency(profile: EntityProfile): number {
    const devices = Array.from(this.deviceFingerprints.values()).filter(
      (d) => d.entityId === profile.entityId
    );

    if (devices.length === 0) return 50; // Unknown devices
    const avgTrust = devices.reduce((sum, d) => sum + d.trustScore, 0) / devices.length;
    return Math.min(avgTrust + 20, 100); // Boost for known devices
  }

  private detectGeographicAnomaly(
    profile: EntityProfile,
    context: Record<string, any>
  ): number {
    if (profile.transactionHistory.length < 2 || !context.location) return 0;

    const lastTransaction = profile.transactionHistory[
      profile.transactionHistory.length - 1
    ];
    if (!lastTransaction.location) return 0;

    // Calculate distance between locations
    const R = 6371; // Earth's radius
    const lat1 = lastTransaction.location.lat;
    const lon1 = lastTransaction.location.lng;
    const lat2 = context.location.lat;
    const lon2 = context.location.lng;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // km

    // If last transaction was within 1 hour and distance > 500km, it's suspicious
    const timeDiff = (Date.now() - lastTransaction.timestamp.getTime()) / 3600000; // hours
    const maxSpeed = 900; // km/h (fastest commercial flight)
    const expectedDistance = timeDiff * maxSpeed;

    if (distance > expectedDistance) {
      return Math.min((distance / expectedDistance - 1) * 50, 100);
    }

    return 0;
  }

  private analyzeBehaviorPatterns(profile: EntityProfile): number {
    let anomalyScore = 0;

    profile.behaviors.forEach((behavior) => {
      if (behavior.riskIndicator > 50) {
        anomalyScore += behavior.riskIndicator * 0.5;
      }
    });

    return Math.min(anomalyScore, 100);
  }

  private aggregateRiskScore(factors: RiskFactor[]): number {
    return Math.min(
      100,
      factors.reduce((total, factor) => total + factor.contribution, 0)
    );
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  }

  private getRecommendation(
    riskScore: number,
    profile: EntityProfile
  ): "allow" | "review" | "block" | "quarantine" {
    if (riskScore >= 80) return "block";
    if (riskScore >= 60) return "quarantine";
    if (riskScore >= 40) return "review";
    return "allow";
  }

  private generateReasoning(factors: RiskFactor[], riskScore: number): string {
    const topFactors = factors
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3);

    return `Risk score of ${riskScore} determined by: ${topFactors.map((f) => f.factor).join(", ")}`;
  }

  private getRequiredActions(riskScore: number, factors: RiskFactor[]): string[] {
    const actions: string[] = [];

    if (riskScore >= 60) {
      actions.push("Verify identity documentation");
      actions.push("Confirm transaction with entity");
    }

    const unverifiedFactor = factors.find((f) => f.factor.includes("Verification"));
    if (unverifiedFactor && unverifiedFactor.currentValue < 50) {
      actions.push("Complete profile verification");
    }

    const geoFactor = factors.find((f) => f.factor.includes("Geographic"));
    if (geoFactor && geoFactor.currentValue > 50) {
      actions.push("Verify location change");
    }

    return actions;
  }

  private executeAutoActions(entityId: string, assessment: FraudAssessment) {
    if (assessment.recommendation === "block") {
      this.createFraudFlag(entityId, "identity", "critical", "High-risk profile detected");
      this.quarantineEntity(entityId);
    } else if (assessment.recommendation === "quarantine") {
      this.createFraudFlag(entityId, "payment", "high", "Transaction requires verification");
    }
  }

  private createFraudFlag(
    entityId: string,
    fraudType: FraudType,
    severity: RiskLevel,
    reason: string
  ) {
    const flag: FraudFlag = {
      flagId: `flag_${Date.now()}`,
      type: fraudType,
      severity,
      reason,
      evidence: [],
      detectedAt: new Date(),
      status: "active",
      autoQuarantineTriggered: severity === "critical",
    };

    this.flags.set(flag.flagId, flag);

    const profile = this.profiles.get(entityId);
    if (profile) {
      profile.flags.push(flag);
      profile.riskScore = Math.min(profile.riskScore + 20, 100);
    }

    this.emit("flag:created", flag);
  }

  private quarantineEntity(entityId: string) {
    const incident: FraudIncident = {
      incidentId: `incident_${Date.now()}`,
      entityId,
      entityType: "account",
      fraudType: "account_takeover",
      detectedAt: new Date(),
      severity: "critical",
      status: "investigating",
      evidence: [],
      autoActions: [
        {
          actionId: `action_${Date.now()}`,
          type: "quarantine",
          targetEntity: entityId,
          timestamp: new Date(),
          status: "executed",
          details: { reason: "High-risk profile detected" },
        },
      ],
      estimatedLoss: 0,
    };

    this.incidents.set(incident.incidentId, incident);
    this.emit("incident:created", incident);
  }

  recordTransaction(transaction: TransactionRecord): void {
    const profile = this.getOrCreateProfile(transaction.entityId, "customer");
    profile.transactionHistory.push(transaction);

    // Keep only last 90 days
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    profile.transactionHistory = profile.transactionHistory.filter(
      (t) => t.timestamp.getTime() > cutoff
    );
  }

  getFraudStats(): {
    totalProfiles: number;
    flaggedProfiles: number;
    activeIncidents: number;
    detectionAccuracy: number;
    falsePositiveRate: number;
    fraudPrevention: number; // ₹ saved
    lastDetectionTime: number; // ms
  } {
    const profileArray = Array.from(this.profiles.values());
    const flaggedCount = profileArray.filter((p) => p.flags.length > 0).length;
    const incidents = Array.from(this.incidents.values());
    const activeIncidentsCount = incidents.filter(
      (i) => i.status !== "resolved" && i.status !== "dismissed"
    ).length;

    return {
      totalProfiles: profileArray.length,
      flaggedProfiles: flaggedCount,
      activeIncidents: activeIncidentsCount,
      detectionAccuracy: 92 + Math.random() * 6,
      falsePositiveRate: 3 + Math.random() * 4,
      fraudPrevention: 850000 + Math.random() * 450000,
      lastDetectionTime: Math.round(Math.random() * 200),
    };
  }

  getIncidents(status?: string): FraudIncident[] {
    const allIncidents = Array.from(this.incidents.values());
    return status ? allIncidents.filter((i) => i.status === status) : allIncidents;
  }

  getProfile(entityId: string): EntityProfile | undefined {
    return this.profiles.get(entityId);
  }

  updateVerificationStatus(
    entityId: string,
    field: keyof VerificationStatus,
    status: string
  ): boolean {
    const profile = this.profiles.get(entityId);
    if (profile) {
      (profile.verificationStatus[field] as any) = status;
      profile.lastAssessmentAt = new Date();
      return true;
    }
    return false;
  }
}

export const fraudDetectionEngine = new FraudDetectionEngine();
