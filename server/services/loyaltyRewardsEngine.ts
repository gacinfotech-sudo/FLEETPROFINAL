import { EventEmitter } from "events";

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type RewardType = "points" | "cash_credit" | "discount" | "free_ride" | "milestone_bonus";
export type RedemptionStatus = "pending" | "approved" | "processed" | "cancelled" | "expired";

export interface LoyaltyProfile {
  profileId: string;
  customerId: string;
  tier: LoyaltyTier;
  totalPoints: number;
  usedPoints: number;
  availablePoints: number;
  totalRidesCount: number;
  totalSpent: number; // ₹
  joinedAt: Date;
  tierUpgradedAt?: Date;
  tierDowngradedAt?: Date;
  nextTierAt?: Date; // Amount needed to reach next tier
  status: "active" | "inactive" | "suspended";
  lastActivityDate?: Date;
  referralCode: string;
  referralCount: number;
  lastUpdated: Date;
}

export interface TierBenefits {
  tier: LoyaltyTier;
  minPoints: number;
  pointsPerRide: number; // Points earned per ride
  rideDiscount: number; // percentage
  monthlyBonus: number; // bonus points
  birthday: number; // birthday bonus points
  freeRides: number; // free rides per month
  prioritySupport: boolean;
  exclusiveOffers: boolean;
  badges: string[];
  description: string;
}

export interface RewardPointTransaction {
  transactionId: string;
  customerId: string;
  type: "earn" | "redeem" | "refund" | "bonus" | "expiry";
  points: number;
  reason: string; // "completed_ride", "referral", "discount_redemption", etc.
  rideId?: string;
  bookingId?: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: Date;
  expiryDate?: Date;
}

export interface RewardRedemption {
  redemptionId: string;
  customerId: string;
  rewardType: RewardType;
  pointsSpent: number;
  valueProvided: number; // ₹ or percentage
  description: string;
  status: RedemptionStatus;
  requestedAt: Date;
  processedAt?: Date;
  validUntil: Date;
  code?: string; // Redemption code
  appliedToRideId?: string;
}

export interface ReferralProgram {
  referralId: string;
  referrerId: string; // Customer who referred
  refereeId?: string; // New customer referred
  referralCode: string;
  bonusPoints: number; // Points for referrer
  status: "active" | "pending" | "completed" | "cancelled";
  createdAt: Date;
  completedAt?: Date;
  expiryDate: Date;
}

export interface LoyaltyChallenge {
  challengeId: string;
  title: string;
  description: string;
  type: "rides" | "spending" | "referrals" | "frequency";
  target: number;
  reward: number; // bonus points
  startDate: Date;
  endDate: Date;
  active: boolean;
  participantCount: number;
}

export interface MilestoneReward {
  milestoneId: string;
  customerId: string;
  milestone: number; // rides: 10, 25, 50, 100, 250, 500, 1000
  type: "rides" | "spending";
  rewardPoints: number;
  bonusReward?: string; // Special reward description
  unlockedAt: Date;
  claimed: boolean;
  claimedAt?: Date;
}

class LoyaltyRewardsEngine extends EventEmitter {
  private profiles: Map<string, LoyaltyProfile> = new Map();
  private tierBenefits: Map<LoyaltyTier, TierBenefits> = new Map();
  private transactions: Map<string, RewardPointTransaction> = new Map();
  private redemptions: Map<string, RewardRedemption> = new Map();
  private referrals: Map<string, ReferralProgram> = new Map();
  private challenges: Map<string, LoyaltyChallenge> = new Map();
  private milestones: Map<string, MilestoneReward> = new Map();
  private transactionHistory: RewardPointTransaction[] = [];

  constructor() {
    super();
    this.setupTierBenefits();
    this.setupChallenges();
  }

  private setupTierBenefits() {
    const benefits: TierBenefits[] = [
      {
        tier: "bronze",
        minPoints: 0,
        pointsPerRide: 10,
        rideDiscount: 5,
        monthlyBonus: 50,
        birthday: 100,
        freeRides: 0,
        prioritySupport: false,
        exclusiveOffers: false,
        badges: ["🥉 Bronze Member"],
        description: "Welcome to loyalty program",
      },
      {
        tier: "silver",
        minPoints: 500,
        pointsPerRide: 15,
        rideDiscount: 10,
        monthlyBonus: 100,
        birthday: 200,
        freeRides: 1,
        prioritySupport: false,
        exclusiveOffers: true,
        badges: ["🥈 Silver Member"],
        description: "Building rewards",
      },
      {
        tier: "gold",
        minPoints: 2000,
        pointsPerRide: 20,
        rideDiscount: 15,
        monthlyBonus: 200,
        birthday: 300,
        freeRides: 2,
        prioritySupport: true,
        exclusiveOffers: true,
        badges: ["🥇 Gold Member"],
        description: "Premium benefits",
      },
      {
        tier: "platinum",
        minPoints: 5000,
        pointsPerRide: 25,
        rideDiscount: 20,
        monthlyBonus: 300,
        birthday: 500,
        freeRides: 3,
        prioritySupport: true,
        exclusiveOffers: true,
        badges: ["💎 Platinum Member", "VIP Access"],
        description: "Elite status",
      },
      {
        tier: "diamond",
        minPoints: 10000,
        pointsPerRide: 30,
        rideDiscount: 25,
        monthlyBonus: 500,
        birthday: 1000,
        freeRides: 5,
        prioritySupport: true,
        exclusiveOffers: true,
        badges: ["👑 Diamond Member", "VIP Elite", "Lifetime Rewards"],
        description: "Highest tier status",
      },
    ];

    benefits.forEach((b) => this.tierBenefits.set(b.tier, b));
  }

  private setupChallenges() {
    const challenges: LoyaltyChallenge[] = [
      {
        challengeId: "chal_1",
        title: "Complete 5 Rides",
        description: "Take 5 rides this week",
        type: "rides",
        target: 5,
        reward: 250,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        active: true,
        participantCount: 1245,
      },
      {
        challengeId: "chal_2",
        title: "Spend ₹5000+",
        description: "Spend 5000 rupees this month",
        type: "spending",
        target: 5000,
        reward: 500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
        participantCount: 2340,
      },
      {
        challengeId: "chal_3",
        title: "Refer a Friend",
        description: "Refer 3 friends and earn rewards",
        type: "referrals",
        target: 3,
        reward: 600,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        active: true,
        participantCount: 890,
      },
    ];

    challenges.forEach((c) => this.challenges.set(c.challengeId, c));
  }

  createOrGetProfile(customerId: string): LoyaltyProfile {
    let profile = this.profiles.get(customerId);

    if (!profile) {
      profile = {
        profileId: `loy_${customerId}`,
        customerId,
        tier: "bronze",
        totalPoints: 0,
        usedPoints: 0,
        availablePoints: 0,
        totalRidesCount: 0,
        totalSpent: 0,
        joinedAt: new Date(),
        status: "active",
        referralCode: this.generateReferralCode(),
        referralCount: 0,
        lastUpdated: new Date(),
      };

      this.profiles.set(customerId, profile);
      this.emit("profile:created", profile);
    }

    return profile;
  }

  private generateReferralCode(): string {
    return `REF${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  earnPoints(
    customerId: string,
    points: number,
    reason: string,
    rideId?: string
  ): RewardPointTransaction {
    const profile = this.createOrGetProfile(customerId);

    const transaction: RewardPointTransaction = {
      transactionId: `txn_${Date.now()}`,
      customerId,
      type: "earn",
      points,
      reason,
      rideId,
      balanceBefore: profile.availablePoints,
      balanceAfter: 0,
      timestamp: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
    };

    profile.totalPoints += points;
    profile.availablePoints += points;
    profile.totalRidesCount++;
    profile.lastActivityDate = new Date();
    transaction.balanceAfter = profile.availablePoints;

    // Check tier upgrade
    this.checkTierUpgrade(profile);

    this.transactions.set(transaction.transactionId, transaction);
    this.transactionHistory.push(transaction);

    this.emit("points:earned", transaction);
    return transaction;
  }

  private checkTierUpgrade(profile: LoyaltyProfile) {
    const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];
    const tierPoints = { bronze: 0, silver: 500, gold: 2000, platinum: 5000, diamond: 10000 };

    for (const tier of tiers) {
      if (profile.totalPoints >= tierPoints[tier] && profile.tier !== tier) {
        const oldTier = profile.tier;
        profile.tier = tier;
        profile.tierUpgradedAt = new Date();
        this.emit("tier:upgraded", { customerId: profile.customerId, from: oldTier, to: tier });
        break;
      }
    }
  }

  redeemPoints(
    customerId: string,
    pointsToRedeem: number,
    rewardType: RewardType,
    description: string
  ): RewardRedemption | null {
    const profile = this.profiles.get(customerId);
    if (!profile || profile.availablePoints < pointsToRedeem) {
      return null;
    }

    // Calculate value based on redemption type
    let valueProvided = 0;
    if (rewardType === "cash_credit") {
      valueProvided = pointsToRedeem / 2; // 1 point = ₹0.5
    } else if (rewardType === "discount") {
      valueProvided = (pointsToRedeem / 100) * 5; // Discount percentage
    } else if (rewardType === "free_ride") {
      valueProvided = pointsToRedeem / 500; // Each free ride costs 500 points
    }

    const redemption: RewardRedemption = {
      redemptionId: `redeem_${Date.now()}`,
      customerId,
      rewardType,
      pointsSpent: pointsToRedeem,
      valueProvided,
      description,
      status: "approved",
      requestedAt: new Date(),
      processedAt: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days validity
      code: this.generateRedemptionCode(),
    };

    // Deduct points
    profile.availablePoints -= pointsToRedeem;
    profile.usedPoints += pointsToRedeem;
    profile.lastUpdated = new Date();

    // Record transaction
    const transaction: RewardPointTransaction = {
      transactionId: `txn_${Date.now()}`,
      customerId,
      type: "redeem",
      points: -pointsToRedeem,
      reason: `Redeemed for ${rewardType}`,
      balanceBefore: profile.availablePoints + pointsToRedeem,
      balanceAfter: profile.availablePoints,
      timestamp: new Date(),
    };

    this.transactions.set(transaction.transactionId, transaction);
    this.transactionHistory.push(transaction);
    this.redemptions.set(redemption.redemptionId, redemption);

    this.emit("points:redeemed", redemption);
    return redemption;
  }

  private generateRedemptionCode(): string {
    return `RED${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  createReferral(referrerId: string): ReferralProgram {
    const referral: ReferralProgram = {
      referralId: `ref_${Date.now()}`,
      referrerId,
      referralCode: this.generateReferralCode(),
      bonusPoints: 500,
      status: "active",
      createdAt: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    this.referrals.set(referral.referralId, referral);
    this.emit("referral:created", referral);
    return referral;
  }

  completeReferral(referralCode: string, refereeId: string): boolean {
    const referral = Array.from(this.referrals.values()).find(
      (r) => r.referralCode === referralCode
    );

    if (!referral || referral.status !== "active") return false;

    referral.refereeId = refereeId;
    referral.status = "completed";
    referral.completedAt = new Date();

    // Award points to referrer
    this.earnPoints(
      referral.referrerId,
      referral.bonusPoints,
      "Referral bonus",
      undefined
    );

    // Award welcome bonus to referee
    this.earnPoints(refereeId, 200, "Sign-up referral bonus", undefined);

    // Update referral count
    const profile = this.profiles.get(referral.referrerId);
    if (profile) {
      profile.referralCount++;
    }

    this.emit("referral:completed", referral);
    return true;
  }

  addMilestoneReward(
    customerId: string,
    milestone: number,
    type: "rides" | "spending"
  ): MilestoneReward {
    const rewardPoints =
      milestone === 10 ? 100 :
      milestone === 25 ? 300 :
      milestone === 50 ? 600 :
      milestone === 100 ? 1200 :
      milestone === 250 ? 3000 :
      milestone === 500 ? 6000 :
      milestone === 1000 ? 10000 : 0;

    const milestoneReward: MilestoneReward = {
      milestoneId: `mile_${Date.now()}`,
      customerId,
      milestone,
      type,
      rewardPoints,
      bonusReward: `🎉 ${milestone} ${type} milestone achieved!`,
      unlockedAt: new Date(),
      claimed: false,
    };

    this.milestones.set(milestoneReward.milestoneId, milestoneReward);
    this.emit("milestone:unlocked", milestoneReward);
    return milestoneReward;
  }

  claimMilestoneReward(milestoneId: string): boolean {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone || milestone.claimed) return false;

    milestone.claimed = true;
    milestone.claimedAt = new Date();

    this.earnPoints(
      milestone.customerId,
      milestone.rewardPoints,
      `Milestone reward: ${milestone.milestone} ${milestone.type}`,
      undefined
    );

    return true;
  }

  getProfile(customerId: string): LoyaltyProfile | undefined {
    return this.profiles.get(customerId);
  }

  getTierBenefits(tier: LoyaltyTier): TierBenefits | undefined {
    return this.tierBenefits.get(tier);
  }

  getAllTierBenefits(): TierBenefits[] {
    return Array.from(this.tierBenefits.values());
  }

  getTransactionHistory(customerId: string, limit: number = 50): RewardPointTransaction[] {
    return this.transactionHistory
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getRedemptions(customerId: string): RewardRedemption[] {
    return Array.from(this.redemptions.values()).filter(
      (r) => r.customerId === customerId
    );
  }

  getChallenges(): LoyaltyChallenge[] {
    return Array.from(this.challenges.values()).filter((c) => c.active);
  }

  getLoyaltyStats() {
    const profiles = Array.from(this.profiles.values());
    const totalMembers = profiles.length;
    const tierDistribution = {
      bronze: profiles.filter((p) => p.tier === "bronze").length,
      silver: profiles.filter((p) => p.tier === "silver").length,
      gold: profiles.filter((p) => p.tier === "gold").length,
      platinum: profiles.filter((p) => p.tier === "platinum").length,
      diamond: profiles.filter((p) => p.tier === "diamond").length,
    };

    const totalPointsIssued = this.transactionHistory
      .filter((t) => t.type === "earn")
      .reduce((sum, t) => sum + t.points, 0);

    const totalPointsRedeemed = this.transactionHistory
      .filter((t) => t.type === "redeem")
      .reduce((sum, t) => sum + Math.abs(t.points), 0);

    const avgPointsPerMember =
      totalMembers > 0 ? totalPointsIssued / totalMembers : 0;

    const activeReferrals = Array.from(this.referrals.values()).filter(
      (r) => r.status === "active"
    ).length;

    const completedReferrals = Array.from(this.referrals.values()).filter(
      (r) => r.status === "completed"
    ).length;

    return {
      timestamp: new Date(),
      totalMembers,
      tierDistribution,
      totalPointsIssued,
      totalPointsRedeemed,
      pointsInCirculation: totalPointsIssued - totalPointsRedeemed,
      avgPointsPerMember: Math.round(avgPointsPerMember),
      activeReferrals,
      completedReferrals,
      totalChallenges: this.challenges.size,
      activeChallenges: Array.from(this.challenges.values()).filter(
        (c) => c.active
      ).length,
    };
  }
}

export const loyaltyRewardsEngine = new LoyaltyRewardsEngine();
