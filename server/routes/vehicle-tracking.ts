import express from "express";
import { vehicleTrackingEngine } from "../services/vehicleTrackingEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/tracking/location - Update vehicle location
router.post("/location", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, driverId, latitude, longitude, speed, heading, altitude, address } = req.body;

    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: "vehicleId, latitude, and longitude are required",
      });
    }

    const location = vehicleTrackingEngine.updateVehicleLocation(
      vehicleId,
      driverId,
      { latitude, longitude, speed, heading, altitude },
      address
    );

    res.json({
      success: true,
      data: location,
    });
  } catch (error: any) {
    console.error("Error updating location:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update location",
    });
  }
});

// GET /api/tracking/location/:vehicleId - Get current vehicle location
router.get("/location/:vehicleId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const location = vehicleTrackingEngine.getVehicleLocation(req.params.vehicleId);

    if (!location) {
      return res.status(404).json({
        success: false,
        error: "Vehicle location not found",
      });
    }

    res.json({
      success: true,
      data: location,
    });
  } catch (error: any) {
    console.error("Error fetching location:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch location",
    });
  }
});

// POST /api/tracking/route - Create route
router.post("/route", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, startPoint, endPoint, waypoints } = req.body;

    if (!vehicleId || !startPoint || !endPoint) {
      return res.status(400).json({
        success: false,
        error: "vehicleId, startPoint, and endPoint are required",
      });
    }

    const route = vehicleTrackingEngine.createRoute(
      vehicleId,
      startPoint,
      endPoint,
      waypoints
    );

    res.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    console.error("Error creating route:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create route",
    });
  }
});

// POST /api/tracking/route/:routeId/optimize - Optimize route
router.post("/route/:routeId/optimize", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const route = vehicleTrackingEngine.optimizeRoute(req.params.routeId);

    if (!route) {
      return res.status(404).json({
        success: false,
        error: "Route not found",
      });
    }

    res.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    console.error("Error optimizing route:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to optimize route",
    });
  }
});

// GET /api/tracking/route/:routeId - Get route details
router.get("/route/:routeId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const route = vehicleTrackingEngine.getRoute(req.params.routeId);

    if (!route) {
      return res.status(404).json({
        success: false,
        error: "Route not found",
      });
    }

    res.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    console.error("Error fetching route:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch route",
    });
  }
});

// POST /api/tracking/trip/start - Start trip
router.post("/trip/start", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, driverId, startLocation, routeId } = req.body;

    if (!vehicleId || !driverId || !startLocation) {
      return res.status(400).json({
        success: false,
        error: "vehicleId, driverId, and startLocation are required",
      });
    }

    const route = routeId ? vehicleTrackingEngine.getRoute(routeId) : undefined;
    const trip = vehicleTrackingEngine.startTrip(
      vehicleId,
      driverId,
      startLocation,
      route
    );

    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    console.error("Error starting trip:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to start trip",
    });
  }
});

// POST /api/tracking/trip/:tripId/end - End trip
router.post("/trip/:tripId/end", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { endLocation } = req.body;

    if (!endLocation) {
      return res.status(400).json({
        success: false,
        error: "endLocation is required",
      });
    }

    const trip = vehicleTrackingEngine.endTrip(req.params.tripId, endLocation);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: "Trip not found",
      });
    }

    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    console.error("Error ending trip:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to end trip",
    });
  }
});

// GET /api/tracking/trip/:tripId - Get trip details
router.get("/trip/:tripId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const trip = vehicleTrackingEngine.getTrip(req.params.tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: "Trip not found",
      });
    }

    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    console.error("Error fetching trip:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch trip",
    });
  }
});

// GET /api/tracking/stats/:vehicleId - Get vehicle stats
router.get("/stats/:vehicleId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = vehicleTrackingEngine.getVehicleStats(req.params.vehicleId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "Vehicle stats not found",
      });
    }

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

// GET /api/tracking/geofence-events - Get geofence events
router.get("/geofence-events", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { vehicleId, hours } = req.query;
    const events = vehicleTrackingEngine.getGeofenceEvents(
      vehicleId,
      parseInt(hours) || 24
    );

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error: any) {
    console.error("Error fetching geofence events:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch geofence events",
    });
  }
});

// GET /api/tracking/analytics - Get tracking analytics
router.get("/analytics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analytics = vehicleTrackingEngine.getLocationAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch analytics",
    });
  }
});

// POST /api/tracking/test - Test tracking engine
router.post("/test", (req: any, res) => {
  try {
    // Update vehicle location
    const location = vehicleTrackingEngine.updateVehicleLocation(
      "vehicle_001",
      "driver_001",
      { latitude: 23.1815, longitude: 79.9864, speed: 45, heading: 180 },
      "Indore, MP"
    );

    // Create route
    const route = vehicleTrackingEngine.createRoute(
      "vehicle_001",
      { latitude: 23.1815, longitude: 79.9864 },
      { latitude: 23.0225, longitude: 79.8575 },
      [{ latitude: 23.1, longitude: 79.95 }]
    );

    // Optimize route
    const optimized = vehicleTrackingEngine.optimizeRoute(route.routeId);

    // Start trip
    const trip = vehicleTrackingEngine.startTrip(
      "vehicle_001",
      "driver_001",
      { latitude: 23.1815, longitude: 79.9864 },
      optimized
    );

    // Update location during trip
    vehicleTrackingEngine.updateVehicleLocation(
      "vehicle_001",
      "driver_001",
      { latitude: 23.15, longitude: 79.95, speed: 55 }
    );

    vehicleTrackingEngine.updateVehicleLocation(
      "vehicle_001",
      "driver_001",
      { latitude: 23.1, longitude: 79.92, speed: 50 }
    );

    // End trip
    const endedTrip = vehicleTrackingEngine.endTrip(
      trip.tripId,
      { latitude: 23.0225, longitude: 79.8575 }
    );

    // Get analytics
    const analytics = vehicleTrackingEngine.getLocationAnalytics();
    const stats = vehicleTrackingEngine.getVehicleStats("vehicle_001");
    const geofenceEvents = vehicleTrackingEngine.getGeofenceEvents("vehicle_001", 24);

    res.json({
      success: true,
      location,
      route: optimized,
      trip: endedTrip,
      analytics,
      stats,
      geofenceEvents,
      summary: {
        locationUpdates: 3,
        routesCreated: 1,
        tripsCompleted: 1,
        avgSpeed: stats?.avgSpeed.toFixed(1) || 0,
        totalDistance: stats?.totalDistance.toFixed(1) || 0,
        geofenceEventCount: geofenceEvents.length,
      },
    });
  } catch (error: any) {
    console.error("Error testing tracking engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test tracking engine",
    });
  }
});

export default router;
