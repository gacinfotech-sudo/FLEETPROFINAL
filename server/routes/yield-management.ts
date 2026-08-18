import express from "express";
import { yieldManagementEngine } from "../services/yieldManagementEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/yield/optimize - Generate optimization plan
router.post("/optimize", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const strategy = req.body.strategy || "balanced";

    const plan = yieldManagementEngine.generateOptimizationPlan(strategy);

    res.json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error("Error generating optimization plan:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate optimization plan",
    });
  }
});

// POST /api/yield/profitability - Analyze profitability
router.post("/profitability", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analysis = yieldManagementEngine.analyzeProfitability();

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    console.error("Error analyzing profitability:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze profitability",
    });
  }
});

// POST /api/yield/bundles - Create bundle offers
router.post("/bundles", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const offers = yieldManagementEngine.createBundleOffers();

    res.json({
      success: true,
      data: offers,
      count: offers.length,
    });
  } catch (error: any) {
    console.error("Error creating bundles:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create bundles",
    });
  }
});

// POST /api/yield/inventory/allocate - Allocate inventory
router.post("/inventory/allocate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const allocation = yieldManagementEngine.allocateInventory();

    res.json({
      success: true,
      data: allocation,
    });
  } catch (error: any) {
    console.error("Error allocating inventory:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to allocate inventory",
    });
  }
});

// GET /api/yield/stats - Get yield statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = yieldManagementEngine.getYieldStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching yield stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch yield stats",
    });
  }
});

// GET /api/yield/forecasts - Get revenue forecasts
router.get("/forecasts", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const forecasts = yieldManagementEngine.getRevenueForecasts();

    res.json({
      success: true,
      data: forecasts,
    });
  } catch (error: any) {
    console.error("Error fetching forecasts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch forecasts",
    });
  }
});

// POST /api/yield/test - Test yield management engine
router.post("/test", (req: any, res) => {
  try {
    // Generate optimization plans for different strategies
    const balancedPlan = yieldManagementEngine.generateOptimizationPlan("balanced");
    const revenuePlan = yieldManagementEngine.generateOptimizationPlan("maximize_revenue");
    const profitPlan = yieldManagementEngine.generateOptimizationPlan("maximize_profit");

    // Analyze profitability
    const profitability = yieldManagementEngine.analyzeProfitability();

    // Create bundles
    const bundles = yieldManagementEngine.createBundleOffers();

    // Allocate inventory
    const allocation = yieldManagementEngine.allocateInventory();

    // Get stats
    const stats = yieldManagementEngine.getYieldStats();

    // Get forecasts
    const forecasts = yieldManagementEngine.getRevenueForecasts();

    res.json({
      success: true,
      plans: {
        balanced: balancedPlan,
        revenue: revenuePlan,
        profit: profitPlan,
      },
      profitability,
      bundles,
      allocation,
      stats,
      forecasts,
      summary: {
        plansGenerated: 3,
        bundlesCreated: bundles.length,
        totalRevenueOpportunity: stats.opportunitySize,
        expectedGrowth: stats.revenueGrowthRate,
        strategies: stats.recommendedStrategies,
      },
    });
  } catch (error: any) {
    console.error("Error testing yield management:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test yield management",
    });
  }
});

export default router;
