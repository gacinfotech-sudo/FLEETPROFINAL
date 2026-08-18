/**
 * GPS Provider Integration Hub
 * Central export for all GPS adapter components
 * Unifies: real-time tracking, geofencing, route optimization, ETA
 */

// Types
export * from './types';

// Adapter
export { GPSAdapter } from './GPSAdapter';

// Registry
export {
  DefaultGpsProviderRegistry,
  createGpsProviderRegistry,
  GpsProviderConfigurationError,
  GpsConnectionNotFoundError,
  GpsConnectionDisabledError,
  GpsProviderNotRegisteredError,
  type IGpsProviderRegistry,
  type GpsProviderAdapterFactory,
  type GpsProviderConnectionResolver,
} from './GPSProviderRegistry';

// Real-Time Tracking
export {
  RealTimeTracker,
  RealTimeTrackingManager,
} from './RealTimeTracking';

// Geofencing
export {
  GeofencingEngine,
  GeofencingManager,
} from './GeoFencing';

// Route Optimization
export {
  RouteOptimizationEngine,
  RouteOptimizationManager,
  type OptimizationAlgorithm,
} from './RouteOptimization';

// Internal imports for Hub class
import { RealTimeTracker, RealTimeTrackingManager } from './RealTimeTracking';
import { GeofencingManager } from './GeoFencing';
import { RouteOptimizationManager } from './RouteOptimization';

/**
 * GPS Integration Hub
 * Single entry point for all GPS operations
 */
export class GpsIntegrationHub {
  readonly adapter: any; // GPSAdapter instance
  readonly registry: any; // DefaultGpsProviderRegistry
  private _realTimeTracking: RealTimeTrackingManager;
  private _geofencing: GeofencingManager;
  private _routeOptimization: RouteOptimizationManager;

  constructor(
    adapter?: any,
    registry?: any,
  ) {
    this.adapter = adapter;
    this.registry = registry;
    this._realTimeTracking = new RealTimeTrackingManager();
    this._geofencing = new GeofencingManager();
    this._routeOptimization = new RouteOptimizationManager();
  }

  get realTimeTracking(): RealTimeTrackingManager {
    return this._realTimeTracking;
  }

  get geofencing(): GeofencingManager {
    return this._geofencing;
  }

  get routeOptimization(): RouteOptimizationManager {
    return this._routeOptimization;
  }

  /**
   * Start real-time tracking session
   */
  async startTracking(
    sessionId: string,
    tenantId: string,
    vehicleId: string,
    deviceId: string,
    websocketUrl: string,
    updateFrequency?: number,
  ): Promise<RealTimeTracker> {
    const tracker = this.realTimeTracking.createTracker(
      sessionId,
      tenantId,
      vehicleId,
      deviceId,
      updateFrequency,
    );

    await tracker.start(websocketUrl);
    return tracker;
  }

  /**
   * Stop tracking session
   */
  async stopTracking(sessionId: string): Promise<void> {
    const tracker = this.realTimeTracking.getTracker(sessionId);

    if (tracker) {
      await tracker.stop();
      this.realTimeTracking.removeTracker(sessionId);
    }
  }

  /**
   * Add geofence
   */
  addGeofence(tenantId: string, geofence: any): void {
    this.geofencing.addGeofence(tenantId, geofence);
  }

  /**
   * Check location against geofences
   */
  checkLocation(
    tenantId: string,
    vehicleId: string,
    deviceId: string,
    location: any,
  ): any[] {
    return this.geofencing.checkLocation(tenantId, vehicleId, deviceId, location);
  }

  /**
   * Optimize route
   */
  async optimizeRoute(
    tenantId: string,
    route: any,
    algorithm?: string,
  ): Promise<any> {
    return this.routeOptimization.optimizeRoute(
      tenantId,
      route,
      algorithm as any,
    );
  }

  /**
   * Calculate ETA
   */
  async calculateETA(
    tenantId: string,
    currentLocation: any,
    destination: any,
    currentSpeedKph?: number,
  ): Promise<any> {
    return this.routeOptimization.calculateETA(
      tenantId,
      currentLocation,
      destination,
      currentSpeedKph,
    );
  }

  /**
   * Shutdown hub
   */
  async shutdown(): Promise<void> {
    await this.realTimeTracking.stopAllTrackers();
    this._geofencing = new GeofencingManager();
    this._routeOptimization = new RouteOptimizationManager();
  }
}

export default GpsIntegrationHub;
