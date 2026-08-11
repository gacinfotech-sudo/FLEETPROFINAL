import { EventEmitter } from "events";

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface VehicleLocation {
  locationId: string;
  vehicleId: string;
  driverId: string;
  coordinate: GPSCoordinate;
  address?: string;
  timestamp: Date;
  battery?: number; // percentage
  signalStrength?: number; // -1 to -120 dBm
  isMoving: boolean;
  speed: number; // km/h
}

export interface GeofenceZone {
  zoneId: string;
  name: string;
  type: "service_area" | "charging_station" | "restricted" | "waypoint" | "warehouse";
  center: GPSCoordinate;
  radiusMeters: number;
  entryAlert: boolean;
  exitAlert: boolean;
  active: boolean;
  createdAt: Date;
}

export interface RouteOptimization {
  routeId: string;
  vehicleId: string;
  startPoint: GPSCoordinate;
  endPoint: GPSCoordinate;
  waypoints?: GPSCoordinate[];
  estimatedDistance: number; // km
  estimatedDuration: number; // seconds
  estimatedFuel: number; // liters
  optimized: boolean;
  routePoints: GPSCoordinate[];
  createdAt: Date;
}

export interface TripTracking {
  tripId: string;
  vehicleId: string;
  driverId: string;
  status: "in_progress" | "completed" | "cancelled";
  startLocation: GPSCoordinate;
  endLocation?: GPSCoordinate;
  startTime: Date;
  endTime?: Date;
  distance: number; // km
  duration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  locations: VehicleLocation[];
  route?: RouteOptimization;
  fuelConsumed?: number; // liters
}

export interface GeofenceEvent {
  eventId: string;
  vehicleId: string;
  driverId: string;
  zoneId: string;
  eventType: "entry" | "exit" | "prolonged_stay";
  coordinate: GPSCoordinate;
  timestamp: Date;
  duration?: number; // seconds for stay duration
  address?: string;
}

export interface LocationAnalytics {
  timestamp: Date;
  totalVehiclesTracked: number;
  activeVehicles: number;
  totalDistance: number; // km
  totalDuration: number; // seconds
  avgSpeed: number; // km/h
  topSpeed: number; // km/h
  geofenceEvents: number;
  routeOptimizations: number;
  averageFuelEfficiency: number; // km/l
  topLocations: { coordinate: GPSCoordinate; visits: number }[];
  offlineVehicles: number;
}

export interface VehicleStats {
  vehicleId: string;
  driverId: string;
  totalDistance: number; // km
  totalDuration: number; // seconds
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  tripCount: number;
  lastLocation?: VehicleLocation;
  lastLocationTime?: Date;
  batteryLevel?: number;
  signalStrength?: number;
  fuelLevel?: number;
  status: "online" | "offline" | "idle";
  lastUpdated: Date;
}

class VehicleTrackingEngine extends EventEmitter {
  private locations: Map<string, VehicleLocation> = new Map();
  private geofences: Map<string, GeofenceZone> = new Map();
  private routes: Map<string, RouteOptimization> = new Map();
  private trips: Map<string, TripTracking> = new Map();
  private geofenceEvents: Map<string, GeofenceEvent> = new Map();
  private vehicleStats: Map<string, VehicleStats> = new Map();
  private locationHistory: VehicleLocation[] = [];

  constructor() {
    super();
    this.setupDefaultGeofences();
  }

  private setupDefaultGeofences() {
    const zones: GeofenceZone[] = [
      {
        zoneId: "zone_1",
        name: "Downtown Service Area",
        type: "service_area",
        center: { latitude: 23.1815, longitude: 79.9864 },
        radiusMeters: 5000,
        entryAlert: true,
        exitAlert: true,
        active: true,
        createdAt: new Date(),
      },
      {
        zoneId: "zone_2",
        name: "Airport Charging Station",
        type: "charging_station",
        center: { latitude: 23.0225, longitude: 79.8575 },
        radiusMeters: 500,
        entryAlert: true,
        exitAlert: false,
        active: true,
        createdAt: new Date(),
      },
      {
        zoneId: "zone_3",
        name: "Restricted Zone",
        type: "restricted",
        center: { latitude: 23.15, longitude: 79.98 },
        radiusMeters: 1000,
        entryAlert: true,
        exitAlert: false,
        active: true,
        createdAt: new Date(),
      },
    ];

    zones.forEach((zone) => {
      this.geofences.set(zone.zoneId, zone);
    });
  }

  updateVehicleLocation(
    vehicleId: string,
    driverId: string,
    coordinate: GPSCoordinate,
    address?: string
  ): VehicleLocation {
    const location: VehicleLocation = {
      locationId: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vehicleId,
      driverId,
      coordinate,
      address,
      timestamp: new Date(),
      isMoving: (coordinate.speed || 0) > 5,
      speed: coordinate.speed || 0,
    };

    this.locations.set(vehicleId, location);
    this.locationHistory.push(location);
    this.updateVehicleStats(vehicleId, driverId, location);

    // Check geofences
    this.checkGeofences(vehicleId, driverId, coordinate);

    this.emit("location:updated", location);
    return location;
  }

  private updateVehicleStats(vehicleId: string, driverId: string, location: VehicleLocation) {
    let stats = this.vehicleStats.get(vehicleId);

    if (!stats) {
      stats = {
        vehicleId,
        driverId,
        totalDistance: 0,
        totalDuration: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        tripCount: 0,
        status: "online",
        lastUpdated: new Date(),
      };
    }

    stats.lastLocation = location;
    stats.lastLocationTime = location.timestamp;
    stats.status = location.isMoving ? "online" : "idle";
    stats.maxSpeed = Math.max(stats.maxSpeed, location.speed);
    stats.lastUpdated = new Date();

    this.vehicleStats.set(vehicleId, stats);
  }

  private checkGeofences(vehicleId: string, driverId: string, coordinate: GPSCoordinate) {
    Array.from(this.geofences.values()).forEach((zone) => {
      const distance = this.calculateDistance(coordinate, zone.center);
      const isInside = distance <= zone.radiusMeters / 1000; // Convert to km

      // Check if vehicle is entering or exiting
      const prevLocation = Array.from(this.locations.values())
        .filter((l) => l.vehicleId === vehicleId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[1]; // Get second to last

      if (prevLocation) {
        const wasPrevInside =
          this.calculateDistance(prevLocation.coordinate, zone.center) <=
          zone.radiusMeters / 1000;

        if (isInside && !wasPrevInside && zone.entryAlert) {
          this.recordGeofenceEvent(vehicleId, driverId, zone.zoneId, "entry", coordinate);
        } else if (!isInside && wasPrevInside && zone.exitAlert) {
          this.recordGeofenceEvent(vehicleId, driverId, zone.zoneId, "exit", coordinate);
        }
      }
    });
  }

  private recordGeofenceEvent(
    vehicleId: string,
    driverId: string,
    zoneId: string,
    eventType: "entry" | "exit" | "prolonged_stay",
    coordinate: GPSCoordinate
  ) {
    const event: GeofenceEvent = {
      eventId: `geof_${Date.now()}`,
      vehicleId,
      driverId,
      zoneId,
      eventType,
      coordinate,
      timestamp: new Date(),
    };

    this.geofenceEvents.set(event.eventId, event);
    this.emit("geofence:event", event);
  }

  createRoute(
    vehicleId: string,
    startPoint: GPSCoordinate,
    endPoint: GPSCoordinate,
    waypoints?: GPSCoordinate[]
  ): RouteOptimization {
    const distance = this.calculateDistance(startPoint, endPoint);
    const duration = this.estimateDuration(distance);
    const fuelConsumption = distance / 7; // 7 km/l average

    const route: RouteOptimization = {
      routeId: `route_${Date.now()}`,
      vehicleId,
      startPoint,
      endPoint,
      waypoints,
      estimatedDistance: distance,
      estimatedDuration: duration,
      estimatedFuel: fuelConsumption,
      optimized: false,
      routePoints: [startPoint, ...(waypoints || []), endPoint],
      createdAt: new Date(),
    };

    this.routes.set(route.routeId, route);
    this.emit("route:created", route);
    return route;
  }

  optimizeRoute(routeId: string): RouteOptimization | null {
    const route = this.routes.get(routeId);
    if (!route) return null;

    // Apply optimization: reorder waypoints using nearest neighbor algorithm
    const optimized = this.nearestNeighbor(route.routePoints);

    route.routePoints = optimized;
    route.optimized = true;

    // Recalculate distance and fuel
    let totalDistance = 0;
    for (let i = 0; i < optimized.length - 1; i++) {
      totalDistance += this.calculateDistance(optimized[i], optimized[i + 1]);
    }
    route.estimatedDistance = totalDistance;
    route.estimatedFuel = totalDistance / 7;
    route.estimatedDuration = this.estimateDuration(totalDistance);

    this.emit("route:optimized", route);
    return route;
  }

  private nearestNeighbor(points: GPSCoordinate[]): GPSCoordinate[] {
    if (points.length <= 2) return points;

    const optimized: GPSCoordinate[] = [points[0]];
    const remaining = points.slice(1);

    while (remaining.length > 0) {
      const last = optimized[optimized.length - 1];
      let nearest = remaining[0];
      let minDistance = this.calculateDistance(last, nearest);
      let nearestIndex = 0;

      for (let i = 1; i < remaining.length; i++) {
        const dist = this.calculateDistance(last, remaining[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = remaining[i];
          nearestIndex = i;
        }
      }

      optimized.push(nearest);
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  }

  private calculateDistance(point1: GPSCoordinate, point2: GPSCoordinate): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.latitude)) *
        Math.cos(this.toRad(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private estimateDuration(distanceKm: number): number {
    return Math.ceil((distanceKm / 40) * 3600); // Assume 40 km/h average speed
  }

  startTrip(
    vehicleId: string,
    driverId: string,
    startLocation: GPSCoordinate,
    route?: RouteOptimization
  ): TripTracking {
    const trip: TripTracking = {
      tripId: `trip_${Date.now()}`,
      vehicleId,
      driverId,
      status: "in_progress",
      startLocation,
      startTime: new Date(),
      distance: 0,
      duration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      locations: [],
      route,
    };

    this.trips.set(trip.tripId, trip);
    this.emit("trip:started", trip);
    return trip;
  }

  endTrip(tripId: string, endLocation: GPSCoordinate): TripTracking | null {
    const trip = this.trips.get(tripId);
    if (!trip) return null;

    trip.status = "completed";
    trip.endLocation = endLocation;
    trip.endTime = new Date();
    trip.duration = (trip.endTime.getTime() - trip.startTime.getTime()) / 1000;

    // Calculate trip metrics
    trip.distance = this.calculateDistance(trip.startLocation, endLocation);
    trip.avgSpeed = trip.duration > 0 ? (trip.distance / (trip.duration / 3600)) * 1000 : 0;
    trip.fuelConsumed = trip.distance / 7;

    // Update vehicle stats
    const stats = this.vehicleStats.get(trip.vehicleId);
    if (stats) {
      stats.totalDistance += trip.distance;
      stats.totalDuration += trip.duration;
      stats.avgSpeed = stats.totalDistance / (stats.totalDuration / 3600);
      stats.tripCount++;
    }

    this.emit("trip:ended", trip);
    return trip;
  }

  getVehicleLocation(vehicleId: string): VehicleLocation | undefined {
    return this.locations.get(vehicleId);
  }

  getVehicleStats(vehicleId: string): VehicleStats | undefined {
    return this.vehicleStats.get(vehicleId);
  }

  getTrip(tripId: string): TripTracking | undefined {
    return this.trips.get(tripId);
  }

  getRoute(routeId: string): RouteOptimization | undefined {
    return this.routes.get(routeId);
  }

  getGeofenceEvents(vehicleId?: string, hours: number = 24): GeofenceEvent[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.geofenceEvents.values()).filter((e) => {
      const matchesVehicle = !vehicleId || e.vehicleId === vehicleId;
      const matchesTime = e.timestamp >= cutoffTime;
      return matchesVehicle && matchesTime;
    });
  }

  getLocationAnalytics(): LocationAnalytics {
    const stats = Array.from(this.vehicleStats.values());
    const activeVehicles = stats.filter((s) => s.status === "online").length;
    const totalDistance = stats.reduce((sum, s) => sum + s.totalDistance, 0);
    const totalDuration = stats.reduce((sum, s) => sum + s.totalDuration, 0);
    const avgSpeed = totalDuration > 0 ? totalDistance / (totalDuration / 3600) : 0;
    const maxSpeeds = stats.map((s) => s.maxSpeed);
    const topSpeed = maxSpeeds.length > 0 ? Math.max(...maxSpeeds) : 0;

    const recentGeofenceEvents = this.getGeofenceEvents(undefined, 24);
    const recentTrips = Array.from(this.trips.values()).filter(
      (t) => t.status === "completed" && t.endTime
    );

    const fuelStats = recentTrips
      .filter((t) => t.fuelConsumed)
      .reduce(
        (sum, t) => sum + (t.fuelConsumed || 0),
        0
      );
    const avgFuelEfficiency =
      totalDistance > 0 ? totalDistance / (fuelStats || 1) : 0;

    return {
      timestamp: new Date(),
      totalVehiclesTracked: this.vehicleStats.size,
      activeVehicles,
      totalDistance,
      totalDuration,
      avgSpeed,
      topSpeed,
      geofenceEvents: recentGeofenceEvents.length,
      routeOptimizations: Array.from(this.routes.values()).filter((r) => r.optimized)
        .length,
      averageFuelEfficiency: avgFuelEfficiency,
      topLocations: this.getTopLocations(),
      offlineVehicles: stats.filter((s) => s.status === "offline").length,
    };
  }

  private getTopLocations(): { coordinate: GPSCoordinate; visits: number }[] {
    const locationMap = new Map<string, GPSCoordinate>();
    const visitCounts = new Map<string, number>();

    this.locationHistory.forEach((loc) => {
      const key = `${loc.coordinate.latitude.toFixed(4)}_${loc.coordinate.longitude.toFixed(4)}`;
      locationMap.set(key, loc.coordinate);
      visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
    });

    return Array.from(visitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, visits]) => ({
        coordinate: locationMap.get(key)!,
        visits,
      }));
  }

  addGeofence(zone: GeofenceZone): GeofenceZone {
    this.geofences.set(zone.zoneId, zone);
    this.emit("geofence:created", zone);
    return zone;
  }

  removeGeofence(zoneId: string): boolean {
    return this.geofences.delete(zoneId);
  }
}

export const vehicleTrackingEngine = new VehicleTrackingEngine();
