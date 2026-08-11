import express from "express";
import { fraudDetectionEngine } from "../services/fraudDetectionEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/fraud/assess - Assess entity risk
router.post("/assess", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { entityId, entityType, context } = req.body;

    if (!entityId || !entityType) {
      return res.status(400).json({
        success: false,
        error: "entityId and entityType are required",
      });
    }

    const assessment = fraudDetectionEngine.assessEntity(
      entityId,
      entityType,
      context || {}
    );

    res.json({
      success: true,
      data: assessment,
    });
  } catch (error: any) {
    console.error("Error assessing fraud risk:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to assess fraud risk",
    });
  }
});

// POST /api/fraud/transaction - Record transaction
router.post("/transaction", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { entityId, amount, currency, paymentMethod, location } = req.body;

    if (!entityId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: "entityId, amount, and paymentMethod are required",
      });
    }

    fraudDetectionEngine.recordTransaction({
      transactionId: `txn_${Date.now()}`,
      entityId,
      amount,
      currency: currency || "INR",
      timestamp: new Date(),
      location,
      paymentMethod,
      status: "success",
      verificationLevel: "medium",
      suspiciousIndicators: [],
    });

    res.json({
      success: true,
      message: "Transaction recorded",
    });
  } catch (error: any) {
    console.error("Error recording transaction:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record transaction",
    });
  }
});

// GET /api/fraud/profile/:entityId - Get entity profile
router.get("/profile/:entityId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const profile = fraudDetectionEngine.getProfile(req.params.entityId);

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

// POST /api/fraud/verify - Update verification status
router.post("/verify", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { entityId, field, status } = req.body;

    if (!entityId || !field || !status) {
      return res.status(400).json({
        success: false,
        error: "entityId, field, and status are required",
      });
    }

    const success = fraudDetectionEngine.updateVerificationStatus(entityId, field, status);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Entity not found",
      });
    }

    res.json({
      success: true,
      message: "Verification status updated",
    });
  } catch (error: any) {
    console.error("Error updating verification status:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update verification status",
    });
  }
});

// GET /api/fraud/incidents - Get fraud incidents
router.get("/incidents", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const status = req.query.status;
    const incidents = fraudDetectionEngine.getIncidents(status);

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

// GET /api/fraud/stats - Get fraud statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = fraudDetectionEngine.getFraudStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching fraud stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch fraud stats",
    });
  }
});

// POST /api/fraud/test - Test fraud detection engine
router.post("/test", (req: any, res) => {
  try {
    // Assess multiple entities
    const assessment1 = fraudDetectionEngine.assessEntity(
      "customer_001",
      "customer",
      {
        location: { lat: 23.1815, lng: 79.9864 },
      }
    );

    const assessment2 = fraudDetectionEngine.assessEntity(
      "driver_001",
      "driver",
      {
        location: { lat: 28.6139, lng: 77.209 },
      }
    );

    // Record transactions
    fraudDetectionEngine.recordTransaction({
      transactionId: `txn_1`,
      entityId: "customer_001",
      amount: 5000,
      currency: "INR",
      timestamp: new Date(),
      location: { lat: 23.1815, lng: 79.9864 },
      paymentMethod: "card",
      status: "success",
      verificationLevel: "high",
      suspiciousIndicators: [],
    });

    fraudDetectionEngine.recordTransaction({
      transactionId: `txn_2`,
      entityId: "customer_001",
      amount: 25000,
      currency: "INR",
      timestamp: new Date(Date.now() + 5000),
      location: { lat: 28.6139, lng: 77.209 },
      paymentMethod: "wallet",
      status: "success",
      verificationLevel: "high",
      suspiciousIndicators: ["location_jump"],
    });

    // Update verification
    fraudDetectionEngine.updateVerificationStatus("customer_001", "identity", "verified");
    fraudDetectionEngine.updateVerificationStatus("customer_001", "phone", "verified");
    fraudDetectionEngine.updateVerificationStatus("customer_001", "email", "verified");

    // Get stats
    const stats = fraudDetectionEngine.getFraudStats();
    const profile1 = fraudDetectionEngine.getProfile("customer_001");
    const incidents = fraudDetectionEngine.getIncidents();

    res.json({
      success: true,
      assessments: [assessment1, assessment2],
      stats,
      profile: profile1,
      incidents,
      summary: {
        assessmentsCompleted: 2,
        transactionsRecorded: 2,
        flaggedProfiles: stats.flaggedProfiles,
        activeIncidents: stats.activeIncidents,
        detectionAccuracy: stats.detectionAccuracy.toFixed(1),
        fraudPrevention: `₹${Math.round(stats.fraudPrevention).toLocaleString()}`,
      },
    });
  } catch (error: any) {
    console.error("Error testing fraud detection:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test fraud detection",
    });
  }
});

export default router;
