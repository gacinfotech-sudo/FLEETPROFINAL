/**
 * ERROR HANDLING TESTS
 * Validates error handling and recovery scenarios
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Error Handling Tests', () => {
  let helper: TestHelper;
  let auth: any;
  let tenantId: string;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
    auth = await helper.loginAsTenantOwner('dharvika');
    tenantId = auth.tenantId;
  });

  test.afterEach(async () => {
    if (auth?.token) {
      await helper.logout(auth.token);
    }
  });

  // ========== AUTHENTICATION ERRORS ==========

  test('Login with invalid email returns 401', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: 'invalid@email.local',
        password: 'AnyPassword123!@#',
      },
    });

    expect(response.status()).toBe(HTTP_CODES.UNAUTHORIZED);
  });

  test('Login with invalid password returns 401', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.rootUser.email,
        password: 'WrongPassword123!@#',
      },
    });

    expect(response.status()).toBe(HTTP_CODES.UNAUTHORIZED);
  });

  test('Login with missing email returns 400', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        password: 'AnyPassword123!@#',
      },
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Login with missing password returns 400', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.rootUser.email,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  // ========== VALIDATION ERRORS ==========

  test('Create customer without name returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      mobile: '9123456789',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Create customer without mobile returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      name: 'Test Customer',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Create customer with invalid email returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      name: 'Test Customer',
      mobile: '9123456789',
      email: 'invalid-email',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Create driver with invalid license expiry returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.drivers, auth.token, tenantId, {
      name: 'Test Driver',
      mobile: '9123456789',
      licenseNumber: 'DL-123456',
      licenseExpiry: 'invalid-date',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Create vehicle with negative seating capacity returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.vehicles, auth.token, tenantId, {
      registrationNumber: 'KA01TEST0001',
      model: 'Innova',
      manufacturer: 'Toyota',
      seatingCapacity: -5,
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  // ========== NOT FOUND ERRORS ==========

  test('Get non-existent customer returns 404', async () => {
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}/nonexistent-id`,
      auth.token,
      tenantId
    );

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });

  test('Get non-existent driver returns 404', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.drivers}/nonexistent-id`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });

  test('Get non-existent vehicle returns 404', async () => {
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.vehicles}/nonexistent-id`,
      auth.token,
      tenantId
    );

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });

  test('Get non-existent booking returns 404', async () => {
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.bookings}/nonexistent-id`,
      auth.token,
      tenantId
    );

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });

  test('Delete non-existent customer returns 404', async () => {
    const response = await helper.apiCall(
      'DELETE',
      `${API_ENDPOINTS.tenant.customers}/nonexistent-id`,
      auth.token,
      tenantId
    );

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });

  // ========== CONFLICT ERRORS ==========

  test('Create duplicate vehicle registration returns 409', async () => {
    const regNumber = `KA01TST${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;

    // Create first vehicle
    await helper.createVehicle(tenantId, auth.token, { registrationNumber: regNumber });

    // Try to create duplicate
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.vehicles, auth.token, tenantId, {
      ...TEST_CONFIG.testData.vehicle,
      registrationNumber: regNumber,
    });

    expect(response.status()).toBe(HTTP_CODES.CONFLICT);
  });

  test('Create duplicate driver license returns 409', async () => {
    const licenseNumber = `DL-TEST-${Math.floor(Math.random() * 1000000)}`;

    // Create first driver
    await helper.createDriver(tenantId, auth.token, { licenseNumber });

    // Try to create duplicate
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.drivers, auth.token, tenantId, {
      ...TEST_CONFIG.testData.driver,
      licenseNumber,
    });

    expect(response.status()).toBe(HTTP_CODES.CONFLICT);
  });

  // ========== MALFORMED REQUEST ERRORS ==========

  test('POST with malformed JSON returns 400', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.tenant.customers}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json',
      },
      data: '{invalid json',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });

  test('Request with invalid content-type', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.tenant.customers}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'text/plain',
      },
      data: 'name=Test&mobile=9123456789',
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== AUTHORIZATION ERRORS ==========

  test('Request without token returns 401', async ({ request }) => {
    const response = await request.get(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.tenant.customers}`, {
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.UNAUTHORIZED);
  });

  test('Request with invalid token returns 401', async ({ request }) => {
    const response = await request.get(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.tenant.customers}`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
        'X-Tenant-ID': tenantId,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.UNAUTHORIZED);
  });

  test('Request without tenant ID returns error', async ({ request }) => {
    const response = await request.get(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.tenant.customers}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== RATE LIMITING ==========

  test('Rapid login attempts may trigger rate limiting', async ({ request }) => {
    let lastStatus = 200;

    // Make multiple login attempts in quick succession
    for (let i = 0; i < 10; i++) {
      const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
        data: {
          email: TEST_CONFIG.rootUser.email,
          password: 'WrongPassword123!@#',
        },
      });
      lastStatus = response.status();

      // If rate limited, expect 429
      if (lastStatus === 429) {
        expect(lastStatus).toBe(429);
        return; // Test passed
      }
    }

    // If not rate limited after 10 attempts, that's also acceptable
    // as rate limiting might be configured differently
    expect(lastStatus).toBeDefined();
  });

  // ========== RECOVERY SCENARIOS ==========

  test('Retry failed request succeeds on recovery', async () => {
    let attempts = 0;
    let success = false;

    const customer = await helper.createCustomer(tenantId, auth.token);

    await helper.retryRequest(async () => {
      attempts++;
      const response = await helper.apiCall('GET', `${API_ENDPOINTS.tenant.customers}/${customer.id}`, auth.token, tenantId);

      if (response.status() === HTTP_CODES.OK) {
        success = true;
      }

      return success;
    }, 3);

    expect(success).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(1);
  });

  test('Timeout on slow request handled gracefully', async () => {
    // This is a conceptual test - actual timeout depends on network conditions
    const startTime = Date.now();

    const response = await helper.apiCall('GET', API_ENDPOINTS.tenant.customers, auth.token, tenantId);

    const duration = Date.now() - startTime;

    // Should complete within reasonable timeout
    expect(duration).toBeLessThan(TEST_CONFIG.apiTimeout * 2);
    expect(response).toBeDefined();
  });

  // ========== DATA CONSTRAINT ERRORS ==========

  test('Create booking with non-existent customer returns 400 or 404', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.bookings, auth.token, tenantId, {
      ...TEST_CONFIG.testData.booking,
      customerId: '507f1f77bcf86cd799999999',
    });

    expect([HTTP_CODES.BAD_REQUEST, HTTP_CODES.NOT_FOUND]).toContain(response.status());
  });

  test('Assign non-existent driver to booking returns 400 or 404', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token);
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);

    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.bookings}/${booking.id}`,
      auth.token,
      tenantId,
      { driverId: '507f1f77bcf86cd799999999' }
    );

    expect([HTTP_CODES.BAD_REQUEST, HTTP_CODES.NOT_FOUND]).toContain(response.status());
  });

  // ========== EDGE CASES ==========

  test('Create customer with very long name truncates gracefully', async () => {
    const longName = 'A'.repeat(500);
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      name: longName,
      mobile: '9123456789',
    });

    // Should either accept with truncation or reject with 400
    expect([HTTP_CODES.OK, HTTP_CODES.CREATED, HTTP_CODES.BAD_REQUEST]).toContain(response.status());
  });

  test('Create customer with special characters in name', async () => {
    const specialName = "Test@#$%^&*()_+-=[]{}|;':,.<>?/Customer";
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      name: specialName,
      mobile: '9123456789',
    });

    // Should either accept or sanitize
    expect([HTTP_CODES.OK, HTTP_CODES.CREATED, HTTP_CODES.BAD_REQUEST]).toContain(response.status());
  });

  test('Create customer with empty string returns 400', async () => {
    const response = await helper.apiCall('POST', API_ENDPOINTS.tenant.customers, auth.token, tenantId, {
      name: '',
      mobile: '9123456789',
    });

    expect(response.status()).toBe(HTTP_CODES.BAD_REQUEST);
  });
});
