import express from "express";
import { driverIntelligenceEngine, type DriverMetrics } from "../services/driverIntelligenceEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/driver-intelligence/metrics - Update driver metrics
router.post("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, metrics } = req.body;

    if (!driverId || !metrics) {
      return res.status(400).json({
        success: false,
        error: "driverId and metrics are required",
      });
    }

    driverIntelligenceEngine.updateDriverMetrics(driverId, metrics);
    const score = driverIntelligenceEngine.getDriverScore(driverId);

    res.json({
      success: true,
      message: `Metrics updated for driver ${driverId}`,
      score,
    });
  } catch (error: any) {
    console.error("Error updating driver metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update driver metrics",
    });
  }
});

// GET /api/driver-intelligence/driver/:driverId - Get driver score and alerts
router.get("/driver/:driverId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId } = req.params;

    const score = driverIntelligenceEngine.getDriverScore(driverId);
    const alerts = driverIntelligenceEngine.getDriverAlerts(driverId);
    const incentives = driverIntelligenceEngine.getIncentives(driverId);
    const history = driverIntelligenceEngine.getPerformanceHistory(driverId, 12);

    res.json({
      success: true,
      data: {
        score,
        alerts,
        incentives,
        history,
      },
    });
  } catch (error: any) {
    console.error("Error fetching driver data:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch driver data",
    });
  }
});

// GET /api/driver-intelligence/fleet - Get fleet statistics
router.get("/fleet", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = driverIntelligenceEngine.getFleetStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching fleet stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch fleet stats",
    });
  }
});

// POST /api/driver-intelligence/test - Test driver intelligence engine
router.post("/test", (req: any, res) => {
  try {
    const testMetrics: Partial<DriverMetrics> = {
      totalRides: 450,
      totalDistance: 12500,
      totalEarnings: 180000,
      averageRating: 4.7,
      acceptanceRate: 92,
      cancellationRate: 8,
      onTimePercentage: 95,
      completionRate: 97,
      customerComplaints: 1,
      safetyIncidents: 0,
      fuelEfficiency: 6.8,
      vehicleViolations: 0,
      avgSpeedingInstances: 2,
      avgHardBrakingInstances: 1,
      idleTimePercentage: 4,
      weeklyEarnings: 8500,
      weeklyRides: 28,
    };

    const driverId = "TEST-DRIVER-001";
    driverIntelligenceEngine.updateDriverMetrics(driverId, testMetrics);

    const score = driverIntelligenceEngine.getDriverScore(driverId);
    const alerts = driverIntelligenceEngine.getDriverAlerts(driverId);
    const incentives = driverIntelligenceEngine.getIncentives(driverId);
    const fleetStats = driverIntelligenceEngine.getFleetStats();

    res.json({
      success: true,
      testData: {
        driverId,
        metrics: testMetrics,
      },
      score,
      alerts,
      incentives,
      fleetStats,
    });
  } catch (error: any) {
    console.error("Error testing driver intelligence engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test driver intelligence engine",
    });
  }
});

export default router;
