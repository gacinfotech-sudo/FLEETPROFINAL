/**
 * Route Optimization Handler
 * Route planning, optimization, and ETA calculation
 * Supports multiple algorithm strategies
 */

import { createLogger } from '../../../utils/logger';
import {
  GpsLocation,
  GpsRoute,
  RouteOptimizationResult,
  GpsEtaResult,
} from './types';

/**
 * Route Optimization Algorithm
 */
export type OptimizationAlgorithm = 'distance' | 'time' | 'balanced' | 'ml';

/**
 * Route Optimization Engine
 */
export class RouteOptimizationEngine {
  private logger: any;
  private tenantId: string;
  private optimizationCache: Map<string, RouteOptimizationResult> = new Map();

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.logger = createLogger(`RouteOptimizationEngine:${tenantId}`);
  }

  /**
   * Optimize route
   */
  async optimizeRoute(
    originalRoute: GpsRoute,
    algorithm: OptimizationAlgorithm = 'balanced',
  ): Promise<RouteOptimizationResult> {
    const cacheKey = this.getCacheKey(originalRoute);
    const cached = this.optimizationCache.get(cacheKey);

    if (cached) {
      this.logger.debug('Returning cached optimization', { routeId: originalRoute.id });
      return cached;
    }

    this.logger.info('Optimizing route', {
      routeId: originalRoute.id,
      algorithm,
      waypointCount: originalRoute.waypoints?.length || 0,
    });

    let optimizedRoute: GpsRoute;

    switch (algorithm) {
      case 'distance':
        optimizedRoute = await this.optimizeByDistance(originalRoute);
        break;

      case 'time':
        optimizedRoute = await this.optimizeByTime(originalRoute);
        break;

      case 'balanced':
        optimizedRoute = await this.optimizeBalanced(originalRoute);
        break;

      case 'ml':
        optimizedRoute = await this.optimizeWithML(originalRoute);
        break;

      default:
        optimizedRoute = { ...originalRoute };
    }

    const result: RouteOptimizationResult = {
      id: `optimization_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId: this.tenantId,
      originalRoute,
      optimizedRoute,
      distanceSavingKm: Math.max(0, originalRoute.distanceKm - optimizedRoute.distanceKm),
      timeSavingMinutes: Math.max(0, originalRoute.durationMinutes - optimizedRoute.durationMinutes),
      timestamp: new Date(),
    };

    this.optimizationCache.set(cacheKey, result);

    // Keep cache size reasonable
    if (this.optimizationCache.size > 1000) {
      const oldestKey = this.optimizationCache.keys().next().value;
      this.optimizationCache.delete(oldestKey);
    }

    this.logger.info('Route optimization complete', {
      routeId: originalRoute.id,
      distanceSavingKm: result.distanceSavingKm,
      timeSavingMinutes: result.timeSavingMinutes,
    });

    return result;
  }

  /**
   * Optimize by minimum distance
   */
  private async optimizeByDistance(originalRoute: GpsRoute): Promise<GpsRoute> {
    if (!originalRoute.waypoints || originalRoute.waypoints.length === 0) {
      return originalRoute;
    }

    // Simple nearest neighbor algorithm
    const waypoints = [...originalRoute.waypoints];
    const optimizedWaypoints: GpsLocation[] = [];
    let current = originalRoute.startLocation;

    while (waypoints.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < waypoints.length; i++) {
        const distance = this.getDistanceBetweenPoints(current, waypoints[i]);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      const nearest = waypoints.splice(nearestIndex, 1)[0];
      optimizedWaypoints.push(nearest);
      current = nearest;
    }

    const totalDistance = this.calculateTotalDistance([
      originalRoute.startLocation,
      ...optimizedWaypoints,
      originalRoute.endLocation,
    ]);

    return {
      ...originalRoute,
      waypoints: optimizedWaypoints,
      distanceKm: totalDistance / 1000,
      durationMinutes: Math.ceil((totalDistance / 1000) / 50 * 60), // Assume 50 km/h average
      optimized: true,
    };
  }

  /**
   * Optimize by minimum time
   */
  private async optimizeByTime(originalRoute: GpsRoute): Promise<GpsRoute> {
    // Similar to distance but with speed consideration
    if (!originalRoute.waypoints || originalRoute.waypoints.length === 0) {
      return originalRoute;
    }

    // For simplicity, use same as distance optimization
    // In production, would use actual traffic data
    return this.optimizeByDistance(originalRoute);
  }

  /**
   * Balanced optimization (distance + time)
   */
  private async optimizeBalanced(originalRoute: GpsRoute): Promise<GpsRoute> {
    // Use distance optimization but adjust for traffic patterns
    const optimized = await this.optimizeByDistance(originalRoute);

    // Add 15% time buffer for traffic
    return {
      ...optimized,
      durationMinutes: Math.ceil(optimized.durationMinutes * 1.15),
    };
  }

  /**
   * ML-based optimization
   */
  private async optimizeWithML(originalRoute: GpsRoute): Promise<GpsRoute> {
    // Placeholder for ML-based route optimization
    // In production, would use ML models trained on historical data
    this.logger.info('Using ML-based optimization (simulated)');
    return this.optimizeBalanced(originalRoute);
  }

  /**
   * Calculate ETA
   */
  async calculateETA(
    currentLocation: GpsLocation,
    destination: GpsLocation,
    currentSpeedKph?: number,
  ): Promise<GpsEtaResult> {
    this.logger.debug('Calculating ETA', {
      fromLocation: `${currentLocation.latitude},${currentLocation.longitude}`,
      toLocation: `${destination.latitude},${destination.longitude}`,
    });

    const distance = this.getDistanceBetweenPoints(currentLocation, destination);
    const distanceKm = distance / 1000;

    // Default speed: 50 km/h (adjustable based on actual speed)
    const avgSpeed = currentSpeedKph || 50;
    const durationMinutes = (distanceKm / avgSpeed) * 60;

    const arrivalTime = new Date();
    arrivalTime.setMinutes(arrivalTime.getMinutes() + Math.ceil(durationMinutes));

    // Determine traffic condition (simple heuristic)
    let traffic: 'light' | 'moderate' | 'heavy' = 'light';

    if (durationMinutes > distanceKm / 60 * 1.5) {
      traffic = 'moderate';
    }

    if (durationMinutes > distanceKm / 60 * 2) {
      traffic = 'heavy';
    }

    const result: GpsEtaResult = {
      vehicleId: '', // Set by caller
      destination,
      estimatedArrivalTime: arrivalTime,
      distanceKm,
      durationMinutes: Math.ceil(durationMinutes),
      traffic,
    };

    this.logger.debug('ETA calculated', {
      distanceKm,
      durationMinutes: result.durationMinutes,
      traffic,
    });

    return result;
  }

  /**
   * Get route polyline
   */
  getRoutePolyline(waypoints: GpsLocation[]): string {
    // Simple implementation - in production would use polyline encoding
    return waypoints
      .map(p => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`)
      .join(';');
  }

  /**
   * Calculate total distance for route
   */
  private calculateTotalDistance(locations: GpsLocation[]): number {
    let total = 0;

    for (let i = 0; i < locations.length - 1; i++) {
      total += this.getDistanceBetweenPoints(locations[i], locations[i + 1]);
    }

    return total;
  }

  /**
   * Get distance between two points in meters
   */
  private getDistanceBetweenPoints(p1: GpsLocation, p2: GpsLocation): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRad(p2.latitude - p1.latitude);
    const dLon = this.toRad(p2.longitude - p1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(p1.latitude)) *
        Math.cos(this.toRad(p2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Get cache key for route
   */
  private getCacheKey(route: GpsRoute): string {
    const waypointsStr = (route.waypoints || [])
      .map(w => `${w.latitude},${w.longitude}`)
      .join('|');

    return `${route.startLocation.latitude},${route.startLocation.longitude}|${route.endLocation.latitude},${route.endLocation.longitude}|${waypointsStr}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.optimizationCache.clear();
    this.logger.info('Optimization cache cleared');
  }
}

/**
 * Route Optimization Manager
 */
export class RouteOptimizationManager {
  private logger: any;
  private engines: Map<string, RouteOptimizationEngine> = new Map();

  constructor() {
    this.logger = createLogger('RouteOptimizationManager');
  }

  /**
   * Get or create engine for tenant
   */
  getEngine(tenantId: string): RouteOptimizationEngine {
    if (!this.engines.has(tenantId)) {
      this.engines.set(tenantId, new RouteOptimizationEngine(tenantId));
    }

    return this.engines.get(tenantId)!;
  }

  /**
   * Optimize route for tenant
   */
  async optimizeRoute(
    tenantId: string,
    route: GpsRoute,
    algorithm?: OptimizationAlgorithm,
  ): Promise<RouteOptimizationResult> {
    return this.getEngine(tenantId).optimizeRoute(route, algorithm);
  }

  /**
   * Calculate ETA
   */
  async calculateETA(
    tenantId: string,
    currentLocation: GpsLocation,
    destination: GpsLocation,
    currentSpeedKph?: number,
  ): Promise<GpsEtaResult> {
    return this.getEngine(tenantId).calculateETA(currentLocation, destination, currentSpeedKph);
  }
}

export default RouteOptimizationEngine;
