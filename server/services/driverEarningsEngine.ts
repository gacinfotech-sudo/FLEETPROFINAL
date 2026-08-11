import { EventEmitter } from "events";

export type CommissionType = "percentage" | "fixed" | "tiered" | "performance_bonus";
export type EarningsStatus = "pending" | "approved" | "processing" | "completed" | "failed";
export type PayoutMethod = "bank_transfer" | "wallet" | "upi" | "check";
export type EarningsPeriod = "daily" | "weekly" | "biweekly" | "monthly";

export interface DriverEarning {
  earningId: string;
  driverId: string;
  bookingId: string;
  fareAmount: number;
  platformFee: number;
  commission: number;
  incentiveBonus: number;
  netEarning: number;
  status: EarningsStatus;
  createdAt: Date;
  completedAt?: Date;
  payoutId?: string;
  notes?: string;
}

export interface CommissionRule {
  ruleId: string;
  driverId: string;
  type: CommissionType;
  rate: number; // percentage or fixed amount
  minRidesPerDay?: number;
  minRating?: number;
  startDate: Date;
  endDate?: Date;
  active: boolean;
  tierBoundaries?: { threshold: number; rate: number }[]; // For tiered commissions
}

export interface PerformanceIncentive {
  incentiveId: string;
  driverId: string;
  type: "rides_completed" | "rating_bonus" | "on_time_bonus" | "safety_bonus" | "referral_bonus";
  targetMetric: number;
  bonusAmount: number;
  period: EarningsPeriod;
  currentProgress: number;
  achieved: boolean;
  completedAt?: Date;
  expiresAt: Date;
}

export interface EarningsStatement {
  statementId: string;
  driverId: string;
  period: string; // "2026-08" format
  startDate: Date;
  endDate: Date;
  totalEarnings: number;
  totalCommissions: number;
  totalIncentives: number;
  totalPlatformFees: number;
  netAmount: number;
  ridesCompleted: number;
  avgRating: number;
  totalDistance: number;
  totalTime: number;
  status: EarningsStatus;
  generatedAt: Date;
  payoutDetails?: {
    method: PayoutMethod;
    amount: number;
    processedAt?: Date;
    transactionId?: string;
  };
}

export interface Payout {
  payoutId: string;
  driverId: string;
  amount: number;
  method: PayoutMethod;
  status: "scheduled" | "processing" | "completed" | "failed" | "reversed";
  scheduledDate: Date;
  processedDate?: Date;
  transactionId?: string;
  failureReason?: string;
  bankDetails?: {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
  };
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverFinancialProfile {
  profileId: string;
  driverId: string;
  totalLifetimeEarnings: number;
  currentMonthEarnings: number;
  currentMonthRides: number;
  avgDailyEarnings: number;
  avgEarningsPerRide: number;
  totalRidesCompleted: number;
  avgRating: number;
  accountStatus: "active" | "suspended" | "terminated";
  taxFilingStatus: "pending" | "filed" | "approved";
  bankAccountVerified: boolean;
  payoutPreference: PayoutMethod;
  lastPayoutDate?: Date;
  totalPayoutsReceived: number;
  totalPendingAmount: number;
  lastUpdated: Date;
}

export interface DeductionRecord {
  deductionId: string;
  driverId: string;
  earningId: string;
  type: "damage" | "cancellation_penalty" | "safety_violation" | "late_payment_fee" | "adjustment";
  amount: number;
  reason: string;
  approvedBy: string;
  createdAt: Date;
  status: "pending" | "approved" | "disputed" | "resolved";
}

class DriverEarningsEngine extends EventEmitter {
  private earnings: Map<string, DriverEarning> = new Map();
  private commissionRules: Map<string, CommissionRule> = new Map();
  private incentives: Map<string, PerformanceIncentive> = new Map();
  private statements: Map<string, EarningsStatement> = new Map();
  private payouts: Map<string, Payout> = new Map();
  private profiles: Map<string, DriverFinancialProfile> = new Map();
  private deductions: Map<string, DeductionRecord> = new Map();

  constructor() {
    super();
    this.setupDefaultRules();
  }

  private setupDefaultRules() {
    const defaultRule: CommissionRule = {
      ruleId: "rule_default",
      driverId: "default",
      type: "percentage",
      rate: 20, // 20% commission
      minRating: 4.0,
      startDate: new Date(),
      active: true,
    };

    this.commissionRules.set(defaultRule.ruleId, defaultRule);
  }

  recordEarning(
    driverId: string,
    bookingId: string,
    fareAmount: number,
    platformFee: number
  ): DriverEarning {
    const earning: DriverEarning = {
      earningId: `earn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      driverId,
      bookingId,
      fareAmount,
      platformFee,
      commission: this.calculateCommission(driverId, fareAmount),
      incentiveBonus: 0,
      netEarning: 0,
      status: "pending",
      createdAt: new Date(),
    };

    // Calculate net earning
    earning.netEarning = fareAmount - earning.commission - platformFee;

    // Check for bonuses
    const incentive = this.getActiveIncentive(driverId);
    if (incentive) {
      incentive.currentProgress++;
      if (incentive.currentProgress >= incentive.targetMetric) {
        earning.incentiveBonus = incentive.bonusAmount;
        earning.netEarning += earning.incentiveBonus;
        incentive.achieved = true;
        incentive.completedAt = new Date();
      }
    }

    this.earnings.set(earning.earningId, earning);
    this.updateFinancialProfile(driverId, earning);

    this.emit("earning:recorded", earning);
    return earning;
  }

  private calculateCommission(driverId: string, fareAmount: number): number {
    const rule = this.getApplicableRule(driverId);
    if (!rule) return fareAmount * 0.2; // Default 20%

    if (rule.type === "percentage") {
      return fareAmount * (rule.rate / 100);
    } else if (rule.type === "fixed") {
      return rule.rate;
    } else if (rule.type === "tiered" && rule.tierBoundaries) {
      const tier = rule.tierBoundaries.find((t) => fareAmount >= t.threshold);
      if (tier) {
        return fareAmount * (tier.rate / 100);
      }
      return fareAmount * (rule.rate / 100);
    }

    return fareAmount * (rule.rate / 100);
  }

  private getApplicableRule(driverId: string): CommissionRule | null {
    // Try to find driver-specific rule
    let rule = Array.from(this.commissionRules.values()).find(
      (r) => r.driverId === driverId && r.active
    );

    // Fall back to default rule
    if (!rule) {
      rule = Array.from(this.commissionRules.values()).find(
        (r) => r.driverId === "default" && r.active
      );
    }

    return rule || null;
  }

  private getActiveIncentive(driverId: string): PerformanceIncentive | null {
    return (
      Array.from(this.incentives.values()).find(
        (i) => i.driverId === driverId && !i.achieved && i.expiresAt > new Date()
      ) || null
    );
  }

  private updateFinancialProfile(driverId: string, earning: DriverEarning) {
    let profile = this.profiles.get(driverId);

    if (!profile) {
      profile = {
        profileId: `prof_${driverId}`,
        driverId,
        totalLifetimeEarnings: 0,
        currentMonthEarnings: 0,
        currentMonthRides: 0,
        avgDailyEarnings: 0,
        avgEarningsPerRide: 0,
        totalRidesCompleted: 0,
        avgRating: 4.5,
        accountStatus: "active",
        taxFilingStatus: "pending",
        bankAccountVerified: false,
        payoutPreference: "bank_transfer",
        totalPayoutsReceived: 0,
        totalPendingAmount: 0,
        lastUpdated: new Date(),
      };
    }

    profile.totalLifetimeEarnings += earning.netEarning;
    profile.currentMonthEarnings += earning.netEarning;
    profile.currentMonthRides++;
    profile.totalRidesCompleted++;
    profile.avgEarningsPerRide =
      profile.totalLifetimeEarnings / profile.totalRidesCompleted;
    profile.avgDailyEarnings =
      profile.currentMonthEarnings / Math.max(1, Math.ceil(profile.currentMonthRides / 5));
    profile.totalPendingAmount += earning.netEarning;
    profile.lastUpdated = new Date();

    this.profiles.set(driverId, profile);
  }

  createCommissionRule(
    driverId: string,
    type: CommissionType,
    rate: number,
    minRating?: number
  ): CommissionRule {
    const rule: CommissionRule = {
      ruleId: `rule_${Date.now()}`,
      driverId,
      type,
      rate,
      minRating,
      startDate: new Date(),
      active: true,
    };

    this.commissionRules.set(rule.ruleId, rule);
    this.emit("rule:created", rule);
    return rule;
  }

  createIncentive(
    driverId: string,
    type: PerformanceIncentive["type"],
    targetMetric: number,
    bonusAmount: number,
    period: EarningsPeriod
  ): PerformanceIncentive {
    const expiresAt = new Date();
    if (period === "daily") expiresAt.setDate(expiresAt.getDate() + 1);
    else if (period === "weekly") expiresAt.setDate(expiresAt.getDate() + 7);
    else if (period === "biweekly") expiresAt.setDate(expiresAt.getDate() + 14);
    else if (period === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);

    const incentive: PerformanceIncentive = {
      incentiveId: `incent_${Date.now()}`,
      driverId,
      type,
      targetMetric,
      bonusAmount,
      period,
      currentProgress: 0,
      achieved: false,
      expiresAt,
    };

    this.incentives.set(incentive.incentiveId, incentive);
    this.emit("incentive:created", incentive);
    return incentive;
  }

  generateEarningsStatement(driverId: string, period: string): EarningsStatement {
    const [year, month] = period.split("-");
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const periodEarnings = Array.from(this.earnings.values()).filter(
      (e) =>
        e.driverId === driverId &&
        e.createdAt >= startDate &&
        e.createdAt <= endDate &&
        e.status !== "failed"
    );

    const totalEarnings = periodEarnings.reduce((sum, e) => sum + e.fareAmount, 0);
    const totalCommissions = periodEarnings.reduce((sum, e) => sum + e.commission, 0);
    const totalIncentives = periodEarnings.reduce((sum, e) => sum + e.incentiveBonus, 0);
    const totalPlatformFees = periodEarnings.reduce((sum, e) => sum + e.platformFee, 0);
    const netAmount =
      totalEarnings - totalCommissions - totalPlatformFees + totalIncentives;

    const statement: EarningsStatement = {
      statementId: `stmt_${Date.now()}`,
      driverId,
      period,
      startDate,
      endDate,
      totalEarnings,
      totalCommissions,
      totalIncentives,
      totalPlatformFees,
      netAmount,
      ridesCompleted: periodEarnings.length,
      avgRating: 4.5,
      totalDistance: periodEarnings.length * 15, // Assume 15 km avg
      totalTime: periodEarnings.length * 25, // Assume 25 min avg
      status: "approved",
      generatedAt: new Date(),
    };

    this.statements.set(statement.statementId, statement);
    this.emit("statement:generated", statement);
    return statement;
  }

  requestPayout(
    driverId: string,
    amount: number,
    method: PayoutMethod,
    bankDetails?: any,
    upiId?: string
  ): Payout {
    const profile = this.profiles.get(driverId);
    if (!profile || profile.totalPendingAmount < amount) {
      throw new Error("Insufficient pending amount for payout");
    }

    const payout: Payout = {
      payoutId: `payout_${Date.now()}`,
      driverId,
      amount,
      method,
      status: "scheduled",
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      bankDetails,
      upiId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payouts.set(payout.payoutId, payout);
    profile.totalPendingAmount -= amount;

    this.emit("payout:requested", payout);
    return payout;
  }

  processPayout(payoutId: string, transactionId: string): boolean {
    const payout = this.payouts.get(payoutId);
    if (!payout) return false;

    payout.status = "completed";
    payout.processedDate = new Date();
    payout.transactionId = transactionId;

    const profile = this.profiles.get(payout.driverId);
    if (profile) {
      profile.totalPayoutsReceived += payout.amount;
      profile.lastPayoutDate = new Date();
    }

    this.emit("payout:processed", payout);
    return true;
  }

  recordDeduction(
    driverId: string,
    earningId: string,
    type: DeductionRecord["type"],
    amount: number,
    reason: string,
    approvedBy: string
  ): DeductionRecord {
    const deduction: DeductionRecord = {
      deductionId: `ded_${Date.now()}`,
      driverId,
      earningId,
      type,
      amount,
      reason,
      approvedBy,
      createdAt: new Date(),
      status: "pending",
    };

    this.deductions.set(deduction.deductionId, deduction);

    // Deduct from pending amount
    const profile = this.profiles.get(driverId);
    if (profile) {
      profile.totalPendingAmount -= amount;
    }

    this.emit("deduction:recorded", deduction);
    return deduction;
  }

  getDriverProfile(driverId: string): DriverFinancialProfile | undefined {
    return this.profiles.get(driverId);
  }

  getEarning(earningId: string): DriverEarning | undefined {
    return this.earnings.get(earningId);
  }

  getStatement(statementId: string): EarningsStatement | undefined {
    return this.statements.get(statementId);
  }

  getDriverStatements(driverId: string): EarningsStatement[] {
    return Array.from(this.statements.values()).filter((s) => s.driverId === driverId);
  }

  getPendingPayouts(driverId: string): Payout[] {
    return Array.from(this.payouts.values()).filter(
      (p) => p.driverId === driverId && p.status === "scheduled"
    );
  }

  getEarningsAnalytics(driverId: string) {
    const driverEarnings = Array.from(this.earnings.values()).filter(
      (e) => e.driverId === driverId
    );
    const profile = this.profiles.get(driverId);

    const dailyBreakdown: { [key: string]: number } = {};
    driverEarnings.forEach((e) => {
      const date = new Date(e.createdAt).toISOString().split("T")[0];
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + e.netEarning;
    });

    const incentivesEarned = driverEarnings.reduce(
      (sum, e) => sum + e.incentiveBonus,
      0
    );
    const commissionsDeducted = driverEarnings.reduce(
      (sum, e) => sum + e.commission,
      0
    );

    return {
      totalEarnings: profile?.totalLifetimeEarnings || 0,
      currentMonthEarnings: profile?.currentMonthEarnings || 0,
      totalRidesCompleted: profile?.totalRidesCompleted || 0,
      avgEarningsPerRide: profile?.avgEarningsPerRide || 0,
      incentivesEarned,
      commissionsDeducted,
      pendingAmount: profile?.totalPendingAmount || 0,
      payoutsReceived: profile?.totalPayoutsReceived || 0,
      dailyBreakdown,
      topEarningDays: Object.entries(dailyBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([date, amount]) => ({ date, amount })),
    };
  }

  getTaxSummary(driverId: string): {
    taxableIncome: number;
    estimatedTax: number;
    deductionsAllowed: number;
    netTaxableIncome: number;
  } {
    const profile = this.profiles.get(driverId);
    const taxableIncome = profile?.totalLifetimeEarnings || 0;
    const deductionsAllowed = taxableIncome * 0.1; // 10% standard deduction
    const netTaxableIncome = taxableIncome - deductionsAllowed;
    const estimatedTax = netTaxableIncome * 0.3; // 30% tax rate

    return {
      taxableIncome,
      estimatedTax,
      deductionsAllowed,
      netTaxableIncome,
    };
  }
}

export const driverEarningsEngine = new DriverEarningsEngine();
