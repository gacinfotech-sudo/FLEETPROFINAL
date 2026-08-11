import { nanoid } from 'nanoid';
import { GpsDevice, type IGpsDevice } from '../models/gpsDevice';
import type { GpsProviderDevice } from '../types';

export function publicGpsDevice(device: IGpsDevice | Record<string, any>) {
  const row: any = typeof (device as any).toObject === 'function' ? (device as any).toObject() : device;
  return {
    id: String(row._id || row.id),
    connectionId: String(row.connectionId),
    internalDeviceCode: row.internalDeviceCode,
    providerDeviceId: row.providerDeviceId,
    imei: row.imei,
    simNumber: row.simNumber,
    deviceName: row.deviceName,
    deviceModel: row.deviceModel,
    providerDeviceType: row.providerDeviceType,
    status: row.status,
    lastSeenAt: row.lastSeenAt,
    lastLocationAt: row.lastLocationAt,
    lastLatitude: row.lastLatitude,
    lastLongitude: row.lastLongitude,
    batteryLevel: row.batteryLevel,
    externalPowerConnected: row.externalPowerConnected,
    gpsSignalAvailable: row.gpsSignalAvailable,
    gsmSignalStrength: row.gsmSignalStrength,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeMetadataValue(item, depth + 1));
  if (typeof value !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('$') && !key.includes('.') && !['__proto__', 'constructor', 'prototype'].includes(key))
      .slice(0, 200)
      .map(([key, item]) => [key, safeMetadataValue(item, depth + 1)]),
  );
}

function boundedMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const sanitized = safeMetadataValue(metadata);
  const serialized = JSON.stringify(sanitized);
  return Buffer.byteLength(serialized, 'utf8') <= 32 * 1024 ? sanitized : { omitted: 'provider_metadata_exceeded_32kb' };
}

function validCoordinate(latitude: unknown, longitude: unknown) {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function providerSet(device: GpsProviderDevice, actor: string, preserveAssignedStatus = false) {
  const update: Record<string, unknown> = { updatedBy: actor };
  const strings: Array<[keyof GpsProviderDevice, number]> = [
    ['imei', 100], ['simNumber', 100], ['deviceName', 200], ['deviceModel', 200], ['providerDeviceType', 200],
  ];
  for (const [field, maxLength] of strings) {
    const value = device[field];
    if (typeof value === 'string' && value.trim()) update[field] = value.trim().slice(0, maxLength);
  }
  if (device.status && !preserveAssignedStatus) update.status = device.status;
  if (device.lastSeenAt instanceof Date && !Number.isNaN(device.lastSeenAt.getTime())) update.lastSeenAt = device.lastSeenAt;
  if (device.lastLocationAt instanceof Date && !Number.isNaN(device.lastLocationAt.getTime())) update.lastLocationAt = device.lastLocationAt;
  if (validCoordinate(device.latitude, device.longitude)) {
    update.lastLatitude = device.latitude;
    update.lastLongitude = device.longitude;
  }
  if (typeof device.batteryLevel === 'number' && device.batteryLevel >= 0 && device.batteryLevel <= 100) update.batteryLevel = device.batteryLevel;
  if (typeof device.externalPowerConnected === 'boolean') update.externalPowerConnected = device.externalPowerConnected;
  if (typeof device.gpsSignalAvailable === 'boolean') update.gpsSignalAvailable = device.gpsSignalAvailable;
  if (typeof device.gsmSignalStrength === 'number' && Number.isFinite(device.gsmSignalStrength)) update.gsmSignalStrength = device.gsmSignalStrength;
  const metadata = boundedMetadata(device.metadata);
  if (metadata) update.rawMetadata = metadata;
  return update;
}

export async function synchronizeProviderDevices(input: {
  tenantId: string;
  connectionId: string;
  devices: GpsProviderDevice[];
  actor: string;
}) {
  const unique = new Map<string, GpsProviderDevice>();
  let rejected = 0;
  for (const device of input.devices) {
    const id = typeof device.providerDeviceId === 'string' ? device.providerDeviceId.trim() : '';
    if (!id || id.length > 300) { rejected += 1; continue; }
    if (unique.has(id)) { rejected += 1; continue; }
    unique.set(id, { ...device, providerDeviceId: id });
  }

  let created = 0;
  let updated = 0;
  for (const device of unique.values()) {
    try {
      const existing = await GpsDevice.findOne({
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        providerDeviceId: device.providerDeviceId,
        isDeleted: false,
      });
      if (existing) {
        Object.assign(existing, providerSet(device, input.actor, existing.status === 'assigned'));
        await existing.save();
        updated += 1;
        continue;
      }
      await GpsDevice.create({
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        internalDeviceCode: `GPS-${nanoid(12).toUpperCase()}`,
        providerDeviceId: device.providerDeviceId,
        status: device.status || 'unassigned',
        createdBy: input.actor,
        ...providerSet(device, input.actor),
      });
      created += 1;
    } catch (error: any) {
      if (error?.code === 11000) { rejected += 1; continue; }
      throw error;
    }
  }
  return { received: input.devices.length, created, updated, rejected };
}
