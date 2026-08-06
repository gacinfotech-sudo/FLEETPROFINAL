import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { login } from './helpers';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { synchronizeProviderDevices } from '../../server/gps/services/deviceService';

test('normalized provider device sync is idempotent and rejects duplicate or invalid provider records', async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS device sync verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const marker = String(Date.now());
    const tenantId = new mongoose.Types.ObjectId().toString();
    const connectionId = new mongoose.Types.ObjectId().toString();
    const first = await synchronizeProviderDevices({
      tenantId,
      connectionId,
      actor: 'sync-test',
      devices: [
        {
          providerDeviceId: `provider-sync-${marker}`,
          imei: `sync-imei-${marker}`,
          deviceName: 'Provider Device',
          status: 'online',
          latitude: 22.7196,
          longitude: 75.8577,
          metadata: { safe: 'preserved', $unsafe: 'removed', 'dot.key': 'removed' },
        },
        { providerDeviceId: `provider-sync-${marker}`, deviceName: 'Duplicate event' },
        { providerDeviceId: '', deviceName: 'Invalid event' },
      ],
    });
    expect(first).toEqual({ received: 3, created: 1, updated: 0, rejected: 2 });

    const second = await synchronizeProviderDevices({
      tenantId,
      connectionId,
      actor: 'sync-test',
      devices: [{ providerDeviceId: `provider-sync-${marker}`, deviceName: 'Updated Provider Device', status: 'offline' }],
    });
    expect(second).toEqual({ received: 1, created: 0, updated: 1, rejected: 0 });
    expect(await GpsDevice.countDocuments({ tenantId, connectionId })).toBe(1);
    const stored = await GpsDevice.findOne({ tenantId, connectionId }).select('+rawMetadata').lean();
    expect(stored?.deviceName).toBe('Updated Provider Device');
    expect(stored?.status).toBe('offline');
    expect(stored?.lastLatitude).toBe(22.7196);
    expect(stored?.rawMetadata).toEqual({ safe: 'preserved' });
  } finally {
    await mongoose.disconnect();
  }
});

test('GPS Device Master is tenant-scoped, redacted, duplicate-safe and creates no fake sync data', async ({ page }) => {
  test.setTimeout(60_000);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS Device Master verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await GpsDevice.init();
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const headers = { 'X-CSRF-Token': token };
    const marker = String(Date.now());

    const connectionResponse = await page.request.post('/api/gps/connections', {
      headers,
      data: {
        connectionName: `Device master ${marker}`,
        providerKey: 'official_docs_pending',
        authenticationType: 'bearer_token',
        enabled: true,
      },
    });
    const connection = await connectionResponse.json();
    expect(connectionResponse.status(), JSON.stringify(connection)).toBe(201);
    const storedConnection = await GpsConnection.findById(connection.id);
    expect(storedConnection).toBeTruthy();

    const device = await GpsDevice.create({
      tenantId: storedConnection!.tenantId,
      connectionId: connection.id,
      internalDeviceCode: `GPS-${marker}`,
      providerDeviceId: `provider-${marker}`,
      imei: `imei-${marker}`,
      deviceName: 'Real provider device record',
      status: 'unassigned',
      rawMetadata: { providerInternalSecret: `raw-${marker}` },
      createdBy: 'test',
      updatedBy: 'test',
    });

    const listResponse = await page.request.get(`/api/gps/devices?connectionId=${connection.id}&search=${marker}`);
    const devices = await listResponse.json();
    expect(listResponse.ok(), JSON.stringify(devices)).toBe(true);
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe(device.id);
    expect(JSON.stringify(devices[0])).not.toContain('rawMetadata');
    expect(JSON.stringify(devices[0])).not.toContain(`raw-${marker}`);
    expect(JSON.stringify(devices[0])).not.toContain('tenantId');

    const forbiddenProviderId = await page.request.patch(`/api/gps/devices/${device.id}`, {
      headers,
      data: { providerDeviceId: 'must-not-change' },
    });
    expect(forbiddenProviderId.status()).toBe(400);

    const updateResponse = await page.request.patch(`/api/gps/devices/${device.id}`, {
      headers,
      data: { deviceName: 'Verified device', status: 'faulty' },
    });
    const updated = await updateResponse.json();
    expect(updateResponse.ok(), JSON.stringify(updated)).toBe(true);
    expect(updated.deviceName).toBe('Verified device');
    expect(updated.status).toBe('faulty');
    expect(updated.providerDeviceId).toBe(`provider-${marker}`);

    await expect(GpsDevice.create({
      tenantId: storedConnection!.tenantId,
      connectionId: connection.id,
      internalDeviceCode: `GPS-DUP-PROVIDER-${marker}`,
      providerDeviceId: `provider-${marker}`,
      status: 'unassigned',
      createdBy: 'test',
      updatedBy: 'test',
    })).rejects.toMatchObject({ code: 11000 });
    await expect(GpsDevice.create({
      tenantId: storedConnection!.tenantId,
      connectionId: connection.id,
      internalDeviceCode: `GPS-DUP-IMEI-${marker}`,
      providerDeviceId: `provider-other-${marker}`,
      imei: `imei-${marker}`,
      status: 'unassigned',
      createdBy: 'test',
      updatedBy: 'test',
    })).rejects.toMatchObject({ code: 11000 });

    const beforeSyncCount = await GpsDevice.countDocuments({ tenantId: storedConnection!.tenantId, connectionId: connection.id });
    const syncResponse = await page.request.post(`/api/gps/connections/${connection.id}/sync-devices`, { headers });
    const syncBody = await syncResponse.json();
    expect(syncResponse.status(), JSON.stringify(syncBody)).toBe(409);
    expect(syncBody.status).toBe('configuration_required');
    expect(await GpsDevice.countDocuments({ tenantId: storedConnection!.tenantId, connectionId: connection.id })).toBe(beforeSyncCount);

    const otherTenantDevice = await GpsDevice.create({
      tenantId: new mongoose.Types.ObjectId(),
      connectionId: new mongoose.Types.ObjectId(),
      internalDeviceCode: `GPS-OTHER-${marker}`,
      providerDeviceId: `provider-other-tenant-${marker}`,
      status: 'unassigned',
      createdBy: 'test',
      updatedBy: 'test',
    });
    expect((await page.request.get(`/api/gps/devices/${otherTenantDevice.id}`)).status()).toBe(404);

    const logsText = await (await page.request.get(`/api/gps/connections/${connection.id}/logs`)).text();
    expect(logsText).toContain('gps.device.updated');
    expect(logsText).not.toContain(`raw-${marker}`);

    const removeResponse = await page.request.patch(`/api/gps/devices/${device.id}`, {
      headers,
      data: { status: 'removed' },
    });
    expect(removeResponse.ok()).toBe(true);
    expect((await page.request.get(`/api/gps/devices/${device.id}`)).status()).toBe(404);
  } finally {
    await mongoose.disconnect();
  }
});
