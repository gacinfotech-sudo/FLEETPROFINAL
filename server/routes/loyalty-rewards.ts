import express from "express";
import { loyaltyRewardsEngine } from "../services/loyaltyRewardsEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// GET /api/loyalty/profile/:customerId - Get loyalty profile
router.get("/profile/:customerId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const profile = loyaltyRewardsEngine.getProfile(req.params.customerId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch profile",
    });
  }
});

// POST /api/loyalty/points/earn - Earn points
router.post("/points/earn", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId, points, reason, rideId } = req.body;

    if (!customerId || !points || !reason) {
      return res.status(400).json({
        success: false,
        error: "customerId, points, and reason are required",
      });
    }

    const transaction = loyaltyRewardsEngine.earnPoints(
      customerId,
      points,
      reason,
      rideId
    );

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    console.error("Error earning points:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to earn points",
    });
  }
});

// POST /api/loyalty/points/redeem - Redeem points
router.post("/points/redeem", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId, points, rewardType, description } = req.body;

    if (!customerId || !points || !rewardType) {
      return res.status(400).json({
        success: false,
        error: "customerId, points, and rewardType are required",
      });
    }

    const redemption = loyaltyRewardsEngine.redeemPoints(
      customerId,
      points,
      rewardType,
      description || "Reward redemption"
    );

    if (!redemption) {
      return res.status(400).json({
        success: false,
        error: "Insufficient points or invalid request",
      });
    }

    res.json({
      success: true,
      data: redemption,
    });
  } catch (error: any) {
    console.error("Error redeeming points:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to redeem points",
    });
  }
});

// GET /api/loyalty/tiers - Get all tier benefits
router.get("/tiers", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const tiers = loyaltyRewardsEngine.getAllTierBenefits();

    res.json({
      success: true,
      data: tiers,
      count: tiers.length,
    });
  } catch (error: any) {
    console.error("Error fetching tiers:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch tiers",
    });
  }
});

// GET /api/loyalty/tier/:tier - Get specific tier benefits
router.get("/tier/:tier", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const tier = loyaltyRewardsEngine.getTierBenefits(req.params.tier as any);

    if (!tier) {
      return res.status(404).json({
        success: false,
        error: "Tier not found",
      });
    }

    res.json({
      success: true,
      data: tier,
    });
  } catch (error: any) {
    console.error("Error fetching tier:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch tier",
    });
  }
});

// GET /api/loyalty/transactions/:customerId - Get transaction history
router.get("/transactions/:customerId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { limit } = req.query;
    const transactions = loyaltyRewardsEngine.getTransactionHistory(
      req.params.customerId,
      limit ? parseInt(limit) : 50
    );

    res.json({
      success: true,
      data: transactions,
      count: transactions.length,
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch transactions",
    });
  }
});

// POST /api/loyalty/referral - Create referral
router.post("/referral", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: "customerId is required",
      });
    }

    const referral = loyaltyRewardsEngine.createReferral(customerId);

    res.json({
      success: true,
      data: referral,
    });
  } catch (error: any) {
    console.error("Error creating referral:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create referral",
    });
  }
});

// POST /api/loyalty/referral/complete - Complete referral
router.post("/referral/complete", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { referralCode, refereeId } = req.body;

    if (!referralCode || !refereeId) {
      return res.status(400).json({
        success: false,
        error: "referralCode and refereeId are required",
      });
    }

    const success = loyaltyRewardsEngine.completeReferral(referralCode, refereeId);

    if (!success) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired referral code",
      });
    }

    res.json({
      success: true,
      message: "Referral completed successfully",
    });
  } catch (error: any) {
    console.error("Error completing referral:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to complete referral",
    });
  }
});

// POST /api/loyalty/milestone - Add milestone reward
router.post("/milestone", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId, milestone, type } = req.body;

    if (!customerId || !milestone || !type) {
      return res.status(400).json({
        success: false,
        error: "customerId, milestone, and type are required",
      });
    }

    const milestoneReward = loyaltyRewardsEngine.addMilestoneReward(
      customerId,
      milestone,
      type
    );

    res.json({
      success: true,
      data: milestoneReward,
    });
  } catch (error: any) {
    console.error("Error adding milestone:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add milestone",
    });
  }
});

// POST /api/loyalty/milestone/:milestoneId/claim - Claim milestone reward
router.post("/milestone/:milestoneId/claim", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const success = loyaltyRewardsEngine.claimMilestoneReward(req.params.milestoneId);

    if (!success) {
      return res.status(400).json({
        success: false,
        error: "Milestone not found or already claimed",
      });
    }

    res.json({
      success: true,
      message: "Milestone reward claimed successfully",
    });
  } catch (error: any) {
    console.error("Error claiming milestone:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to claim milestone",
    });
  }
});

// GET /api/loyalty/challenges - Get active challenges
router.get("/challenges", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const challenges = loyaltyRewardsEngine.getChallenges();

    res.json({
      success: true,
      data: challenges,
      count: challenges.length,
    });
  } catch (error: any) {
    console.error("Error fetching challenges:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch challenges",
    });
  }
});

// GET /api/loyalty/stats - Get loyalty statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = loyaltyRewardsEngine.getLoyaltyStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch stats",
    });
  }
});

// POST /api/loyalty/test - Test loyalty engine
router.post("/test", (req: any, res) => {
  try {
    // Create or get profiles
    const profile1 = loyaltyRewardsEngine.createOrGetProfile("customer_001");
    const profile2 = loyaltyRewardsEngine.createOrGetProfile("customer_002");

    // Earn points
    const earn1 = loyaltyRewardsEngine.earnPoints(
      "customer_001",
      100,
      "completed_ride",
      "ride_001"
    );

    const earn2 = loyaltyRewardsEngine.earnPoints(
      "customer_001",
      50,
      "referral_bonus"
    );

    // Redeem points
    const redeem = loyaltyRewardsEngine.redeemPoints(
      "customer_001",
      75,
      "cash_credit",
      "Cashback redemption"
    );

    // Create referral
    const referral = loyaltyRewardsEngine.createReferral("customer_001");

    // Complete referral
    loyaltyRewardsEngine.completeReferral(referral.referralCode, "customer_002");

    // Add milestone
    const milestone = loyaltyRewardsEngine.addMilestoneReward("customer_001", 10, "rides");

    // Claim milestone
    loyaltyRewardsEngine.claimMilestoneReward(milestone.milestoneId);

    // Get stats
    const stats = loyaltyRewardsEngine.getLoyaltyStats();
    const challenges = loyaltyRewardsEngine.getChallenges();
    const tiers = loyaltyRewardsEngine.getAllTierBenefits();
    const updatedProfile = loyaltyRewardsEngine.getProfile("customer_001");

    res.json({
      success: true,
      profile: updatedProfile,
      earnings: [earn1, earn2],
      redemption: redeem,
      referral,
      milestone,
      stats,
      challengeCount: challenges.length,
      tierCount: tiers.length,
      summary: {
        profilesCreated: 2,
        pointsEarned: 150,
        pointsRedeemed: 75,
        referralCompleted: 1,
        milestoneClaimed: 1,
        totalMembers: stats.totalMembers,
        pointsInCirculation: stats.pointsInCirculation,
        avgPointsPerMember: stats.avgPointsPerMember,
      },
    });
  } catch (error: any) {
    console.error("Error testing loyalty engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test loyalty engine",
    });
  }
});

export default router;
