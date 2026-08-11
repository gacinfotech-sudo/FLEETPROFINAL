/**
 * GPS Provider Adapter
 * Base adapter for GPS providers, extending BaseProviderAdapter
 * Implements common GPS operations: tracking, geofencing, routing, ETA
 */

import { BaseProviderAdapter } from '../../adapters/BaseProviderAdapter';
import {
  AdapterOptions,
  AdapterRequest,
  AdapterResponse,
} from '../../types';
import {
  GpsLocation,
  GpsVehicleTelemetry,
  GpsDevice,
  GpsGeofence,
  GpsRoute,
  GpsTrackingSession,
  GpsEtaResult,
  GpsAuditEvent,
  RouteOptimizationResult,
  GpsProviderType,
} from './types';

/**
 * Abstract GPS Provider Adapter
 * Base class for all GPS provider implementations
 */
export abstract class GPSAdapter extends BaseProviderAdapter {
  protected providerType: GpsProviderType;
  protected activeTrackingSessions: Map<string, GpsTrackingSession> = new Map();
  protected websocketConnections: Map<string, any> = new Map();

  constructor(options: AdapterOptions & { providerType: GpsProviderType }) {
    super(options);
    this.providerType = options.providerType;
  }

  /**
   * Get provider ID (GPS provider type)
   */
  override getProviderId(): string {
    return `gps_${this.providerType}`;
  }

  /**
   * Execute action on GPS provider
   */
  override async executeAction(request: AdapterRequest): Promise<AdapterResponse> {
    this.logAction(request.action, 'start', { tenantId: request.tenantId });

    try {
      switch (request.action) {
        case 'get_vehicle_location':
          return await this.getVehicleLocation(request.tenantId, request.data);

        case 'get_location_history':
          return await this.getLocationHistory(request.tenantId, request.data);

        case 'start_tracking':
          return await this.startTracking(request.tenantId, request.data);

        case 'stop_tracking':
          return await this.stopTracking(request.tenantId, request.data);

        case 'list_devices':
          return await this.listDevices(request.tenantId);

        case 'get_device':
          return await this.getDevice(request.tenantId, request.data);

        case 'create_geofence':
          return await this.createGeofence(request.tenantId, request.data);

        case 'list_geofences':
          return await this.listGeofences(request.tenantId);

        case 'delete_geofence':
          return await this.deleteGeofence(request.tenantId, request.data);

        case 'optimize_route':
          return await this.optimizeRoute(request.tenantId, request.data);

        case 'calculate_eta':
          return await this.calculateEta(request.tenantId, request.data);

        case 'get_audit_logs':
          return await this.getAuditLogs(request.tenantId, request.data);

        case 'health_check':
          return this.buildResponse(true, { status: 'healthy' });

        default:
          return this.buildResponse(false, undefined, {
            code: 'UNKNOWN_ACTION',
            message: `Unknown action: ${request.action}`,
          });
      }
    } catch (error) {
      this.logAction(request.action, 'error', { error: String(error) });
      return this.buildResponse(false, undefined, {
        code: 'ADAPTER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { action: request.action },
      });
    }
  }

  /**
   * Get current vehicle location
   * Implement in subclass for provider-specific logic
   */
  protected async getVehicleLocation(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsVehicleTelemetry>> {
    this.checkRateLimit(`${tenantId}:vehicle_location`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'getVehicleLocation not implemented in this adapter',
    });
  }

  /**
   * Get location history
   */
  protected async getLocationHistory(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsLocation[]>> {
    this.checkRateLimit(`${tenantId}:location_history`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'getLocationHistory not implemented in this adapter',
    });
  }

  /**
   * Start tracking a vehicle
   */
  protected async startTracking(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsTrackingSession>> {
    this.checkRateLimit(`${tenantId}:start_tracking`);

    const { vehicleId, deviceId, trackingMode = 'real_time', updateFrequency = 5 } = data;

    if (!vehicleId || !deviceId) {
      return this.buildResponse(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'vehicleId and deviceId are required',
      });
    }

    const session: GpsTrackingSession = {
      id: `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      vehicleId,
      deviceId,
      trackingMode,
      startedAt: new Date(),
      active: true,
      updateFrequencySeconds: updateFrequency,
    };

    this.activeTrackingSessions.set(session.id, session);

    this.logger.info('Tracking session started', {
      sessionId: session.id,
      vehicleId,
      deviceId,
      tenantId,
    });

    return this.buildResponse(true, session);
  }

  /**
   * Stop tracking a vehicle
   */
  protected async stopTracking(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<{ sessionId: string; stoppedAt: Date }>> {
    this.checkRateLimit(`${tenantId}:stop_tracking`);

    const { sessionId } = data;

    if (!sessionId) {
      return this.buildResponse(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'sessionId is required',
      });
    }

    const session = this.activeTrackingSessions.get(sessionId);

    if (!session) {
      return this.buildResponse(false, undefined, {
        code: 'NOT_FOUND',
        message: `Tracking session not found: ${sessionId}`,
      });
    }

    session.active = false;
    session.endedAt = new Date();
    this.activeTrackingSessions.delete(sessionId);

    this.logger.info('Tracking session stopped', {
      sessionId,
      tenantId,
    });

    return this.buildResponse(true, {
      sessionId,
      stoppedAt: session.endedAt,
    });
  }

  /**
   * List all devices
   */
  protected async listDevices(
    tenantId: string,
  ): Promise<AdapterResponse<GpsDevice[]>> {
    this.checkRateLimit(`${tenantId}:list_devices`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'listDevices not implemented in this adapter',
    });
  }

  /**
   * Get device details
   */
  protected async getDevice(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsDevice>> {
    this.checkRateLimit(`${tenantId}:get_device`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'getDevice not implemented in this adapter',
    });
  }

  /**
   * Create geofence
   */
  protected async createGeofence(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsGeofence>> {
    this.checkRateLimit(`${tenantId}:create_geofence`);

    const { name, type, center, radius, points } = data;

    if (!name || !type) {
      return this.buildResponse(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'name and type are required',
      });
    }

    const geofence: GpsGeofence = {
      id: `geofence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      name,
      type: type as 'circle' | 'polygon',
      center,
      radius,
      points,
      enabled: true,
      alertOnEntry: true,
      alertOnExit: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.info('Geofence created', {
      geofenceId: geofence.id,
      name,
      tenantId,
    });

    return this.buildResponse(true, geofence);
  }

  /**
   * List geofences
   */
  protected async listGeofences(
    tenantId: string,
  ): Promise<AdapterResponse<GpsGeofence[]>> {
    this.checkRateLimit(`${tenantId}:list_geofences`);
    return this.buildResponse(true, []);
  }

  /**
   * Delete geofence
   */
  protected async deleteGeofence(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<{ geofenceId: string; deleted: boolean }>> {
    this.checkRateLimit(`${tenantId}:delete_geofence`);

    const { geofenceId } = data;

    if (!geofenceId) {
      return this.buildResponse(false, undefined, {
        code: 'INVALID_REQUEST',
        message: 'geofenceId is required',
      });
    }

    this.logger.info('Geofence deleted', {
      geofenceId,
      tenantId,
    });

    return this.buildResponse(true, {
      geofenceId,
      deleted: true,
    });
  }

  /**
   * Optimize route
   */
  protected async optimizeRoute(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<RouteOptimizationResult>> {
    this.checkRateLimit(`${tenantId}:optimize_route`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'optimizeRoute not implemented in this adapter',
    });
  }

  /**
   * Calculate ETA
   */
  protected async calculateEta(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsEtaResult>> {
    this.checkRateLimit(`${tenantId}:calculate_eta`);
    return this.buildResponse(false, undefined, {
      code: 'NOT_IMPLEMENTED',
      message: 'calculateEta not implemented in this adapter',
    });
  }

  /**
   * Get audit logs
   */
  protected async getAuditLogs(
    tenantId: string,
    data: any,
  ): Promise<AdapterResponse<GpsAuditEvent[]>> {
    this.checkRateLimit(`${tenantId}:get_audit_logs`);
    return this.buildResponse(true, []);
  }

  /**
   * Connect WebSocket for real-time tracking
   */
  async connectWebSocket(
    sessionId: string,
    onMessage: (message: any) => Promise<void>,
  ): Promise<void> {
    const session = this.activeTrackingSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.logger.info('WebSocket connection requested', {
      sessionId,
      vehicleId: session.vehicleId,
    });

    // Subclasses implement WebSocket logic
  }

  /**
   * Disconnect WebSocket
   */
  async disconnectWebSocket(sessionId: string): Promise<void> {
    const connection = this.websocketConnections.get(sessionId);

    if (connection) {
      this.websocketConnections.delete(sessionId);
      this.logger.info('WebSocket disconnected', { sessionId });
    }
  }

  /**
   * Get active tracking sessions
   */
  getActiveTrackingSessions(): GpsTrackingSession[] {
    return Array.from(this.activeTrackingSessions.values());
  }

  /**
   * Get session by ID
   */
  getTrackingSession(sessionId: string): GpsTrackingSession | undefined {
    return this.activeTrackingSessions.get(sessionId);
  }
}

export default GPSAdapter;
