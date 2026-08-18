import express from "express";
import { customerLtvChurnEngine, type CustomerLtvMetrics } from "../services/customerLtvChurnEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/customer-ltv/metrics - Update customer LTV metrics
router.post("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId, metrics } = req.body;

    if (!customerId || !metrics) {
      return res.status(400).json({
        success: false,
        error: "customerId and metrics are required",
      });
    }

    customerLtvChurnEngine.updateCustomerMetrics(customerId, metrics);
    const prediction = customerLtvChurnEngine.getChurnPrediction(customerId);
    const history = customerLtvChurnEngine.getCustomerLtvHistory(customerId);

    res.json({
      success: true,
      message: `Metrics updated for customer ${customerId}`,
      prediction,
      ltvHistory: history,
    });
  } catch (error: any) {
    console.error("Error updating customer metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update customer metrics",
    });
  }
});

// GET /api/customer-ltv/customer/:customerId - Get customer LTV and churn data
router.get("/customer/:customerId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId } = req.params;

    const prediction = customerLtvChurnEngine.getChurnPrediction(customerId);
    const history = customerLtvChurnEngine.getCustomerLtvHistory(customerId);

    res.json({
      success: true,
      data: {
        prediction,
        ltvHistory: history,
      },
    });
  } catch (error: any) {
    console.error("Error fetching customer data:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch customer data",
    });
  }
});

// GET /api/customer-ltv/segments - Get customer segmentation
router.get("/segments", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const segments = customerLtvChurnEngine.getCustomerSegmentation();

    res.json({
      success: true,
      data: segments,
    });
  } catch (error: any) {
    console.error("Error fetching customer segments:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch customer segments",
    });
  }
});

// GET /api/customer-ltv/analytics - Get churn analytics
router.get("/analytics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analytics = customerLtvChurnEngine.getChurnAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Error fetching churn analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch churn analytics",
    });
  }
});

// POST /api/customer-ltv/intervention - Record intervention action
router.post("/intervention", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { customerId, action } = req.body;

    if (!customerId || !action) {
      return res.status(400).json({
        success: false,
        error: "customerId and action are required",
      });
    }

    customerLtvChurnEngine.recordIntervention(customerId, action);

    res.json({
      success: true,
      message: `Intervention recorded for customer ${customerId}`,
    });
  } catch (error: any) {
    console.error("Error recording intervention:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record intervention",
    });
  }
});

// POST /api/customer-ltv/test - Test customer LTV engine
router.post("/test", (req: any, res) => {
  try {
    const testMetrics: Partial<CustomerLtvMetrics> = {
      totalSpent: 25000,
      totalRides: 65,
      averageRideValue: 385,
      frequencyPerMonth: 8,
      daysSinceFirstRide: 240,
      daysSinceLastRide: 15,
      rideValueTrend: "stable",
      frequencyTrend: "stable",
      averageRating: 4.7,
      customerComplaints: 0,
      refundRequests: 0,
      loyaltyTier: "gold",
      referralCount: 3,
      promotionalDiscountUsage: 5,
    };

    const customerId = "TEST-CUSTOMER-001";
    customerLtvChurnEngine.updateCustomerMetrics(customerId, testMetrics);

    const prediction = customerLtvChurnEngine.getChurnPrediction(customerId);
    const segments = customerLtvChurnEngine.getCustomerSegmentation();
    const analytics = customerLtvChurnEngine.getChurnAnalytics();
    const history = customerLtvChurnEngine.getCustomerLtvHistory(customerId);

    res.json({
      success: true,
      testData: {
        customerId,
        metrics: testMetrics,
      },
      prediction,
      segments,
      analytics,
      ltvHistory: history,
    });
  } catch (error: any) {
    console.error("Error testing customer LTV engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test customer LTV engine",
    });
  }
});

export default router;
