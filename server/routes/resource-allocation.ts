import express from "express";
import { resourceAllocationEngine } from "../services/resourceAllocationEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/resources/allocation/generate - Generate allocation plan
router.post("/allocation/generate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const horizon = req.body.horizon || 4;

    const plan = resourceAllocationEngine.generateAllocationPlan(horizon);

    res.json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error("Error generating allocation plan:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate allocation plan",
    });
  }
});

// GET /api/resources/zones - Get all zones
router.get("/zones", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const zones = resourceAllocationEngine.getZones();

    res.json({
      success: true,
      data: zones,
      count: zones.length,
    });
  } catch (error: any) {
    console.error("Error fetching zones:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch zones",
    });
  }
});

// POST /api/resources/allocation/execute - Execute allocation action
router.post("/allocation/execute", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { actionId } = req.body;

    if (!actionId) {
      return res.status(400).json({
        success: false,
        error: "actionId is required",
      });
    }

    const action = resourceAllocationEngine.executeAction(actionId);

    if (!action) {
      return res.status(404).json({
        success: false,
        error: "Action not found",
      });
    }

    res.json({
      success: true,
      data: action,
    });
  } catch (error: any) {
    console.error("Error executing action:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to execute action",
    });
  }
});

// POST /api/resources/driver-schedules/optimize - Optimize driver schedules
router.post("/driver-schedules/optimize", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverIds } = req.body;

    if (!driverIds || !Array.isArray(driverIds)) {
      return res.status(400).json({
        success: false,
        error: "driverIds array is required",
      });
    }

    const schedules = resourceAllocationEngine.optimizeDriverSchedules(driverIds);

    res.json({
      success: true,
      data: Array.from(schedules.values()),
      count: schedules.size,
    });
  } catch (error: any) {
    console.error("Error optimizing schedules:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to optimize schedules",
    });
  }
});

// POST /api/resources/capacity/forecast - Forecast capacity needs
router.post("/capacity/forecast", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const days = req.body.days || 30;

    const forecast = resourceAllocationEngine.forecastCapacity(days);

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error: any) {
    console.error("Error forecasting capacity:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to forecast capacity",
    });
  }
});

// GET /api/resources/metrics - Get resource metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = resourceAllocationEngine.getResourceMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch metrics",
    });
  }
});

// GET /api/resources/actions - Get allocation actions
router.get("/actions", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const status = req.query.status;
    const actions = resourceAllocationEngine.getActions(status);

    res.json({
      success: true,
      data: actions,
      count: actions.length,
    });
  } catch (error: any) {
    console.error("Error fetching actions:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch actions",
    });
  }
});

// GET /api/resources/stats - Get allocation statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = resourceAllocationEngine.getAllocationStats();

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

// POST /api/resources/test - Test resource allocation engine
router.post("/test", (req: any, res) => {
  try {
    // Generate allocation plan
    const plan = resourceAllocationEngine.generateAllocationPlan(4);

    // Optimize driver schedules
    const schedules = resourceAllocationEngine.optimizeDriverSchedules([
      "DRIVER-001",
      "DRIVER-002",
      "DRIVER-003",
      "DRIVER-004",
      "DRIVER-005",
    ]);

    // Forecast capacity
    const forecast = resourceAllocationEngine.forecastCapacity(30);

    // Get metrics
    const metrics = resourceAllocationEngine.getResourceMetrics();
    const zones = resourceAllocationEngine.getZones();
    const stats = resourceAllocationEngine.getAllocationStats();

    res.json({
      success: true,
      plan,
      schedulesCreated: schedules.size,
      forecast,
      metrics,
      zones,
      stats,
      summary: {
        planGenerated: true,
        actionsCount: plan.actions.length,
        expectedRevenueGain: plan.expectedImprovement.revenueGain,
        expectedCostSavings: plan.expectedImprovement.costSavings,
        utilizationGain: plan.expectedImprovement.utilizationGain,
      },
    });
  } catch (error: any) {
    console.error("Error testing resource allocation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test resource allocation",
    });
  }
});

export default router;
