import express from "express";
import { orchestrationEngine } from "../services/orchestrationEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/orchestration/execute - Execute a workflow
router.post("/execute", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { workflowId, context } = req.body;

    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: "workflowId is required",
      });
    }

    const execution = orchestrationEngine.executeWorkflow(
      workflowId,
      context || {}
    );

    res.json({
      success: true,
      data: execution,
    });
  } catch (error: any) {
    console.error("Error executing workflow:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to execute workflow",
    });
  }
});

// POST /api/orchestration/recommend - Add a recommendation
router.post("/recommend", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const {
      sourceSystem,
      category,
      priority,
      action,
      estimatedROI,
      expiresAt,
    } = req.body;

    if (!sourceSystem || !category || !action) {
      return res.status(400).json({
        success: false,
        error:
          "sourceSystem, category, and action are required",
      });
    }

    const recommendation = orchestrationEngine.addRecommendation({
      sourceSystem,
      category,
      priority: priority || "medium",
      action,
      estimatedROI: estimatedROI || 0,
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "active",
    });

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error: any) {
    console.error("Error adding recommendation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add recommendation",
    });
  }
});

// POST /api/orchestration/decide - Make a decision
router.post("/decide", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { sourceSystem, recommendation, priority } = req.body;

    if (!sourceSystem || !recommendation) {
      return res.status(400).json({
        success: false,
        error: "sourceSystem and recommendation are required",
      });
    }

    const decision = orchestrationEngine.makeDecision(
      sourceSystem,
      recommendation,
      priority || "medium"
    );

    res.json({
      success: true,
      data: decision,
    });
  } catch (error: any) {
    console.error("Error making decision:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to make decision",
    });
  }
});

// POST /api/orchestration/alert - Create alert
router.post("/alert", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { system, title, message, severity } = req.body;

    if (!system || !title || !message) {
      return res.status(400).json({
        success: false,
        error: "system, title, and message are required",
      });
    }

    const alert = orchestrationEngine.createAlert(
      system,
      title,
      message,
      severity || "warning"
    );

    res.json({
      success: true,
      data: alert,
    });
  } catch (error: any) {
    console.error("Error creating alert:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create alert",
    });
  }
});

// GET /api/orchestration/workflows - Get all workflows
router.get("/workflows", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const workflows = orchestrationEngine.getWorkflows();

    res.json({
      success: true,
      data: workflows,
      count: workflows.length,
    });
  } catch (error: any) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch workflows",
    });
  }
});

// GET /api/orchestration/alerts - Get alerts
router.get("/alerts", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const status = req.query.status;
    const alerts = orchestrationEngine.getAlerts(status);

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

// POST /api/orchestration/alerts/:alertId/acknowledge - Acknowledge alert
router.post("/alerts/:alertId/acknowledge", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const success = orchestrationEngine.acknowledgeAlert(req.params.alertId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({
      success: true,
      message: "Alert acknowledged",
    });
  } catch (error: any) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to acknowledge alert",
    });
  }
});

// GET /api/orchestration/recommendations - Get recommendations
router.get("/recommendations", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const sourceSystem = req.query.sourceSystem;
    const recommendations = orchestrationEngine.getRecommendations(sourceSystem);

    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch recommendations",
    });
  }
});

// GET /api/orchestration/metrics - Get platform metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = orchestrationEngine.getPlatformMetrics();

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

// GET /api/orchestration/stats - Get orchestration stats
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = orchestrationEngine.getOrchestrationStats();

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

// POST /api/orchestration/test - Test orchestration engine
router.post("/test", (req: any, res) => {
  try {
    // Execute workflows
    const rideExecution = orchestrationEngine.executeWorkflow(
      "wf_ride_lifecycle",
      {}
    );
    const revenueExecution = orchestrationEngine.executeWorkflow(
      "wf_revenue_maximization",
      {}
    );

    // Add recommendations
    const rec1 = orchestrationEngine.addRecommendation({
      sourceSystem: "pricing",
      category: "pricing_strategy",
      priority: "high",
      action: "Increase premium tier pricing by 5%",
      estimatedROI: 15,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "active",
    });

    const rec2 = orchestrationEngine.addRecommendation({
      sourceSystem: "resources",
      category: "allocation_strategy",
      priority: "medium",
      action: "Rebalance 15 vehicles to downtown zone",
      estimatedROI: 8,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "active",
    });

    // Make decisions
    const decision1 = orchestrationEngine.makeDecision(
      "yield",
      "Apply revenue optimization plan",
      "high"
    );

    const decision2 = orchestrationEngine.makeDecision(
      "anomaly",
      "Execute critical risk mitigation",
      "critical"
    );

    // Create alerts
    const alert1 = orchestrationEngine.createAlert(
      "dispatch",
      "High demand detected",
      "Downtown zone showing 150% demand spike",
      "critical"
    );

    const alert2 = orchestrationEngine.createAlert(
      "maintenance",
      "Fleet maintenance due",
      "5 vehicles require scheduled maintenance this week",
      "warning"
    );

    // Get metrics
    const metrics = orchestrationEngine.getPlatformMetrics();
    const stats = orchestrationEngine.getOrchestrationStats();
    const workflows = orchestrationEngine.getWorkflows();
    const alerts = orchestrationEngine.getAlerts();
    const recommendations = orchestrationEngine.getRecommendations();

    res.json({
      success: true,
      executions: [rideExecution, revenueExecution],
      recommendations: [rec1, rec2],
      decisions: [decision1, decision2],
      alerts: [alert1, alert2],
      metrics,
      stats,
      workflows,
      summary: {
        workflowsExecuted: 2,
        recommendationsAdded: 2,
        decisionsGenerated: 2,
        alertsCreated: 2,
        systemsIntegrated: stats.systemsIntegrated,
        autonomyLevel: metrics.autonomyLevel.toFixed(1),
        platformROI: metrics.platformROI.toFixed(1),
      },
    });
  } catch (error: any) {
    console.error("Error testing orchestration:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test orchestration",
    });
  }
});

export default router;
