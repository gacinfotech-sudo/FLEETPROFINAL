import express from "express";
import { anomalyDetectionEngine } from "../services/anomalyDetectionEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/anomaly-detection/detect - Detect anomalies in metrics
router.post("/detect", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { metrics } = req.body;

    if (!metrics || typeof metrics !== "object") {
      return res.status(400).json({
        success: false,
        error: "metrics object is required",
      });
    }

    const detectedAnomalies = anomalyDetectionEngine.detectAnomalies(metrics);

    res.json({
      success: true,
      data: {
        detectedCount: detectedAnomalies.length,
        anomalies: detectedAnomalies,
        criticalCount: detectedAnomalies.filter((a) => a.severity === "critical").length,
      },
    });
  } catch (error: any) {
    console.error("Error detecting anomalies:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to detect anomalies",
    });
  }
});

// POST /api/anomaly-detection/metric - Record metric for baseline calculation
router.post("/metric", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { metricName, value } = req.body;

    if (!metricName || value === undefined) {
      return res.status(400).json({
        success: false,
        error: "metricName and value are required",
      });
    }

    anomalyDetectionEngine.recordMetricHistory(metricName, value);

    res.json({
      success: true,
      message: `Metric ${metricName} recorded`,
    });
  } catch (error: any) {
    console.error("Error recording metric:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record metric",
    });
  }
});

// GET /api/anomaly-detection/active - Get active anomalies
router.get("/active", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const anomalies = anomalyDetectionEngine.getActiveAnomalies();

    res.json({
      success: true,
      data: anomalies,
      count: anomalies.length,
    });
  } catch (error: any) {
    console.error("Error fetching active anomalies:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch active anomalies",
    });
  }
});

// POST /api/anomaly-detection/resolve - Resolve an anomaly
router.post("/resolve", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { anomalyId, resolution } = req.body;

    if (!anomalyId || !resolution) {
      return res.status(400).json({
        success: false,
        error: "anomalyId and resolution are required",
      });
    }

    const success = anomalyDetectionEngine.resolveAnomaly(anomalyId, resolution);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Anomaly not found",
      });
    }

    res.json({
      success: true,
      message: `Anomaly ${anomalyId} resolved`,
    });
  } catch (error: any) {
    console.error("Error resolving anomaly:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to resolve anomaly",
    });
  }
});

// GET /api/anomaly-detection/incidents - Get incidents
router.get("/incidents", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { status } = req.query;
    const incidents = anomalyDetectionEngine.getIncidents(status as string | undefined);

    res.json({
      success: true,
      data: incidents,
      count: incidents.length,
    });
  } catch (error: any) {
    console.error("Error fetching incidents:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch incidents",
    });
  }
});

// GET /api/anomaly-detection/stats - Get anomaly statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = anomalyDetectionEngine.getAnomalyStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching anomaly stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch anomaly stats",
    });
  }
});

// POST /api/anomaly-detection/test - Test anomaly detection
router.post("/test", (req: any, res) => {
  try {
    // Test metrics with some anomalies
    const testMetrics = {
      acceptanceRate: 65, // Below 70 threshold
      averageRating: 3.2, // Below 3.5 threshold
      offlinePercentage: 50, // Above 40 threshold
      complaintRate: 8.5, // Deviation anomaly
      churnRate: 30, // Above 25 threshold
      surgePricingActive: 4, // Above 3 threshold
      bookingRate: 25, // Below 30 threshold
      avgWaitTime: 1200, // Above 900 threshold
      fleetHealthScore: 55, // Below 60 threshold
      hourlyRevenue: 45000, // Below 50000 threshold
      operatingMargin: 12, // Below 15 threshold
    };

    // Record metrics for baseline
    Object.entries(testMetrics).forEach(([name, value]) => {
      anomalyDetectionEngine.recordMetricHistory(name, value);
    });

    // Detect anomalies
    const detectedAnomalies = anomalyDetectionEngine.detectAnomalies(testMetrics);
    const stats = anomalyDetectionEngine.getAnomalyStats();
    const activeAnomalies = anomalyDetectionEngine.getActiveAnomalies();
    const incidents = anomalyDetectionEngine.getIncidents();

    res.json({
      success: true,
      testMetrics,
      detectedAnomalies,
      stats,
      activeAnomalies,
      incidents,
      summary: {
        totalAnomaliesDetected: detectedAnomalies.length,
        criticalAnomalies: detectedAnomalies.filter((a) => a.severity === "critical").length,
        incidents: incidents.length,
      },
    });
  } catch (error: any) {
    console.error("Error testing anomaly detection:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test anomaly detection",
    });
  }
});

export default router;
