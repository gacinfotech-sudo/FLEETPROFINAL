/**
 * GPS Provider Adapter Types
 * Unified types for GPS integration adapters
 */

/**
 * GPS Provider Type
 */
export type GpsProviderType =
  | 'google_maps'
  | 'here_maps'
  | 'mapbox'
  | 'telematics_box'
  | 'samsara'
  | 'verizon_connect'
  | 'geotab'
  | 'mock';

/**
 * GPS Device Status
 */
export type GpsDeviceStatus = 'online' | 'offline' | 'inactive' | 'faulty';

/**
 * GPS Tracking Mode
 */
export type TrackingMode = 'real_time' | 'polling' | 'webhook' | 'hybrid';

/**
 * GPS Location Point
 */
export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
  altitude?: number; // meters
  speedKph?: number;
  headingDegrees?: number;
  timestamp: Date;
}

/**
 * GPS Vehicle Telemetry
 */
export interface GpsVehicleTelemetry {
  vehicleId: string;
  tenantId: string;
  deviceId: string;
  providerDeviceId: string;
  location: GpsLocation;
  status: GpsDeviceStatus;
  batteryLevel?: number; // 0-100
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  gsmSignalStrength?: number;
  ignition?: boolean;
  motion?: boolean;
  engineOn?: boolean;
  odometer?: number; // km
  tripDistance?: number; // km
  address?: string;
  recordedAt: Date;
  receivedAt: Date;
  source: 'websocket' | 'webhook' | 'polling' | 'history';
}

/**
 * GPS Geofence
 */
export interface GpsGeofence {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: 'circle' | 'polygon';
  center?: GpsLocation; // For circles
  radius?: number; // meters
  points?: GpsLocation[]; // For polygons
  enabled: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GPS Geofence Event
 */
export interface GpsGeofenceEvent {
  id: string;
  tenantId: string;
  geofenceId: string;
  vehicleId: string;
  deviceId: string;
  eventType: 'entry' | 'exit';
  location: GpsLocation;
  timestamp: Date;
}

/**
 * GPS Route
 */
export interface GpsRoute {
  id: string;
  tenantId: string;
  name: string;
  startLocation: GpsLocation;
  endLocation: GpsLocation;
  waypoints?: GpsLocation[];
  distanceKm: number;
  durationMinutes: number;
  instructions?: string[];
  optimized?: boolean;
}

/**
 * GPS Route Optimization Result
 */
export interface RouteOptimizationResult {
  id: string;
  tenantId: string;
  originalRoute: GpsRoute;
  optimizedRoute: GpsRoute;
  distanceSavingKm: number;
  timeSavingMinutes: number;
  timestamp: Date;
}

/**
 * GPS Device
 */
export interface GpsDevice {
  id: string;
  tenantId: string;
  providerDeviceId: string;
  name: string;
  imei?: string;
  simNumber?: string;
  model?: string;
  status: GpsDeviceStatus;
  lastLocation?: GpsLocation;
  lastSeenAt?: Date;
  batteryLevel?: number;
  activeSince?: Date;
}

/**
 * GPS Real-Time Tracking Session
 */
export interface GpsTrackingSession {
  id: string;
  tenantId: string;
  vehicleId: string;
  deviceId: string;
  trackingMode: TrackingMode;
  startedAt: Date;
  endedAt?: Date;
  active: boolean;
  lastUpdate?: Date;
  updateFrequencySeconds?: number;
}

/**
 * GPS Adapter Configuration
 */
export interface GpsAdapterConfig {
  providerType: GpsProviderType;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  apiEndpoint?: string;
  region?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
  websocketUrl?: string;
  maxDevices?: number;
  updateFrequency?: number; // seconds
  [key: string]: any;
}

/**
 * GPS WebSocket Message Types
 */
export type GpsWebSocketMessage =
  | GpsLocationUpdateMessage
  | GpsDeviceStatusMessage
  | GpsErrorMessage
  | GpsAcknowledgementMessage;

export interface GpsLocationUpdateMessage {
  type: 'location_update';
  deviceId: string;
  location: GpsLocation;
  telemetry: Partial<GpsVehicleTelemetry>;
}

export interface GpsDeviceStatusMessage {
  type: 'device_status';
  deviceId: string;
  status: GpsDeviceStatus;
  metadata?: Record<string, any>;
}

export interface GpsErrorMessage {
  type: 'error';
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface GpsAcknowledgementMessage {
  type: 'ack';
  messageId?: string;
  success: boolean;
}

/**
 * GPS ETA Result
 */
export interface GpsEtaResult {
  vehicleId: string;
  destination: GpsLocation;
  estimatedArrivalTime: Date;
  distanceKm: number;
  durationMinutes: number;
  traffic?: 'light' | 'moderate' | 'heavy';
  routePolyline?: string;
}

/**
 * GPS Audit Event
 */
export interface GpsAuditEvent {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId: string;
  status: 'success' | 'failure';
  details?: Record<string, any>;
  timestamp: Date;
}
