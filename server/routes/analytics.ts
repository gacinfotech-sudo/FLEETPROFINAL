import express from "express";
import { analyticsHubEngine, type MetricSnapshot } from "../services/analyticsHubEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/analytics/metrics - Record metrics snapshot
router.post("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const snapshot: MetricSnapshot = {
      timestamp: new Date(),
      revenue: req.body.revenue || 0,
      rides: req.body.rides || 0,
      avgRating: req.body.avgRating || 4.0,
      driverUtilization: req.body.driverUtilization || 0,
      customerChurn: req.body.customerChurn || 0,
      operatingCost: req.body.operatingCost || 0,
      profitMargin: req.body.profitMargin || 0,
    };

    analyticsHubEngine.recordMetrics(snapshot);

    res.json({
      success: true,
      message: "Metrics recorded successfully",
    });
  } catch (error: any) {
    console.error("Error recording metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record metrics",
    });
  }
});

// GET /api/analytics/trends - Get trend analysis
router.get("/trends", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const trends = analyticsHubEngine.getTrends();

    res.json({
      success: true,
      data: trends,
    });
  } catch (error: any) {
    console.error("Error fetching trends:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch trends",
    });
  }
});

// POST /api/analytics/insights - Generate predictive insights
router.post("/insights", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = {
      revenue: req.body.revenue,
      churn: req.body.churn,
      customerSatisfaction: req.body.customerSatisfaction,
      systemHealth: req.body.systemHealth,
    };

    const insights = analyticsHubEngine.generatePredictiveInsights(metrics);

    res.json({
      success: true,
      data: insights,
      count: insights.length,
    });
  } catch (error: any) {
    console.error("Error generating insights:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate insights",
    });
  }
});

// POST /api/analytics/health-report - Generate system health report
router.post("/health-report", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const systems = {
      recommendations: req.body.recommendations,
      pricing: req.body.pricing,
      dispatch: req.body.dispatch,
      maintenance: req.body.maintenance,
      driverIntelligence: req.body.driverIntelligence,
      customerLtv: req.body.customerLtv,
      anomalyDetection: req.body.anomalyDetection,
    };

    const report = analyticsHubEngine.generateSystemHealthReport(systems);

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error generating health report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate health report",
    });
  }
});

// GET /api/analytics/health-reports - Get recent health reports
router.get("/health-reports", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const reports = analyticsHubEngine.getHealthReports(limit);

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error: any) {
    console.error("Error fetching health reports:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch health reports",
    });
  }
});

// POST /api/analytics/business-intelligence - Generate business intelligence
router.post("/business-intelligence", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const period = req.body.period || "daily";
    const bi = analyticsHubEngine.generateBusinessIntelligence(period);

    res.json({
      success: true,
      data: bi,
    });
  } catch (error: any) {
    console.error("Error generating business intelligence:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate business intelligence",
    });
  }
});

// GET /api/analytics/stats - Get analytics statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = analyticsHubEngine.getAnalyticsStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching analytics stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch analytics stats",
    });
  }
});

// POST /api/analytics/test - Test analytics engine
router.post("/test", (req: any, res) => {
  try {
    // Record test metrics
    for (let i = 0; i < 10; i++) {
      const snapshot = {
        timestamp: new Date(Date.now() - i * 60000),
        revenue: 45000 + Math.random() * 30000,
        rides: 80 + Math.floor(Math.random() * 40),
        avgRating: 3.8 + Math.random() * 1.2,
        driverUtilization: 65 + Math.random() * 30,
        customerChurn: 18 + Math.random() * 10,
        operatingCost: 25000 + Math.random() * 10000,
        profitMargin: 15 + Math.random() * 15,
      };
      analyticsHubEngine.recordMetrics(snapshot);
    }

    // Generate test insights
    const insights = analyticsHubEngine.generatePredictiveInsights({
      revenue: 52000,
      churn: 22,
      customerSatisfaction: 4.1,
      systemHealth: 82,
    });

    // Generate health report
    const report = analyticsHubEngine.generateSystemHealthReport({
      recommendations: 86,
      pricing: 84,
      dispatch: 88,
      maintenance: 81,
      driverIntelligence: 85,
      customerLtv: 82,
      anomalyDetection: 80,
    });

    // Generate business intelligence
    const bi = analyticsHubEngine.generateBusinessIntelligence("daily");

    const stats = analyticsHubEngine.getAnalyticsStats();
    const trends = analyticsHubEngine.getTrends();

    res.json({
      success: true,
      insights,
      report,
      businessIntelligence: bi,
      stats,
      trends,
      summary: {
        insightsGenerated: insights.length,
        metricsRecorded: stats.metricsRecorded,
        averageHealthScore: stats.averageHealthScore,
      },
    });
  } catch (error: any) {
    console.error("Error testing analytics engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test analytics engine",
    });
  }
});

export default router;
