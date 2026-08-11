import mongoose from 'mongoose';
import { Vehicle } from '../../models/index';
import { GpsDevice } from '../models/gpsDevice';
import { VehicleGpsAssignment, type IVehicleGpsAssignment } from '../models/vehicleGpsAssignment';
import { publicGpsDevice } from './deviceService';

export class GpsAssignmentNotFoundError extends Error {
  constructor(message = 'Vehicle or GPS device not found.') {
    super(message);
    this.name = 'GpsAssignmentNotFoundError';
  }
}

export class GpsAssignmentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpsAssignmentConflictError';
  }
}

export function publicVehicleGpsAssignment(assignment: IVehicleGpsAssignment | Record<string, any>) {
  const row: any = typeof (assignment as any).toObject === 'function'
    ? (assignment as any).toObject()
    : assignment;
  const vehicle = row.vehicleId && typeof row.vehicleId === 'object' && row.vehicleId._id ? row.vehicleId : null;
  const device = row.gpsDeviceId && typeof row.gpsDeviceId === 'object' && row.gpsDeviceId._id ? row.gpsDeviceId : null;
  const connection = row.connectionId && typeof row.connectionId === 'object' && row.connectionId._id ? row.connectionId : null;
  return {
    id: String(row._id || row.id),
    vehicleId: String(vehicle?._id || row.vehicleId),
    gpsDeviceId: String(device?._id || row.gpsDeviceId),
    connectionId: String(connection?._id || row.connectionId),
    vehicle: vehicle ? {
      id: String(vehicle._id),
      make: vehicle.make,
      vehicleModel: vehicle.vehicleModel,
      licensePlate: vehicle.licensePlate,
      operationalStatus: vehicle.status,
    } : undefined,
    device: device ? publicGpsDevice(device) : undefined,
    connection: connection ? {
      id: String(connection._id),
      connectionName: connection.connectionName,
      providerKey: connection.providerKey,
      status: connection.status,
    } : undefined,
    assignedFrom: row.assignedFrom,
    assignedUntil: row.assignedUntil,
    status: row.status,
    assignedBy: row.assignedBy,
    endedBy: row.endedBy,
    endReason: row.endReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function populateGpsAssignment<T>(query: T): T {
  return (query as any)
    .populate('vehicleId', 'make vehicleModel licensePlate status')
    .populate('gpsDeviceId', 'connectionId internalDeviceCode providerDeviceId imei simNumber deviceName deviceModel providerDeviceType status lastSeenAt lastLocationAt lastLatitude lastLongitude batteryLevel externalPowerConnected gpsSignalAvailable gsmSignalStrength createdAt updatedAt')
    .populate('connectionId', 'connectionName providerKey status') as T;
}

function overlappingIntervalQuery(tenantId: string, field: 'vehicleId' | 'gpsDeviceId', value: string, start: Date, excludeId?: string) {
  const query: Record<string, unknown> = {
    tenantId,
    [field]: value,
    $or: [{ assignedUntil: { $exists: false } }, { assignedUntil: null }, { assignedUntil: { $gt: start } }],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return query;
}

export async function assignGpsDevice(input: {
  tenantId: string;
  vehicleId: string;
  gpsDeviceId: string;
  assignedFrom?: Date;
  actor: string;
  reason?: string;
}) {
  if (!mongoose.isValidObjectId(input.vehicleId) || !mongoose.isValidObjectId(input.gpsDeviceId)) {
    throw new GpsAssignmentNotFoundError();
  }
  const [vehicle, device] = await Promise.all([
    Vehicle.findOne({ _id: input.vehicleId, tenantId: input.tenantId }),
    GpsDevice.findOne({ _id: input.gpsDeviceId, tenantId: input.tenantId, isDeleted: false }),
  ]);
  if (!vehicle || !device) throw new GpsAssignmentNotFoundError();
  if (['inactive', 'faulty', 'removed'].includes(device.status)) {
    throw new GpsAssignmentConflictError(`A ${device.status} GPS device cannot be assigned.`);
  }

  const assignedFrom = input.assignedFrom || new Date();
  if (Number.isNaN(assignedFrom.getTime()) || assignedFrom.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new GpsAssignmentConflictError('Assignment start must be a valid current or past time.');
  }
  const [activeForVehicle, activeForDevice] = await Promise.all([
    VehicleGpsAssignment.findOne({ tenantId: input.tenantId, vehicleId: input.vehicleId, status: 'active' }),
    VehicleGpsAssignment.findOne({ tenantId: input.tenantId, gpsDeviceId: input.gpsDeviceId, status: 'active' }),
  ]);
  if (activeForVehicle && activeForVehicle.gpsDeviceId.toString() === input.gpsDeviceId) {
    if (device.status !== 'assigned') {
      device.status = 'assigned';
      device.updatedBy = input.actor;
      await device.save();
    }
    return { assignment: activeForVehicle, alreadyAssigned: true, replacedAssignmentId: undefined, replacedAssignment: undefined };
  }
  if (activeForDevice && activeForDevice.vehicleId.toString() !== input.vehicleId) {
    throw new GpsAssignmentConflictError('This GPS device is already assigned to another vehicle.');
  }
  if (activeForVehicle && assignedFrom < activeForVehicle.assignedFrom) {
    throw new GpsAssignmentConflictError('A replacement cannot start before the current assignment.');
  }

  const [vehicleOverlap, deviceOverlap] = await Promise.all([
    VehicleGpsAssignment.exists(overlappingIntervalQuery(input.tenantId, 'vehicleId', input.vehicleId, assignedFrom, activeForVehicle?.id)),
    VehicleGpsAssignment.exists(overlappingIntervalQuery(input.tenantId, 'gpsDeviceId', input.gpsDeviceId, assignedFrom, activeForDevice?.id)),
  ]);
  if (vehicleOverlap) throw new GpsAssignmentConflictError('This vehicle has overlapping GPS assignment history.');
  if (deviceOverlap) throw new GpsAssignmentConflictError('This GPS device has overlapping assignment history.');

  const replacedAssignment = activeForVehicle?.toObject();
  if (activeForVehicle) {
    activeForVehicle.status = 'ended';
    activeForVehicle.assignedUntil = assignedFrom;
    activeForVehicle.endedBy = input.actor;
    activeForVehicle.endReason = input.reason || 'GPS device changed';
    await activeForVehicle.save();
  }

  let assignment: IVehicleGpsAssignment;
  try {
    assignment = await VehicleGpsAssignment.create({
      tenantId: input.tenantId,
      vehicleId: input.vehicleId,
      gpsDeviceId: input.gpsDeviceId,
      connectionId: device.connectionId,
      assignedFrom,
      status: 'active',
      assignedBy: input.actor,
    });
  } catch (error: any) {
    if (activeForVehicle) {
      await GpsDevice.updateOne(
        { _id: activeForVehicle.gpsDeviceId, tenantId: input.tenantId },
        { $set: { status: 'assigned', updatedBy: input.actor } },
      );
      activeForVehicle.status = 'active';
      activeForVehicle.assignedUntil = undefined;
      activeForVehicle.endedBy = undefined;
      activeForVehicle.endReason = undefined;
      await activeForVehicle.save();
    }
    if (error?.code === 11000) throw new GpsAssignmentConflictError('Vehicle or GPS device already has an active assignment.');
    throw error;
  }

  try {
    if (activeForVehicle) {
      await GpsDevice.updateOne(
        { _id: activeForVehicle.gpsDeviceId, tenantId: input.tenantId, status: 'assigned' },
        { $set: { status: 'unassigned', updatedBy: input.actor } },
      );
    }
    device.status = 'assigned';
    device.updatedBy = input.actor;
    await device.save();
  } catch (error) {
    await VehicleGpsAssignment.deleteOne({ _id: assignment._id });
    if (activeForVehicle) {
      await GpsDevice.updateOne(
        { _id: activeForVehicle.gpsDeviceId, tenantId: input.tenantId },
        { $set: { status: 'assigned', updatedBy: input.actor } },
      );
      activeForVehicle.status = 'active';
      activeForVehicle.assignedUntil = undefined;
      activeForVehicle.endedBy = undefined;
      activeForVehicle.endReason = undefined;
      await activeForVehicle.save();
    }
    throw error;
  }

  return { assignment, alreadyAssigned: false, replacedAssignmentId: activeForVehicle?.id, replacedAssignment };
}

export async function unassignGpsDevice(input: {
  tenantId: string;
  vehicleId: string;
  actor: string;
  reason: string;
}) {
  if (!mongoose.isValidObjectId(input.vehicleId)) throw new GpsAssignmentNotFoundError('Vehicle not found.');
  const vehicle = await Vehicle.exists({ _id: input.vehicleId, tenantId: input.tenantId });
  if (!vehicle) throw new GpsAssignmentNotFoundError('Vehicle not found.');
  const assignment = await VehicleGpsAssignment.findOne({ tenantId: input.tenantId, vehicleId: input.vehicleId, status: 'active' });
  if (!assignment) return { assignment: null, alreadyUnassigned: true };
  const previousAssignment = assignment.toObject();
  assignment.status = 'ended';
  assignment.assignedUntil = new Date();
  assignment.endedBy = input.actor;
  assignment.endReason = input.reason;
  await assignment.save();
  await GpsDevice.updateOne(
    { _id: assignment.gpsDeviceId, tenantId: input.tenantId, status: 'assigned' },
    { $set: { status: 'unassigned', updatedBy: input.actor } },
  );
  return { assignment, alreadyUnassigned: false, previousAssignment };
}

export async function findVehicleGpsAssignmentAt(tenantId: string, vehicleId: string, at: Date) {
  return VehicleGpsAssignment.findOne({
    tenantId,
    vehicleId,
    assignedFrom: { $lte: at },
    $or: [{ assignedUntil: { $exists: false } }, { assignedUntil: null }, { assignedUntil: { $gt: at } }],
  }).sort({ assignedFrom: -1 });
}
