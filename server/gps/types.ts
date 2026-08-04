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

export interface GpsConnectionTestResult {
  success: boolean;
  status: Exclude<GpsConnectionStatus, 'testing'>;
  checkedAt: Date;
  latencyMs?: number;
  providerMessage?: string;
  errorCode?: string;
}

export interface GpsProviderDevice {
  providerDeviceId: string;
  imei?: string;
  simNumber?: string;
  deviceName?: string;
  deviceModel?: string;
  providerDeviceType?: string;
  lastSeenAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface GpsProviderTrip {
  providerTripId?: string;
  providerDeviceId: string;
  startedAt: Date;
  endedAt?: Date;
  distanceKm?: number;
  startOdometerKm?: number;
  endOdometerKm?: number;
}

export interface NormalizedTelemetryPoint {
  tenantId: string;
  connectionId: string;
  gpsDeviceId: string;
  providerDeviceId: string;
  recordedAt: Date;
  receivedAt: Date;
  latitude: number;
  longitude: number;
  speedKph?: number;
  headingDegrees?: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  ignition?: boolean;
  motion?: boolean;
  engineOn?: boolean;
  deviceOdometerKm?: number;
  providerTripDistanceKm?: number;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  gsmSignalStrength?: number;
  address?: string;
  source: 'webhook' | 'websocket' | 'polling' | 'history_sync';
  providerEventId?: string;
  rawPayloadHash?: string;
}

// This server-only shape is deliberately separate from future API response
// DTOs. No route may serialize this object because it contains credentials.
export interface GpsProviderConnectionConfig {
  id: string;
  tenantId: string;
  connectionName: string;
  providerKey: string;
  apiBaseUrl?: string;
  authenticationType: GpsAuthenticationType;
  providerTimezone?: string;
  websocketUrl?: string;
  accountId?: string;
  enabled: boolean;
  status: GpsConnectionStatus;
  secrets: {
    apiUsername?: string;
    apiPassword?: string;
    apiToken?: string;
    clientId?: string;
    clientSecret?: string;
    webhookSecret?: string;
    custom?: Record<string, string>;
  };
}
