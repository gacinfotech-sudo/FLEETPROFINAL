import mongoose from 'mongoose';
import { GpsDevice } from '../models/gpsDevice';

/**
 * Resolves a provider's own device id to FleetPro's internal `GpsDevice._id`
 * within one connection/tenant. This is how this task closes
 * TASK-GPS-CONNECTION-02's interface gap #2 (`NormalizedTelemetryPoint.
 * gpsDeviceId` cannot be honestly populated by an adapter) — the polling
 * scheduler already has the internal device list on hand (it queries
 * `GpsDevice` directly to know which devices to poll) so it doesn't call
 * this; it's the webhook receiver, which only has a provider-supplied
 * `providerDeviceId` in the inbound payload, that needs this lookup.
 *
 * `deviceService.ts` (the existing device-mapping layer this task was told
 * to consume) exposes bulk sync (`synchronizeProviderDevices`) but no
 * single-device lookup by provider id, so this thin, read-only query lives
 * here instead of there (a forbidden file for this task to modify).
 */
export interface ResolvedGpsDevice {
  gpsDeviceId: string;
  status: string;
}

export async function resolveInternalGpsDevice(
  tenantId: string,
  connectionId: string,
  providerDeviceId: string,
): Promise<ResolvedGpsDevice | null> {
  if (!mongoose.isValidObjectId(connectionId) || !providerDeviceId) return null;
  const device = await GpsDevice.findOne({
    tenantId,
    connectionId,
    providerDeviceId,
    isDeleted: false,
  }).select('_id status').lean();
  if (!device) return null;
  return { gpsDeviceId: String(device._id), status: String(device.status) };
}
