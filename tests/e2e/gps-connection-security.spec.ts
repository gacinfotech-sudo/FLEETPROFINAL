import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { login } from './helpers';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { decryptGpsCredentials, encryptGpsCredentials } from '../../server/gps/security/credentialEncryption';

test('GPS credentials use authenticated encryption bound to tenant and connection', () => {
  const previous = process.env.GPS_CREDENTIAL_ENCRYPTION_KEY;
  process.env.GPS_CREDENTIAL_ENCRYPTION_KEY = '11'.repeat(32);
  try {
    const encrypted = encryptGpsCredentials({ apiToken: 'never-plaintext' }, 'tenant-a', 'connection-a');
    expect(encrypted).not.toContain('never-plaintext');
    expect(decryptGpsCredentials(encrypted, 'tenant-a', 'connection-a')).toEqual({ apiToken: 'never-plaintext' });
    expect(() => decryptGpsCredentials(encrypted, 'tenant-b', 'connection-a')).toThrow();
    expect(() => decryptGpsCredentials(encrypted, 'tenant-a', 'connection-b')).toThrow();
  } finally {
    if (previous === undefined) delete process.env.GPS_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.GPS_CREDENTIAL_ENCRYPTION_KEY = previous;
  }
});

test('GPS connection API encrypts and masks secrets, audits rotation, and remains configuration-required', async ({ page }) => {
  test.setTimeout(60_000);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS connection API verification.');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const headers = { 'X-CSRF-Token': token };
    const marker = String(Date.now());
    const firstSecret = `gps-secret-${marker}`;
    const secondSecret = `gps-rotated-${marker}`;

    const createResponse = await page.request.post('/api/gps/connections', {
      headers,
      data: {
        connectionName: `GPS security ${marker}`,
        providerKey: 'official_docs_pending',
        authenticationType: 'bearer_token',
        apiBaseUrl: 'https://gps-provider.invalid',
        pollingIntervalSeconds: 120,
        enabled: true,
        credentials: { apiToken: firstSecret },
      },
    });
    const created = await createResponse.json();
    expect(createResponse.status(), JSON.stringify(created)).toBe(201);
    expect(created.status).toBe('configuration_required');
    expect(created.credentials.apiToken).toBe('••••••••');
    expect(JSON.stringify(created)).not.toContain(firstSecret);

    const stored = await GpsConnection.findById(created.id).select('+encryptedSecrets');
    expect(stored?.encryptedSecrets).toBeTruthy();
    expect(stored?.encryptedSecrets).not.toContain(firstSecret);
    expect(decryptGpsCredentials(stored!.encryptedSecrets!, String(stored!.tenantId), stored!.id)).toEqual({ apiToken: firstSecret });

    const listBody = await (await page.request.get('/api/gps/connections')).text();
    expect(listBody).not.toContain(firstSecret);
    expect(listBody).not.toContain('encryptedSecrets');
    expect(listBody).not.toContain('tenantId');

    const forbiddenStatus = await page.request.patch(`/api/gps/connections/${created.id}`, {
      headers,
      data: { status: 'connected' },
    });
    expect(forbiddenStatus.status()).toBe(400);

    const rotateResponse = await page.request.post(`/api/gps/connections/${created.id}/rotate-credentials`, {
      headers,
      data: { credentials: { apiToken: secondSecret }, reason: 'Scheduled credential rotation' },
    });
    expect(rotateResponse.ok(), await rotateResponse.text()).toBe(true);
    const rotated = await GpsConnection.findById(created.id).select('+encryptedSecrets');
    expect(rotated?.encryptedSecrets).not.toContain(firstSecret);
    expect(rotated?.encryptedSecrets).not.toContain(secondSecret);
    expect(decryptGpsCredentials(rotated!.encryptedSecrets!, String(rotated!.tenantId), rotated!.id)).toEqual({ apiToken: secondSecret, custom: {} });

    const providerSwitch = await page.request.patch(`/api/gps/connections/${created.id}`, {
      headers,
      data: { providerKey: 'different_provider' },
    });
    expect(providerSwitch.status()).toBe(409);

    const testResponse = await page.request.post(`/api/gps/connections/${created.id}/test`, { headers });
    const testBody = await testResponse.json();
    expect(testResponse.status(), JSON.stringify(testBody)).toBe(409);
    expect(testBody.status).toBe('configuration_required');

    const logsText = await (await page.request.get(`/api/gps/connections/${created.id}/logs`)).text();
    expect(logsText).toContain('gps.credentials.rotated');
    expect(logsText).toContain('gps.connection.test_failed');
    expect(logsText).not.toContain(firstSecret);
    expect(logsText).not.toContain(secondSecret);

    const otherTenantConnection = await GpsConnection.create({
      tenantId: new mongoose.Types.ObjectId(),
      connectionName: `Other tenant ${marker}`,
      providerKey: 'official_docs_pending',
      authenticationType: 'bearer_token',
      enabled: false,
      status: 'disabled',
      createdBy: 'test',
      updatedBy: 'test',
    });
    expect((await page.request.get(`/api/gps/connections/${otherTenantConnection.id}`)).status()).toBe(404);
  } finally {
    await mongoose.disconnect();
  }
});
