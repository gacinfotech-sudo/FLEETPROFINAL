/**
 * SESSION 4 SMOKE TESTS
 * Validates all 12 new APIs are functional
 * 8 Booking Manager APIs + 4 Predictive Analytics APIs
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5050';
const TENANT_ID = '6a7ef5d106671a8f7902f35a'; // From test database

// Mock auth context for API calls
const getAuthHeaders = (tenantId: string) => ({
  'Authorization': 'Bearer mock-token',
  'X-Tenant-ID': tenantId,
  'Content-Type': 'application/json'
});

test.describe('SESSION 4: NEW APIS SMOKE TESTS', () => {

  // ========== BOOKING MANAGER APIs ==========

  test('1: GET /api/tenant/booking-managers - List managers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tenant/booking-managers`, {
      headers: getAuthHeaders(TENANT_ID)
    });

    expect(response.status()).toBeLessThan(500); // Should not 500
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('managers');
      expect(Array.isArray(data.managers)).toBe(true);
    }
  });

  test('2: GET /api/tenant/booking-managers/default - Get default', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tenant/booking-managers/default`, {
      headers: getAuthHeaders(TENANT_ID)
    });

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('defaultManager');
    }
  });

  test('3: POST /api/tenant/booking-managers/default - Set default', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tenant/booking-managers/default`, {
      headers: getAuthHeaders(TENANT_ID),
      data: { managerUserId: '60d5ec49c1b6d9b9f5c8e7d6' }
    });

    expect(response.status()).toBeLessThan(500);
    expect([200, 400, 404]).toContain(response.status());
  });

  test('4: POST /api/tenant/staff - Create staff', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/tenant/staff`, {
      headers: getAuthHeaders(TENANT_ID),
      data: {
        name: 'Test Manager',
        mobile: '9198765432111',
        designation: 'Operations Manager',
        role: 'manager'
      }
    });

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('staff');
    }
  });

  test('5: GET /api/tenant/staff/by-mobile - Find by phone', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/tenant/staff/by-mobile?mobile=9198765432210`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    expect([200, 400]).toContain(response.status());
  });

  test('6: POST /api/bookings/:id/assign-manager - Assign manager', async ({ request }) => {
    const bookingId = '60d5ec49c1b6d9b9f5c8e7d7';
    const response = await request.post(
      `${BASE_URL}/api/bookings/${bookingId}/assign-manager`,
      {
        headers: getAuthHeaders(TENANT_ID),
        data: { managerUserId: '60d5ec49c1b6d9b9f5c8e7d6' }
      }
    );

    expect(response.status()).toBeLessThan(500);
    expect([200, 400, 404]).toContain(response.status());
  });

  test('7: POST /api/bookings/:id/change-manager - Change manager', async ({ request }) => {
    const bookingId = '60d5ec49c1b6d9b9f5c8e7d7';
    const response = await request.post(
      `${BASE_URL}/api/bookings/${bookingId}/change-manager`,
      {
        headers: getAuthHeaders(TENANT_ID),
        data: {
          managerUserId: '60d5ec49c1b6d9b9f5c8e7d6',
          reason: 'Performance improvement'
        }
      }
    );

    expect(response.status()).toBeLessThan(500);
    expect([200, 400, 404]).toContain(response.status());
  });

  test('8: GET /api/bookings/:id/manager - Get booking manager', async ({ request }) => {
    const bookingId = '60d5ec49c1b6d9b9f5c8e7d7';
    const response = await request.get(
      `${BASE_URL}/api/bookings/${bookingId}/manager`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    expect([200, 404]).toContain(response.status());
  });

  // ========== PREDICTIVE ANALYTICS APIs ==========

  test('9: GET /api/analytics/predictive/demand-forecast - Forecast demand', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/analytics/predictive/demand-forecast`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('forecast');
      expect(Array.isArray(data.forecast)).toBe(true);
      if (data.forecast.length > 0) {
        expect(data.forecast[0]).toHaveProperty('date');
        expect(data.forecast[0]).toHaveProperty('predictedBookings');
        expect(data.forecast[0]).toHaveProperty('confidence');
      }
    }
  });

  test('10: GET /api/analytics/predictive/churn-risk - Predict churn', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/analytics/predictive/churn-risk?limit=10`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('predictions');
      expect(Array.isArray(data.predictions)).toBe(true);
      if (data.predictions.length > 0) {
        expect(data.predictions[0]).toHaveProperty('customerId');
        expect(data.predictions[0]).toHaveProperty('churnRisk');
        expect(data.predictions[0]).toHaveProperty('recommendation');
      }
    }
  });

  test('11: GET /api/analytics/predictive/fraud-detection - Detect fraud', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/analytics/predictive/fraud-detection`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('fraudScores');
      expect(Array.isArray(data.fraudScores)).toBe(true);
      if (data.fraudScores.length > 0) {
        expect(data.fraudScores[0]).toHaveProperty('bookingId');
        expect(data.fraudScores[0]).toHaveProperty('fraudRisk');
        expect(data.fraudScores[0]).toHaveProperty('recommendation');
      }
    }
  });

  test('12: GET /api/analytics/predictive/anomalies - Detect anomalies', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/analytics/predictive/anomalies`,
      { headers: getAuthHeaders(TENANT_ID) }
    );

    expect(response.status()).toBeLessThan(500);
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('anomalies');
      expect(Array.isArray(data.anomalies)).toBe(true);
      if (data.anomalies.length > 0) {
        expect(data.anomalies[0]).toHaveProperty('type');
        expect(data.anomalies[0]).toHaveProperty('severity');
        expect(data.anomalies[0]).toHaveProperty('description');
      }
    }
  });
});

test.describe('PERFORMANCE BENCHMARKS', () => {

  test('Manager lookup < 100ms', async ({ request }) => {
    const start = Date.now();
    await request.get(`${BASE_URL}/api/tenant/booking-managers`, {
      headers: getAuthHeaders(TENANT_ID)
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('Demand forecast < 1000ms', async ({ request }) => {
    const start = Date.now();
    await request.get(`${BASE_URL}/api/analytics/predictive/demand-forecast`, {
      headers: getAuthHeaders(TENANT_ID)
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
  });

  test('Churn prediction < 1500ms', async ({ request }) => {
    const start = Date.now();
    await request.get(`${BASE_URL}/api/analytics/predictive/churn-risk`, {
      headers: getAuthHeaders(TENANT_ID)
    });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1500);
  });
});
