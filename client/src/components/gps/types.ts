// TASK-GPS-FLEET-UI-05 — client-side GPS types.
//
// These are deliberately mirrored (not imported) from the server-side shapes
// documented in `server/gps/types.ts`, `server/gps/services/*.ts`'s `public*()`
// serializers, and TASK-GPS-INGESTION-04's finalized read interfaces
// (`server/gps/telemetry/queries.ts`). The client bundle cannot import from
// `server/**` (Node-only code, and this repo has no `shared/` package for GPS
// types), so this file is the client's own copy of "what the API actually
// returns." Keep it in sync by hand if a server shape changes.

export type GpsConnectionStatus =
  | 'configuration_required'
  | 'testing'
  | 'connected'
  | 'authentication_failed'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'webhook_failed'
  | 'sync_failed'
  | 'disabled';

export type GpsAuthenticationType =
  | 'api_key'
  | 'bearer_token'
  | 'basic_authentication'
  | 'oauth_client_credentials'
  | 'session_login'
  | 'custom_provider_authentication';

// Matches connectionService.ts's publicGpsConnection() — credentials are
// always pre-masked server-side (`{ [field]: '••••••' }`), never plaintext.
export interface GpsConnection {
  id: string;
  connectionName: string;
  providerKey: string;
  apiBaseUrl?: string;
  authenticationType: GpsAuthenticationType;
  accountId?: string;
  providerTimezone?: string;
  websocketUrl?: string;
  pollingIntervalSeconds: number;
  enabled: boolean;
  status: GpsConnectionStatus;
  credentials: Record<string, string>;
  lastTestedAt?: string;
  lastSuccessfulSync?: string;
  lastFailedSync?: string;
  lastError?: string;
}

export interface GpsConnectionCredentialsInput {
  apiUsername?: string;
  apiPassword?: string;
  apiToken?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  custom?: Record<string, string>;
}

export interface CreateGpsConnectionInput {
  connectionName: string;
  providerKey: string;
  apiBaseUrl?: string;
  authenticationType: GpsAuthenticationType;
  accountId?: string;
  providerTimezone?: string;
  websocketUrl?: string;
  pollingIntervalSeconds?: number;
  enabled?: boolean;
  credentials?: GpsConnectionCredentialsInput;
}

export type GpsDeviceStatus = 'unassigned' | 'assigned' | 'online' | 'offline' | 'inactive' | 'faulty' | 'removed';

// Matches deviceService.ts's publicGpsDevice().
export interface GpsDevice {
  id: string;
  connectionId: string;
  internalDeviceCode: string;
  providerDeviceId: string;
  imei?: string;
  simNumber?: string;
  deviceName?: string;
  deviceModel?: string;
  providerDeviceType?: string;
  status: GpsDeviceStatus;
  lastSeenAt?: string;
  lastLocationAt?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  gsmSignalStrength?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Matches assignmentService.ts's publicVehicleGpsAssignment().
export interface VehicleGpsAssignment {
  id: string;
  vehicleId: string;
  gpsDeviceId: string;
  connectionId: string;
  vehicle?: {
    id: string;
    make: string;
    vehicleModel?: string;
    licensePlate?: string;
    operationalStatus?: string;
  };
  device?: GpsDevice;
  connection?: {
    id: string;
    connectionName: string;
    providerKey: string;
    status: GpsConnectionStatus;
  };
  assignedFrom: string;
  assignedUntil?: string;
  status: 'active' | 'ended';
  assignedBy?: string;
  endedBy?: string;
  endReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// A minimal projection of `/api/vehicles`' Vehicle document — only the
// fields this feature actually renders.
export interface FleetVehicle {
  _id: string;
  make: string;
  vehicleModel?: string;
  licensePlate?: string;
  status?: string;
}

export type MovingStatus = 'moving' | 'stopped' | 'offline';

// Mirrors `VehicleLatestState` from TASK-GPS-INGESTION-04's finalized
// `server/gps/telemetry/queries.ts` (see that task's report for the exact
// signature this was copied from).
export interface VehicleLatestState {
  tenantId: string;
  gpsDeviceId: string;
  connectionId: string;
  providerDeviceId: string;
  recordedAt: string;
  receivedAt: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  headingDegrees?: number;
  altitudeMeters?: number;
  ignition?: boolean;
  motion?: boolean;
  engineOn?: boolean;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  address?: string;
  movingStatus: MovingStatus;
  movingStatusSince: string;
  source: 'webhook' | 'websocket' | 'polling' | 'history_sync';
  updatedAt: string;
}

// Mirrors `StoredTelemetryPoint` (NormalizedTelemetryPoint + movingStatus)
// from the same finalized interface, used by route replay.
export interface StoredTelemetryPoint {
  gpsDeviceId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  headingDegrees?: number;
  ignition?: boolean;
  motion?: boolean;
  movingStatus: MovingStatus;
  address?: string;
}

// One row of the proposed `GET /api/gps/vehicles/latest-states` aggregation
// (see client/src/components/gps/api.ts for why this endpoint is proposed,
// not existing). Vehicles with no active GPS assignment never appear here —
// the Live Map and mapping table treat "vehicle absent from this list" as
// "not GPS-tracked", never as "tracked but hidden".
export interface VehicleLiveStateRow {
  vehicleId: string;
  make: string;
  vehicleModel?: string;
  licensePlate?: string;
  gpsDeviceId: string;
  connectionId: string;
  providerKey: string;
  deviceInternalCode?: string;
  state: VehicleLatestState | null; // null = assigned device has no stored telemetry yet
}

// Mirrors the capability set implied by `docs/gps-research/GPS-DATA-SOURCE-MATRIX.md`
// §8 ("Capability flags this matrix implies"). See capabilities.ts for the
// static, per-provider table built from that matrix, and for why the UI
// defaults every flag to `false` for a provider it doesn't recognize.
export interface GpsProviderCapabilities {
  hasMovingStatus: boolean;
  hasOnlineStatus: boolean;
  hasIgnition: boolean;
  hasOdometer: boolean;
  hasEngineHours: boolean;
  hasGeofenceEvents: boolean;
  hasNativeTrips: boolean;
  hasWebhooks: boolean;
}

// Mirrors the proposed `getConnectionSyncHealth()` read-time rollup from
// TASK-GPS-INGESTION-04's `server/gps/ingestion/syncHealth.ts`.
export interface GpsConnectionSyncHealth {
  connectionId: string;
  devicesTracked: number;
  devicesHealthy: number;
  devicesFailing: number;
  openDeadLetters: number;
  lastPolledAt?: string;
  lastSuccessAt?: string;
}
