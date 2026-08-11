import type {
  GpsConnectionTestResult,
  GpsProviderDevice,
  GpsProviderTrip,
  NormalizedTelemetryPoint,
} from '../types';

export interface GpsProviderAdapter {
  readonly providerKey: string;

  testConnection(): Promise<GpsConnectionTestResult>;
  listDevices(): Promise<GpsProviderDevice[]>;
  getDevice(deviceId: string): Promise<GpsProviderDevice>;
  getLatestPosition(deviceId: string): Promise<NormalizedTelemetryPoint | null>;
  getPositionHistory(
    deviceId: string,
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<NormalizedTelemetryPoint[]>;
  getTripHistory?(
    deviceId: string,
    startDateTime: Date,
    endDateTime: Date,
  ): Promise<GpsProviderTrip[]>;
  subscribeToLivePositions?(
    deviceIds: string[],
    onPosition: (position: NormalizedTelemetryPoint) => Promise<void>,
  ): Promise<() => Promise<void>>;
  verifyWebhookSignature?(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean>;
}
