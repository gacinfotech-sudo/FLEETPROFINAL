import express from "express";
import { predictiveMaintenanceEngine, type VehicleHealthMetrics } from "../services/predictiveMaintenanceEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/maintenance/vehicle - Update vehicle health metrics
router.post("/vehicle", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, metrics } = req.body;

    if (!vehicleId || !metrics) {
      return res.status(400).json({
        success: false,
        error: "vehicleId and metrics are required",
      });
    }

    const healthMetrics: Partial<VehicleHealthMetrics> = {
      mileage: metrics.mileage,
      age: metrics.age,
      engineHours: metrics.engineHours,
      lastServiceDate: metrics.lastServiceDate ? new Date(metrics.lastServiceDate) : undefined,
      nextServiceDate: metrics.nextServiceDate ? new Date(metrics.nextServiceDate) : undefined,
      fuelEfficiency: metrics.fuelEfficiency,
      engineOilLevel: metrics.engineOilLevel,
      coolantLevel: metrics.coolantLevel,
      brakePadWear: metrics.brakePadWear,
      tireCondition: metrics.tireCondition,
      batteryHealth: metrics.batteryHealth,
      transmissionFluidLevel: metrics.transmissionFluidLevel,
      faultCodes: metrics.faultCodes || [],
      lastDiagnosticDate: metrics.lastDiagnosticDate ? new Date(metrics.lastDiagnosticDate) : undefined,
    };

    predictiveMaintenanceEngine.updateVehicleMetrics(vehicleId, healthMetrics);

    const predictions = predictiveMaintenanceEngine.getPredictions(vehicleId);

    res.json({
      success: true,
      message: `Vehicle metrics updated for ${vehicleId}`,
      predictions,
    });
  } catch (error: any) {
    console.error("Error updating vehicle metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update vehicle metrics",
    });
  }
});

// GET /api/maintenance/vehicle/:vehicleId - Get vehicle predictions
router.get("/vehicle/:vehicleId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId } = req.params;

    const predictions = predictiveMaintenanceEngine.getPredictions(vehicleId);
    const schedules = predictiveMaintenanceEngine.getSchedules(vehicleId);

    res.json({
      success: true,
      data: {
        predictions,
        schedules,
      },
    });
  } catch (error: any) {
    console.error("Error fetching vehicle maintenance:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch vehicle maintenance data",
    });
  }
});

// GET /api/maintenance/fleet - Get fleet health report
router.get("/fleet", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const report = predictiveMaintenanceEngine.getFleetHealthReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error fetching fleet health report:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch fleet health report",
    });
  }
});

// POST /api/maintenance/service/:vehicleId/complete - Mark service as completed
router.post("/service/:vehicleId/complete", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId } = req.params;
    const { serviceType } = req.body;

    if (!serviceType) {
      return res.status(400).json({
        success: false,
        error: "serviceType is required",
      });
    }

    const success = predictiveMaintenanceEngine.completeService(vehicleId, serviceType);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Service ${serviceType} not found for vehicle ${vehicleId}`,
      });
    }

    // Refresh predictions
    const predictions = predictiveMaintenanceEngine.getPredictions(vehicleId);

    res.json({
      success: true,
      message: `Service ${serviceType} marked as completed for ${vehicleId}`,
      predictions,
    });
  } catch (error: any) {
    console.error("Error completing service:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to complete service",
    });
  }
});

// POST /api/maintenance/test - Test maintenance engine
router.post("/test", (req: any, res) => {
  try {
    // Setup test vehicle metrics
    const testMetrics: Partial<VehicleHealthMetrics> = {
      mileage: 45000,
      age: 24,
      engineHours: 1200,
      lastServiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextServiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      fuelEfficiency: 5.2,
      engineOilLevel: 35,
      coolantLevel: 45,
      brakePadWear: 65,
      tireCondition: 55,
      batteryHealth: 70,
      transmissionFluidLevel: 80,
      faultCodes: ["P0300"],
      lastDiagnosticDate: new Date(),
    };

    const vehicleId = "TEST-VEHICLE-001";
    predictiveMaintenanceEngine.updateVehicleMetrics(vehicleId, testMetrics);

    const predictions = predictiveMaintenanceEngine.getPredictions(vehicleId);
    const schedules = predictiveMaintenanceEngine.getSchedules(vehicleId);
    const fleetReport = predictiveMaintenanceEngine.getFleetHealthReport();

    res.json({
      success: true,
      testData: {
        vehicleId,
        metrics: testMetrics,
      },
      predictions,
      schedules,
      fleetReport,
    });
  } catch (error: any) {
    console.error("Error testing maintenance engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test maintenance engine",
    });
  }
});

export default router;
