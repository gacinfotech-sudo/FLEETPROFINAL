import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { login } from './helpers';
import { Vehicle } from '../../server/models/index';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { VehicleGpsAssignment } from '../../server/gps/models/vehicleGpsAssignment';
import { findVehicleGpsAssignmentAt } from '../../server/gps/services/assignmentService';
import { synchronizeProviderDevices } from '../../server/gps/services/deviceService';

test('vehicle GPS assignment enforces one-to-one active mapping and preserves effective-date history', async ({ page }) => {
  test.setTimeout(60_000);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS assignment verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await VehicleGpsAssignment.init();
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const headers = { 'X-CSRF-Token': token };
    const marker = String(Date.now());
    const vehicles = await (await page.request.get('/api/vehicles')).json();
    expect(vehicles.length).toBeGreaterThanOrEqual(2);
    const [vehicleOne, vehicleTwo] = vehicles;

    // Idempotent across repeated runs against a persistent dev DB — the
    // overlap check considers ended history too (by design, preserving
    // "who had this vehicle when" forever), so a prior run's own records
    // for these same two real tenant vehicles would otherwise permanently
    // block this run's relative "yesterday to now" date window.
    await VehicleGpsAssignment.deleteMany({ vehicleId: { $in: [vehicleOne._id, vehicleTwo._id] } });

    const connectionResponse = await page.request.post('/api/gps/connections', {
      headers,
      data: {
        connectionName: `Assignment ${marker}`,
        providerKey: 'official_docs_pending',
        authenticationType: 'bearer_token',
        enabled: false,
      },
    });
    const connection = await connectionResponse.json();
    expect(connectionResponse.status(), JSON.stringify(connection)).toBe(201);
    const storedConnection = await GpsConnection.findById(connection.id);
    expect(storedConnection).toBeTruthy();

    const [deviceOne, deviceTwo, faultyDevice] = await GpsDevice.create([
      {
        tenantId: storedConnection!.tenantId,
        connectionId: connection.id,
        internalDeviceCode: `GPS-ASSIGN-A-${marker}`,
        providerDeviceId: `assign-a-${marker}`,
        status: 'unassigned',
        createdBy: 'test', updatedBy: 'test',
      },
      {
        tenantId: storedConnection!.tenantId,
        connectionId: connection.id,
        internalDeviceCode: `GPS-ASSIGN-B-${marker}`,
        providerDeviceId: `assign-b-${marker}`,
        status: 'unassigned',
        createdBy: 'test', updatedBy: 'test',
      },
      {
        tenantId: storedConnection!.tenantId,
        connectionId: connection.id,
        internalDeviceCode: `GPS-FAULTY-${marker}`,
        providerDeviceId: `assign-faulty-${marker}`,
        status: 'faulty',
        createdBy: 'test', updatedBy: 'test',
      },
    ]);

    const firstStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const firstResponse = await page.request.post(`/api/vehicles/${vehicleOne._id}/gps-assignment`, {
      headers,
      data: { gpsDeviceId: deviceOne.id, assignedFrom: firstStart.toISOString(), reason: 'Initial installation' },
    });
    const first = await firstResponse.json();
    expect(firstResponse.status(), JSON.stringify(first)).toBe(201);
    expect(first.alreadyAssigned).toBe(false);
    expect(first.assignment.vehicleId).toBe(vehicleOne._id);
    expect(first.assignment.gpsDeviceId).toBe(deviceOne.id);
    expect(first.assignment.device.providerDeviceId).toBe(`assign-a-${marker}`);
    expect(first.assignment.vehicle.licensePlate).toBe(vehicleOne.licensePlate);

    const retry = await page.request.post(`/api/vehicles/${vehicleOne._id}/gps-assignment`, {
      headers,
      data: { gpsDeviceId: deviceOne.id, reason: 'Retry same request' },
    });
    const retryBody = await retry.json();
    expect(retry.ok(), JSON.stringify(retryBody)).toBe(true);
    expect(retryBody.alreadyAssigned).toBe(true);
    expect(await VehicleGpsAssignment.countDocuments({ tenantId: storedConnection!.tenantId, vehicleId: vehicleOne._id, status: 'active' })).toBe(1);

    const sameDeviceOtherVehicle = await page.request.post(`/api/vehicles/${vehicleTwo._id}/gps-assignment`, {
      headers,
      data: { gpsDeviceId: deviceOne.id, reason: 'Must conflict' },
    });
    expect(sameDeviceOtherVehicle.status()).toBe(409);

    const faultyResponse = await page.request.post(`/api/vehicles/${vehicleTwo._id}/gps-assignment`, {
      headers,
      data: { gpsDeviceId: faultyDevice.id, reason: 'Must reject faulty device' },
    });
    expect(faultyResponse.status()).toBe(409);

    await synchronizeProviderDevices({
      tenantId: storedConnection!.tenantId.toString(),
      connectionId: connection.id,
      actor: 'provider-sync-test',
      devices: [{ providerDeviceId: `assign-a-${marker}`, status: 'online' }],
    });
    expect((await GpsDevice.findById(deviceOne.id))?.status).toBe('assigned');

    const replacementStart = new Date();
    const replacementResponse = await page.request.post(`/api/vehicles/${vehicleOne._id}/gps-assignment`, {
      headers,
      data: { gpsDeviceId: deviceTwo.id, assignedFrom: replacementStart.toISOString(), reason: 'Scheduled device replacement' },
    });
    const replacement = await replacementResponse.json();
    expect(replacementResponse.status(), JSON.stringify(replacement)).toBe(201);
    expect(replacement.replacedAssignmentId).toBe(first.assignment.id);
    expect(replacement.assignment.gpsDeviceId).toBe(deviceTwo.id);

    const historyResponse = await page.request.get(`/api/vehicles/${vehicleOne._id}/gps-assignment-history`);
    const history = await historyResponse.json();
    expect(historyResponse.ok(), JSON.stringify(history)).toBe(true);
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('active');
    expect(history[0].gpsDeviceId).toBe(deviceTwo.id);
    expect(history[1].status).toBe('ended');
    expect(history[1].gpsDeviceId).toBe(deviceOne.id);
    expect(history[1].endReason).toBe('Scheduled device replacement');
    expect(JSON.stringify(history)).not.toContain('tenantId');

    const firstEndedAt = new Date(history[1].assignedUntil);
    const duringFirst = new Date((firstStart.getTime() + firstEndedAt.getTime()) / 2);
    const effectiveAssignment = await findVehicleGpsAssignmentAt(storedConnection!.tenantId.toString(), vehicleOne._id, duringFirst);
    expect(effectiveAssignment?.gpsDeviceId.toString()).toBe(deviceOne.id);

    await expect(VehicleGpsAssignment.create({
      tenantId: storedConnection!.tenantId,
      vehicleId: vehicleTwo._id,
      gpsDeviceId: deviceTwo.id,
      connectionId: connection.id,
      assignedFrom: new Date(),
      status: 'active',
      assignedBy: 'duplicate-test',
    })).rejects.toMatchObject({ code: 11000 });

    const otherTenantVehicle = await Vehicle.create({
      tenantId: new mongoose.Types.ObjectId(),
      make: 'Cross Tenant Vehicle', type: 'sedan', status: 'available', features: [],
      pricePerDay: 0, pricePerHour: 0, pricePerKm: 0,
    });
    expect((await page.request.get(`/api/vehicles/${otherTenantVehicle.id}/gps-assignment`)).status()).toBe(404);

    const unassignResponse = await page.request.delete(`/api/vehicles/${vehicleOne._id}/gps-assignment`, {
      headers,
      data: { reason: 'Device removed at workshop' },
    });
    const unassigned = await unassignResponse.json();
    expect(unassignResponse.ok(), JSON.stringify(unassigned)).toBe(true);
    expect(unassigned.assignment.status).toBe('ended');
    expect(unassigned.assignment.endReason).toBe('Device removed at workshop');
    expect((await (await page.request.get(`/api/vehicles/${vehicleOne._id}/gps-assignment`)).json()).assignment).toBeNull();
    expect(await VehicleGpsAssignment.countDocuments({ tenantId: storedConnection!.tenantId, vehicleId: vehicleOne._id })).toBe(2);
    expect((await GpsDevice.findById(deviceOne.id))?.status).toBe('unassigned');
    expect((await GpsDevice.findById(deviceTwo.id))?.status).toBe('unassigned');

    const retryUnassign = await page.request.delete(`/api/vehicles/${vehicleOne._id}/gps-assignment`, {
      headers,
      data: { reason: 'Retry removal' },
    });
    expect((await retryUnassign.json()).alreadyUnassigned).toBe(true);

    const logsText = await (await page.request.get(`/api/gps/connections/${connection.id}/logs`)).text();
    expect(logsText).toContain('gps.device.assigned');
    expect(logsText).toContain('gps.assignment.changed');
    expect(logsText).toContain('gps.device.unassigned');
  } finally {
    await mongoose.disconnect();
  }
});
