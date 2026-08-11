import express from "express";
import { driverDispatchEngine, type RideRequest, type AvailableDriver } from "../services/driverDispatchEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/dispatch/driver-location - Update driver location and status
router.post("/driver-location", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { driverId, driver } = req.body;

    if (!driverId || !driver) {
      return res.status(400).json({
        success: false,
        error: "driverId and driver data are required",
      });
    }

    driverDispatchEngine.updateDriverLocation(driverId, driver);

    res.json({
      success: true,
      message: `Location updated for driver ${driverId}`,
    });
  } catch (error: any) {
    console.error("Error updating driver location:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update driver location",
    });
  }
});

// POST /api/dispatch/find-driver - Find optimal driver for a ride request
router.post("/find-driver", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const rideRequest = req.body as RideRequest;

    if (!rideRequest.rideId || !rideRequest.pickupLocation) {
      return res.status(400).json({
        success: false,
        error: "rideId and pickupLocation are required",
      });
    }

    const match = driverDispatchEngine.findOptimalDriver(rideRequest);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "No available drivers found for this request",
      });
    }

    res.json({
      success: true,
      data: match,
    });
  } catch (error: any) {
    console.error("Error finding optimal driver:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to find optimal driver",
    });
  }
});

// GET /api/dispatch/optimal-drivers - Get top N optimal drivers for a request
router.get("/optimal-drivers", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { topN = 5, ...rideRequestData } = req.query;

    const rideRequest: RideRequest = {
      rideId: rideRequestData.rideId || `ride_${Date.now()}`,
      customerId: rideRequestData.customerId || "",
      pickupLocation: JSON.parse(rideRequestData.pickupLocation || "{}"),
      dropoffLocation: JSON.parse(rideRequestData.dropoffLocation || "{}"),
      rideType: rideRequestData.rideType || "economy",
      passengerCount: parseInt(rideRequestData.passengerCount || "1"),
      estimatedDistance: parseFloat(rideRequestData.estimatedDistance || "0"),
      estimatedDuration: parseFloat(rideRequestData.estimatedDuration || "0"),
      estimatedFare: parseFloat(rideRequestData.estimatedFare || "0"),
      customerRating: parseFloat(rideRequestData.customerRating || "4.5"),
      customerPreferences: JSON.parse(rideRequestData.customerPreferences || "{}"),
      timestamp: new Date(),
    };

    const topDrivers = driverDispatchEngine.getOptimalDriverList(rideRequest, parseInt(topN));

    res.json({
      success: true,
      data: topDrivers,
      count: topDrivers.length,
    });
  } catch (error: any) {
    console.error("Error getting optimal drivers:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get optimal drivers",
    });
  }
});

// POST /api/dispatch/decision - Record driver acceptance/rejection decision
router.post("/decision", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { rideId, driverId, accepted } = req.body;

    if (!rideId || !driverId || accepted === undefined) {
      return res.status(400).json({
        success: false,
        error: "rideId, driverId, and accepted are required",
      });
    }

    driverDispatchEngine.recordDispatchDecision(rideId, driverId, accepted);

    res.json({
      success: true,
      message: `Dispatch decision recorded: ${accepted ? "accepted" : "rejected"}`,
    });
  } catch (error: any) {
    console.error("Error recording dispatch decision:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to record dispatch decision",
    });
  }
});

// GET /api/dispatch/metrics - Get dispatch metrics
router.get("/metrics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const metrics = driverDispatchEngine.getDispatchMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error("Error fetching dispatch metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch dispatch metrics",
    });
  }
});

// GET /api/dispatch/history - Get dispatch history
router.get("/history", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const history = driverDispatchEngine.getDispatchHistory(limit);

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error("Error fetching dispatch history:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch dispatch history",
    });
  }
});

// GET /api/dispatch/queue-status - Get current queue status
router.get("/queue-status", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const queueStatus = driverDispatchEngine.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus,
    });
  } catch (error: any) {
    console.error("Error fetching queue status:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch queue status",
    });
  }
});

// POST /api/dispatch/test - Test dispatch engine
router.post("/test", (req: any, res) => {
  try {
    // Setup test driver
    const testDriver: Partial<AvailableDriver> = {
      location: { lat: 23.1815, lng: 79.9864 },
      currentlyOnRide: false,
      acceptanceRate: 95,
      averageRating: 4.8,
      performanceScore: 88,
      vehicleType: "economy",
      fuelLevel: 85,
      onlineStatus: "online",
      totalRides: 450,
      weeklyRides: 28,
      currentEarnings: 8500,
      responseTime: 12,
      safetyScore: 92,
      recentCancellations: 0,
    };

    driverDispatchEngine.updateDriverLocation("TEST-DRIVER-001", testDriver);

    // Setup test ride request
    const testRideRequest = {
      rideId: `ride_${Date.now()}`,
      customerId: "TEST-CUSTOMER-001",
      pickupLocation: { lat: 23.1825, lng: 79.9875 },
      dropoffLocation: { lat: 23.1905, lng: 79.9925 },
      rideType: "economy" as const,
      passengerCount: 1,
      customerRating: 4.7,
      customerPreferences: {},
      estimatedDistance: 2.5,
      estimatedDuration: 15,
      estimatedFare: 185,
      timestamp: new Date(),
    };

    const match = driverDispatchEngine.findOptimalDriver(testRideRequest);
    const metrics = driverDispatchEngine.getDispatchMetrics();
    const topDrivers = driverDispatchEngine.getOptimalDriverList(testRideRequest, 3);
    const queueStatus = driverDispatchEngine.getQueueStatus();

    res.json({
      success: true,
      testDriver,
      rideRequest: testRideRequest,
      optimalMatch: match,
      topDrivers,
      metrics,
      queueStatus,
    });
  } catch (error: any) {
    console.error("Error testing dispatch engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test dispatch engine",
    });
  }
});

export default router;
