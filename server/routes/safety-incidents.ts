import express from "express";
import { safetyIncidentEngine } from "../services/safetyIncidentEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/safety/incident - Report incident
router.post("/incident", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, driverId, type, title, description, reportedBy, customerId, injuries, damageEstimate } = req.body;

    if (!vehicleId || !driverId || !type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: "Required fields missing",
      });
    }

    const incident = safetyIncidentEngine.reportIncident(
      vehicleId,
      driverId,
      type,
      title,
      description,
      reportedBy || "system",
      customerId
    );

    if (injuries) incident.injuries = true;
    if (damageEstimate) incident.damageEstimate = damageEstimate;
    incident.updatedAt = new Date();

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    console.error("Error reporting incident:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to report incident",
    });
  }
});

// GET /api/safety/incident/:incidentId - Get incident details
router.get("/incident/:incidentId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const incident = safetyIncidentEngine.getIncident(req.params.incidentId);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    console.error("Error fetching incident:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch incident",
    });
  }
});

// POST /api/safety/incident/:incidentId/investigate - Start investigation
router.post("/incident/:incidentId/investigate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { findings } = req.body;

    if (!findings) {
      return res.status(400).json({
        success: false,
        error: "findings are required",
      });
    }

    const incident = safetyIncidentEngine.investigateIncident(
      req.params.incidentId,
      req.user.agentId || req.user.id,
      findings
    );

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    console.error("Error investigating incident:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to investigate incident",
    });
  }
});

// POST /api/safety/incident/:incidentId/resolve - Resolve incident
router.post("/incident/:incidentId/resolve", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { resolutionNotes, responseActions } = req.body;

    if (!resolutionNotes || !responseActions) {
      return res.status(400).json({
        success: false,
        error: "resolutionNotes and responseActions are required",
      });
    }

    const incident = safetyIncidentEngine.resolveIncident(
      req.params.incidentId,
      resolutionNotes,
      responseActions
    );

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    console.error("Error resolving incident:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to resolve incident",
    });
  }
});

// POST /api/safety/incident/:incidentId/close - Close incident
router.post("/incident/:incidentId/close", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const incident = safetyIncidentEngine.closeIncident(req.params.incidentId);

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: "Incident not found",
      });
    }

    res.json({
      success: true,
      data: incident,
    });
  } catch (error: any) {
    console.error("Error closing incident:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to close incident",
    });
  }
});

// GET /api/safety/driver/:driverId/incidents - Get driver incidents
router.get("/driver/:driverId/incidents", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const incidents = safetyIncidentEngine.getIncidentsByDriver(req.params.driverId);

    res.json({
      success: true,
      data: incidents,
      count: incidents.length,
    });
  } catch (error: any) {
    console.error("Error fetching driver incidents:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch driver incidents",
    });
  }
});

// GET /api/safety/driver/:driverId/profile - Get driver safety profile
router.get("/driver/:driverId/profile", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const profile = safetyIncidentEngine.getDriverSafetyProfile(req.params.driverId);

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

// POST /api/safety/violation - Record violation
router.post("/violation", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, violationType, details, location } = req.body;

    if (!driverId || !violationType || !details) {
      return res.status(400).json({
        success: false,
        error: "driverId, violationType, and details are required",
      });
    }

    const violation = safetyIncidentEngine.recordViolation(
      driverId,
      violationType,
      details,
      location
    );

    res.json({
      success: true,
      data: violation,
    });
  } catch (error: any) {
    console.error("Error recording violation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record violation",
    });
  }
});

// POST /api/safety/training - Assign training
router.post("/training", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, trainingType } = req.body;

    if (!driverId || !trainingType) {
      return res.status(400).json({
        success: false,
        error: "driverId and trainingType are required",
      });
    }

    const training = safetyIncidentEngine.assignTraining(driverId, trainingType);

    res.json({
      success: true,
      data: training,
    });
  } catch (error: any) {
    console.error("Error assigning training:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to assign training",
    });
  }
});

// POST /api/safety/training/:trainingId/complete - Complete training
router.post("/training/:trainingId/complete", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { score } = req.body;

    if (score === undefined) {
      return res.status(400).json({
        success: false,
        error: "score is required",
      });
    }

    const training = safetyIncidentEngine.completeTraining(req.params.trainingId, score);

    if (!training) {
      return res.status(404).json({
        success: false,
        error: "Training not found",
      });
    }

    res.json({
      success: true,
      data: training,
    });
  } catch (error: any) {
    console.error("Error completing training:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to complete training",
    });
  }
});

// GET /api/safety/metrics - Get safety metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = safetyIncidentEngine.getSafetyMetrics();

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

// GET /api/safety/pending-investigations - Get pending investigations
router.get("/pending-investigations", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const pending = safetyIncidentEngine.getPendingInvestigations();

    res.json({
      success: true,
      data: pending,
      count: pending.length,
    });
  } catch (error: any) {
    console.error("Error fetching pending investigations:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pending investigations",
    });
  }
});

// POST /api/safety/test - Test safety engine
router.post("/test", (req: any, res) => {
  try {
    // Report incidents
    const incident1 = safetyIncidentEngine.reportIncident(
      "vehicle_001",
      "driver_001",
      "violation",
      "Speeding violation detected",
      "Driver exceeded speed limit by 15 km/h in residential area",
      "system"
    );

    const incident2 = safetyIncidentEngine.reportIncident(
      "vehicle_002",
      "driver_002",
      "accident",
      "Minor collision at traffic light",
      "Vehicle involved in minor rear-end collision at traffic signal. No injuries reported.",
      "driver"
    );

    const incident3 = safetyIncidentEngine.reportIncident(
      "vehicle_001",
      "driver_001",
      "near_miss",
      "Near miss incident",
      "Dangerous lane change nearly caused collision",
      "customer"
    );

    // Record violations
    const violation = safetyIncidentEngine.recordViolation(
      "driver_001",
      "speeding",
      "Recorded doing 70 km/h in 50 km/h zone"
    );

    // Investigate incident
    safetyIncidentEngine.investigateIncident(
      incident2.incidentId,
      "investigator_001",
      "Both drivers at fault. Rear vehicle was following too closely."
    );

    // Assign training
    const training = safetyIncidentEngine.assignTraining("driver_001", "defensive_driving");

    // Complete training
    safetyIncidentEngine.completeTraining(training.trainingId, 85);

    // Resolve incident
    safetyIncidentEngine.resolveIncident(
      incident1.incidentId,
      "Driver issued warning. Speed monitoring activated.",
      ["driver_warning", "monitoring"]
    );

    // Get metrics
    const metrics = safetyIncidentEngine.getSafetyMetrics();

    // Get driver profile
    const profile = safetyIncidentEngine.getDriverSafetyProfile("driver_001");

    res.json({
      success: true,
      incidents: [incident1, incident2, incident3],
      violation,
      training,
      metrics,
      profile,
      summary: {
        incidentsReported: 3,
        violationsRecorded: 1,
        trainingAssigned: 1,
        trainingCompleted: 1,
        incidentsResolved: 1,
        driverSafetyScore: profile?.safetyScore || 0,
        safetyIndex: metrics.safetyIndex,
        criticalIncidents: metrics.criticalIncidents,
      },
    });
  } catch (error: any) {
    console.error("Error testing safety engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test safety engine",
    });
  }
});

export default router;
