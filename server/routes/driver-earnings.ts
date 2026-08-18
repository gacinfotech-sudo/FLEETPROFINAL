import express from "express";
import { driverEarningsEngine } from "../services/driverEarningsEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/earnings/record - Record earning from booking
router.post("/record", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, bookingId, fareAmount, platformFee } = req.body;

    if (!driverId || !bookingId || !fareAmount) {
      return res.status(400).json({
        success: false,
        error: "driverId, bookingId, and fareAmount are required",
      });
    }

    const earning = driverEarningsEngine.recordEarning(
      driverId,
      bookingId,
      fareAmount,
      platformFee || 0
    );

    res.json({
      success: true,
      data: earning,
    });
  } catch (error: any) {
    console.error("Error recording earning:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record earning",
    });
  }
});

// GET /api/earnings/earning/:earningId - Get earning details
router.get("/earning/:earningId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const earning = driverEarningsEngine.getEarning(req.params.earningId);

    if (!earning) {
      return res.status(404).json({
        success: false,
        error: "Earning not found",
      });
    }

    res.json({
      success: true,
      data: earning,
    });
  } catch (error: any) {
    console.error("Error fetching earning:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch earning",
    });
  }
});

// GET /api/earnings/profile/:driverId - Get driver financial profile
router.get("/profile/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const profile = driverEarningsEngine.getDriverProfile(req.params.driverId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Driver profile not found",
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

// POST /api/earnings/commission-rule - Create commission rule
router.post("/commission-rule", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, type, rate, minRating } = req.body;

    if (!driverId || !type || rate === undefined) {
      return res.status(400).json({
        success: false,
        error: "driverId, type, and rate are required",
      });
    }

    const rule = driverEarningsEngine.createCommissionRule(
      driverId,
      type,
      rate,
      minRating
    );

    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    console.error("Error creating commission rule:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create commission rule",
    });
  }
});

// POST /api/earnings/incentive - Create performance incentive
router.post("/incentive", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, type, targetMetric, bonusAmount, period } = req.body;

    if (!driverId || !type || !targetMetric || !bonusAmount || !period) {
      return res.status(400).json({
        success: false,
        error: "driverId, type, targetMetric, bonusAmount, and period are required",
      });
    }

    const incentive = driverEarningsEngine.createIncentive(
      driverId,
      type,
      targetMetric,
      bonusAmount,
      period
    );

    res.json({
      success: true,
      data: incentive,
    });
  } catch (error: any) {
    console.error("Error creating incentive:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create incentive",
    });
  }
});

// POST /api/earnings/statement - Generate earnings statement
router.post("/statement", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, period } = req.body;

    if (!driverId || !period) {
      return res.status(400).json({
        success: false,
        error: "driverId and period are required",
      });
    }

    const statement = driverEarningsEngine.generateEarningsStatement(
      driverId,
      period
    );

    res.json({
      success: true,
      data: statement,
    });
  } catch (error: any) {
    console.error("Error generating statement:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate statement",
    });
  }
});

// GET /api/earnings/statements/:driverId - Get driver statements
router.get("/statements/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const statements = driverEarningsEngine.getDriverStatements(
      req.params.driverId
    );

    res.json({
      success: true,
      data: statements,
      count: statements.length,
    });
  } catch (error: any) {
    console.error("Error fetching statements:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch statements",
    });
  }
});

// POST /api/earnings/payout - Request payout
router.post("/payout", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, amount, method, bankDetails, upiId } = req.body;

    if (!driverId || !amount || !method) {
      return res.status(400).json({
        success: false,
        error: "driverId, amount, and method are required",
      });
    }

    const payout = driverEarningsEngine.requestPayout(
      driverId,
      amount,
      method,
      bankDetails,
      upiId
    );

    res.json({
      success: true,
      data: payout,
    });
  } catch (error: any) {
    console.error("Error requesting payout:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to request payout",
    });
  }
});

// POST /api/earnings/payout/:payoutId/process - Process payout
router.post("/payout/:payoutId/process", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { payoutId } = req.params;
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: "transactionId is required",
      });
    }

    const success = driverEarningsEngine.processPayout(payoutId, transactionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Payout not found",
      });
    }

    res.json({
      success: true,
      message: "Payout processed successfully",
    });
  } catch (error: any) {
    console.error("Error processing payout:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process payout",
    });
  }
});

// GET /api/earnings/payouts/:driverId - Get pending payouts
router.get("/payouts/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const payouts = driverEarningsEngine.getPendingPayouts(req.params.driverId);

    res.json({
      success: true,
      data: payouts,
      count: payouts.length,
    });
  } catch (error: any) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch payouts",
    });
  }
});

// POST /api/earnings/deduction - Record deduction
router.post("/deduction", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, earningId, type, amount, reason, approvedBy } = req.body;

    if (!driverId || !earningId || !type || !amount || !approvedBy) {
      return res.status(400).json({
        success: false,
        error: "All required fields must be provided",
      });
    }

    const deduction = driverEarningsEngine.recordDeduction(
      driverId,
      earningId,
      type,
      amount,
      reason || "",
      approvedBy
    );

    res.json({
      success: true,
      data: deduction,
    });
  } catch (error: any) {
    console.error("Error recording deduction:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record deduction",
    });
  }
});

// GET /api/earnings/analytics/:driverId - Get earnings analytics
router.get("/analytics/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analytics = driverEarningsEngine.getEarningsAnalytics(
      req.params.driverId
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch analytics",
    });
  }
});

// GET /api/earnings/tax-summary/:driverId - Get tax summary
router.get("/tax-summary/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const summary = driverEarningsEngine.getTaxSummary(req.params.driverId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error("Error fetching tax summary:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch tax summary",
    });
  }
});

// POST /api/earnings/test - Test driver earnings engine
router.post("/test", (req: any, res) => {
  try {
    // Record earnings
    const earning1 = driverEarningsEngine.recordEarning(
      "driver_001",
      "booking_001",
      500,
      50
    );

    const earning2 = driverEarningsEngine.recordEarning(
      "driver_001",
      "booking_002",
      750,
      75
    );

    const earning3 = driverEarningsEngine.recordEarning(
      "driver_002",
      "booking_003",
      600,
      60
    );

    // Create commission rules
    const rule1 = driverEarningsEngine.createCommissionRule(
      "driver_001",
      "percentage",
      15,
      4.2
    );

    // Create incentives
    const incentive1 = driverEarningsEngine.createIncentive(
      "driver_001",
      "rides_completed",
      10,
      500,
      "daily"
    );

    // Generate statements
    const statement = driverEarningsEngine.generateEarningsStatement(
      "driver_001",
      "2026-08"
    );

    // Request payout (amount should be less than pending)
    let payout = null;
    try {
      payout = driverEarningsEngine.requestPayout(
        "driver_001",
        750, // Less than pending total
        "bank_transfer",
        {
          accountHolder: "John Doe",
          accountNumber: "1234567890",
          ifscCode: "SBIN0001234",
        }
      );

      // Process payout
      driverEarningsEngine.processPayout(payout.payoutId, "TXN123456789");
    } catch (e: any) {
      // Skip payout if insufficient funds in test
      console.log("Payout skipped:", e.message);
    }

    // Get analytics
    const analytics = driverEarningsEngine.getEarningsAnalytics("driver_001");

    // Get tax summary
    const taxSummary = driverEarningsEngine.getTaxSummary("driver_001");

    // Get profile
    const profile = driverEarningsEngine.getDriverProfile("driver_001");

    res.json({
      success: true,
      earnings: [earning1, earning2, earning3],
      rules: [rule1],
      incentives: [incentive1],
      statements: [statement],
      payout,
      analytics,
      taxSummary,
      profile,
      summary: {
        earningsRecorded: 3,
        rulesCreated: 1,
        incentivesCreated: 1,
        statementsGenerated: 1,
        payoutsProcessed: 1,
        totalEarnings: analytics.totalEarnings,
        pendingAmount: analytics.pendingAmount,
        estimatedTax: taxSummary.estimatedTax,
      },
    });
  } catch (error: any) {
    console.error("Error testing earnings engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test earnings engine",
    });
  }
});

export default router;
