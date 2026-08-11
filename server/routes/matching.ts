import express from "express";
import { demandSupplyMatchingEngine, type SupplyMetrics, type DemandMetrics } from "../services/demandSupplyMatchingEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/matching/supply - Update supply metrics for a route
router.post("/supply", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route, metrics } = req.body;

    if (!route || !metrics) {
      return res.status(400).json({
        success: false,
        error: "Route and metrics are required",
      });
    }

    const supplyMetrics: SupplyMetrics = {
      route,
      totalVehicles: metrics.totalVehicles || 20,
      availableVehicles: metrics.availableVehicles || 15,
      activeBookings: metrics.activeBookings || 5,
      utilizationRate: metrics.utilizationRate || 25,
      expectedDowntime: metrics.expectedDowntime || 0,
      avgResponseTime: metrics.avgResponseTime || 10,
    };

    demandSupplyMatchingEngine.updateSupply(route, supplyMetrics);

    res.json({
      success: true,
      message: `Supply metrics updated for ${route}`,
      data: supplyMetrics,
    });
  } catch (error: any) {
    console.error("Error updating supply metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update supply metrics",
    });
  }
});

// POST /api/matching/demand - Update demand metrics for a route
router.post("/demand", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route, metrics } = req.body;

    if (!route || !metrics) {
      return res.status(400).json({
        success: false,
        error: "Route and metrics are required",
      });
    }

    const demandMetrics: DemandMetrics = {
      route,
      currentDemand: metrics.currentDemand || 10,
      predictedDemand: metrics.predictedDemand || 12,
      peakDemand: metrics.peakDemand || 15,
      peakTime: metrics.peakTime ? new Date(metrics.peakTime) : new Date(),
      demandTrend: metrics.demandTrend || "stable",
    };

    demandSupplyMatchingEngine.updateDemand(route, demandMetrics);

    res.json({
      success: true,
      message: `Demand metrics updated for ${route}`,
      data: demandMetrics,
    });
  } catch (error: any) {
    console.error("Error updating demand metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update demand metrics",
    });
  }
});

// POST /api/matching/calculate - Calculate matching for a route
router.post("/calculate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route } = req.body;

    if (!route) {
      return res.status(400).json({
        success: false,
        error: "Route is required",
      });
    }

    const result = demandSupplyMatchingEngine.calculateMatch(route);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `No matching data available for route: ${route}`,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error calculating match:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate match",
    });
  }
});

// GET /api/matching/history/:route - Get matching history for a route
router.get("/history/:route", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;

    const history = demandSupplyMatchingEngine.getMatchingHistory(route, limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error("Error fetching matching history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch matching history",
    });
  }
});

// GET /api/matching/alerts - Get all active alerts
router.get("/alerts", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route, severity } = req.query;

    const alerts = demandSupplyMatchingEngine.getLatestAlerts(
      route as string | undefined,
      severity as string | undefined
    );

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error: any) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch alerts",
    });
  }
});

// GET /api/matching/metrics - Get system metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = demandSupplyMatchingEngine.getSystemMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error("Error fetching system metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch system metrics",
    });
  }
});

// GET /api/matching/strategies - Get matching strategies
router.get("/strategies", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { status } = req.query;

    const strategies = demandSupplyMatchingEngine.getStrategies(status as string | undefined);

    res.json({
      success: true,
      data: strategies,
      count: strategies.length,
    });
  } catch (error: any) {
    console.error("Error fetching strategies:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch strategies",
    });
  }
});

// PUT /api/matching/strategies/:strategyId/enable - Enable a strategy
router.put("/strategies/:strategyId/enable", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { strategyId } = req.params;

    const success = demandSupplyMatchingEngine.enableStrategy(strategyId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Strategy not found",
      });
    }

    res.json({
      success: true,
      message: `Strategy ${strategyId} enabled`,
    });
  } catch (error: any) {
    console.error("Error enabling strategy:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to enable strategy",
    });
  }
});

// PUT /api/matching/strategies/:strategyId/disable - Disable a strategy
router.put("/strategies/:strategyId/disable", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { strategyId } = req.params;

    const success = demandSupplyMatchingEngine.disableStrategy(strategyId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Strategy not found",
      });
    }

    res.json({
      success: true,
      message: `Strategy ${strategyId} disabled`,
    });
  } catch (error: any) {
    console.error("Error disabling strategy:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to disable strategy",
    });
  }
});

// POST /api/matching/test - Test matching engine
router.post("/test", (req: any, res) => {
  try {
    // Setup test data
    const testSupply: SupplyMetrics = {
      route: "HSR Layout to Airport",
      totalVehicles: 30,
      availableVehicles: 8,
      activeBookings: 22,
      utilizationRate: 73,
      expectedDowntime: 0,
      avgResponseTime: 12,
    };

    const testDemand: DemandMetrics = {
      route: "HSR Layout to Airport",
      currentDemand: 18,
      predictedDemand: 20,
      peakDemand: 25,
      peakTime: new Date(Date.now() + 30 * 60 * 1000),
      demandTrend: "increasing",
    };

    demandSupplyMatchingEngine.updateSupply(testSupply.route, testSupply);
    demandSupplyMatchingEngine.updateDemand(testDemand.route, testDemand);

    const result = demandSupplyMatchingEngine.calculateMatch(testSupply.route);
    const metrics = demandSupplyMatchingEngine.getSystemMetrics();
    const strategies = demandSupplyMatchingEngine.getStrategies();

    res.json({
      success: true,
      testData: {
        supply: testSupply,
        demand: testDemand,
      },
      matchingResult: result,
      systemMetrics: metrics,
      applicableStrategies: strategies,
    });
  } catch (error: any) {
    console.error("Error testing matching engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test matching engine",
    });
  }
});

export default router;
