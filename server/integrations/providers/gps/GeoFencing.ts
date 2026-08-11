/**
 * Geofencing Handler
 * Boundary detection and alert management for GPS locations
 * Supports circular and polygonal geofences with entry/exit detection
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger';
import {
  GpsGeofence,
  GpsGeofenceEvent,
  GpsLocation,
} from './types';

/**
 * Geofencing Engine
 */
export class GeofencingEngine extends EventEmitter {
  private logger: any;
  private tenantId: string;
  private geofences: Map<string, GpsGeofence> = new Map();
  private vehicleStates: Map<string, Map<string, boolean>> = new Map(); // vehicleId -> (geofenceId -> inside)
  private eventHistory: GpsGeofenceEvent[] = [];

  constructor(tenantId: string) {
    super();
    this.tenantId = tenantId;
    this.logger = createLogger(`GeofencingEngine:${tenantId}`);
  }

  /**
   * Add a geofence
   */
  addGeofence(geofence: GpsGeofence): void {
    if (geofence.tenantId !== this.tenantId) {
      throw new Error(`Geofence tenant mismatch: ${geofence.tenantId} != ${this.tenantId}`);
    }

    this.geofences.set(geofence.id, geofence);

    this.logger.info('Geofence added', {
      geofenceId: geofence.id,
      name: geofence.name,
      type: geofence.type,
    });
  }

  /**
   * Remove a geofence
   */
  removeGeofence(geofenceId: string): void {
    if (!this.geofences.has(geofenceId)) {
      return;
    }

    this.geofences.delete(geofenceId);

    // Clean up vehicle states
    const statesArray = Array.from(this.vehicleStates.values());
    for (const vehicleStates of statesArray) {
      vehicleStates.delete(geofenceId);
    }

    this.logger.info('Geofence removed', { geofenceId });
  }

  /**
   * Get all geofences
   */
  getGeofences(): GpsGeofence[] {
    const result: GpsGeofence[] = [];
    const values = Array.from(this.geofences.values());
    for (const geofence of values) {
      result.push(geofence);
    }
    return result;
  }

  /**
   * Get geofence by ID
   */
  getGeofence(geofenceId: string): GpsGeofence | undefined {
    return this.geofences.get(geofenceId);
  }

  /**
   * Enable/disable a geofence
   */
  setGeofenceStatus(geofenceId: string, enabled: boolean): void {
    const geofence = this.geofences.get(geofenceId);

    if (!geofence) {
      return;
    }

    geofence.enabled = enabled;
    geofence.updatedAt = new Date();
  }

  /**
   * Check vehicle location against all geofences
   */
  checkLocation(vehicleId: string, deviceId: string, location: GpsLocation): GpsGeofenceEvent[] {
    const events: GpsGeofenceEvent[] = [];
    let vehicleStates = this.vehicleStates.get(vehicleId);

    if (!vehicleStates) {
      vehicleStates = new Map();
      this.vehicleStates.set(vehicleId, vehicleStates);
    }

    const geofencesArray = Array.from(this.geofences.values());
    for (const geofence of geofencesArray) {
      if (!geofence.enabled) {
        continue;
      }

      const isInside = this.isLocationInsideGeofence(location, geofence);
      const wasInside = vehicleStates.get(geofence.id) ?? false;

      // Entry event
      if (isInside && !wasInside && geofence.alertOnEntry) {
        const event: GpsGeofenceEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: this.tenantId,
          geofenceId: geofence.id,
          vehicleId,
          deviceId,
          eventType: 'entry',
          location,
          timestamp: new Date(),
        };

        events.push(event);
        this.eventHistory.push(event);

        this.emit('geofence_entry', event);
        this.logger.info('Geofence entry detected', {
          geofenceId: geofence.id,
          vehicleId,
          location: `${location.latitude},${location.longitude}`,
        });
      }

      // Exit event
      if (!isInside && wasInside && geofence.alertOnExit) {
        const event: GpsGeofenceEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: this.tenantId,
          geofenceId: geofence.id,
          vehicleId,
          deviceId,
          eventType: 'exit',
          location,
          timestamp: new Date(),
        };

        events.push(event);
        this.eventHistory.push(event);

        this.emit('geofence_exit', event);
        this.logger.info('Geofence exit detected', {
          geofenceId: geofence.id,
          vehicleId,
          location: `${location.latitude},${location.longitude}`,
        });
      }

      vehicleStates.set(geofence.id, isInside);
    }

    return events;
  }

  /**
   * Check if location is inside geofence
   */
  private isLocationInsideGeofence(location: GpsLocation, geofence: GpsGeofence): boolean {
    if (geofence.type === 'circle') {
      return this.isLocationInsideCircle(location, geofence);
    } else {
      return this.isLocationInsidePolygon(location, geofence);
    }
  }

  /**
   * Check if location is inside circular geofence
   */
  private isLocationInsideCircle(location: GpsLocation, geofence: GpsGeofence): boolean {
    if (!geofence.center || geofence.radius === undefined) {
      return false;
    }

    const distance = this.getDistanceBetweenPoints(location, geofence.center);
    return distance <= geofence.radius;
  }

  /**
   * Check if location is inside polygonal geofence
   */
  private isLocationInsidePolygon(location: GpsLocation, geofence: GpsGeofence): boolean {
    if (!geofence.points || geofence.points.length < 3) {
      return false;
    }

    // Use ray casting algorithm
    let inside = false;
    const x = location.latitude;
    const y = location.longitude;

    for (let i = 0, j = geofence.points.length - 1; i < geofence.points.length; j = i++) {
      const xi = geofence.points[i].latitude;
      const yi = geofence.points[i].longitude;
      const xj = geofence.points[j].latitude;
      const yj = geofence.points[j].longitude;

      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
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
   * Get vehicle's current geofence status
   */
  getVehicleGeofenceStatus(vehicleId: string): Map<string, boolean> {
    return this.vehicleStates.get(vehicleId) || new Map();
  }

  /**
   * Get geofence events
   */
  getEvents(
    geofenceId?: string,
    vehicleId?: string,
    limit?: number,
  ): GpsGeofenceEvent[] {
    let events = [...this.eventHistory];

    if (geofenceId) {
      events = events.filter(e => e.geofenceId === geofenceId);
    }

    if (vehicleId) {
      events = events.filter(e => e.vehicleId === vehicleId);
    }

    if (limit) {
      events = events.slice(-limit);
    }

    return events;
  }

  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Clear vehicle states
   */
  clearVehicleStates(): void {
    this.vehicleStates.clear();
  }

  /**
   * Register entry handler
   */
  onEntry(handler: (event: GpsGeofenceEvent) => void): void {
    this.on('geofence_entry', (event) => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Error in entry handler', error as Error);
      }
    });
  }

  /**
   * Register exit handler
   */
  onExit(handler: (event: GpsGeofenceEvent) => void): void {
    this.on('geofence_exit', (event) => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Error in exit handler', error as Error);
      }
    });
  }
}

/**
 * Geofencing Manager
 */
export class GeofencingManager {
  private logger: any;
  private engines: Map<string, GeofencingEngine> = new Map();

  constructor() {
    this.logger = createLogger('GeofencingManager');
  }

  /**
   * Get or create geofencing engine for tenant
   */
  getEngine(tenantId: string): GeofencingEngine {
    if (!this.engines.has(tenantId)) {
      this.engines.set(tenantId, new GeofencingEngine(tenantId));
    }

    return this.engines.get(tenantId)!;
  }

  /**
   * Add geofence
   */
  addGeofence(tenantId: string, geofence: GpsGeofence): void {
    this.getEngine(tenantId).addGeofence(geofence);
  }

  /**
   * Remove geofence
   */
  removeGeofence(tenantId: string, geofenceId: string): void {
    this.getEngine(tenantId).removeGeofence(geofenceId);
  }

  /**
   * Check location
   */
  checkLocation(
    tenantId: string,
    vehicleId: string,
    deviceId: string,
    location: GpsLocation,
  ): GpsGeofenceEvent[] {
    return this.getEngine(tenantId).checkLocation(vehicleId, deviceId, location);
  }
}

export default GeofencingEngine;
