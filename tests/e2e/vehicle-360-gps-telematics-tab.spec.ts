import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { login } from './helpers';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { VehicleGpsAssignment } from '../../server/gps/models/vehicleGpsAssignment';
import { storeTelemetryPoint } from '../../server/gps/telemetry/store';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import { GpsVehicleLatestState } from '../../server/gps/telemetry/models/vehicleLatestState';

// Final Vehicle 360 Integrator — Open follow-up #3: the GPS & Telematics tab
// was built against a documented (not yet merged) GpsVehicleLatestState
// contract and showed an honest "not yet available" placeholder. GPS
// telemetry has since merged into trunk with a real read model, but no HTTP
// read route existed for it (only webhook ingestion + billing routes were
// mounted). This verifies the new GET /api/vehicles/:vehicleId/gps/latest-state
// route (server/gps/routes/vehicleState.ts) end-to-end against a real
// assignment + a real stored telemetry point — no fabricated data, the tab
// renders exactly what was stored.

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  return process.env.MONGODB_URI;
}

test.describe('Vehicle 360 — GPS & Telematics tab', () => {
  test.setTimeout(60_000);

  test('shows the real latest telemetry state for the vehicle\'s assigned GPS device', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const createRes = await page.request.post('/api/vehicles', {
      headers: { 'X-CSRF-Token': token },
      data: { make: `GpsTabQA-${Date.now()}`, model: 'X', vehicleCategory: 'Car', licensePlate: `GPT${Date.now()}` },
    });
    const vehicle = await createRes.json();
    const vehicleId: string = vehicle._id || vehicle.id;
    const tenantId: string = vehicle.tenantId;

    await mongoose.connect(requireMongoUri());
    try {
      const connection = await GpsConnection.create({
        tenantId,
        connectionName: 'GPS Tab QA connection',
        providerKey: 'gps-tab-qa-provider',
        authenticationType: 'api_key',
        pollingIntervalSeconds: 30,
        enabled: true,
        status: 'connected',
        createdBy: 'gps-tab-qa',
        updatedBy: 'gps-tab-qa',
      });
      const device = await GpsDevice.create({
        tenantId,
        connectionId: connection.id,
        internalDeviceCode: `GPS-TAB-QA-${Date.now()}`,
        providerDeviceId: `provider-tab-qa-${Date.now()}`,
        status: 'unassigned',
        createdBy: 'gps-tab-qa',
        updatedBy: 'gps-tab-qa',
      });

      const assignRes = await page.request.post(`/api/vehicles/${vehicleId}/gps-assignment`, {
        headers: { 'X-CSRF-Token': token },
        data: { gpsDeviceId: device.id, reason: 'GPS tab QA end-to-end verification' },
      });
      expect(assignRes.ok()).toBeTruthy();

      const recordedAt = new Date();
      const stored = await storeTelemetryPoint({
        tenantId,
        connectionId: connection.id,
        gpsDeviceId: device.id,
        providerDeviceId: device.providerDeviceId,
        recordedAt,
        receivedAt: recordedAt,
        latitude: 12.9716,
        longitude: 77.5946,
        speedKph: 42,
        motion: true,
        source: 'webhook',
      });
      expect(stored.stored).toBe(true);

      // Real HTTP read: the new route this follow-up adds.
      const stateRes = await page.request.get(`/api/vehicles/${vehicleId}/gps/latest-state`);
      expect(stateRes.ok()).toBeTruthy();
      const stateBody = await stateRes.json();
      expect(Array.isArray(stateBody)).toBe(true);
      expect(stateBody).toHaveLength(1);
      expect(stateBody[0].latitude).toBe(12.9716);
      expect(stateBody[0].longitude).toBe(77.5946);
      expect(stateBody[0].movingStatus).toBe('moving');

      // Real UI: the tab must render this, not the "not yet available" placeholder.
      await page.goto(`/vehicles/${vehicleId}`);
      await expect(page.getByText('Vehicle 360')).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: /GPS/i }).click();
      await expect(page.getByText(/not yet available|has not merged/i)).toHaveCount(0);
      await expect(page.getByText('moving', { exact: false })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('12.9716', { exact: false })).toBeVisible();
    } finally {
      await GpsTelemetryPoint.deleteMany({ tenantId });
      await GpsVehicleLatestState.deleteMany({ tenantId });
      await VehicleGpsAssignment.deleteMany({ tenantId });
      await GpsDevice.deleteMany({ tenantId });
      await GpsConnection.deleteMany({ tenantId });
      await mongoose.disconnect();
      await page.request.delete(`/api/vehicles/${vehicleId}`, { headers: { 'X-CSRF-Token': token } }).catch(() => {});
    }
  });
});
