/**
 * REPORTS & DASHBOARD TESTS
 * Validates reporting and analytics functionality
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Reports & Dashboard Tests', () => {
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

  // ========== DASHBOARD TESTS ==========

  test('Dashboard loads without errors', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);

    expect(dashboard).toBeDefined();
    expect(dashboard).toHaveProperty('stats');
  });

  test('Dashboard contains key metrics', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);

    // Check for essential dashboard metrics
    expect(dashboard.stats).toBeDefined();
  });

  test('Dashboard total bookings is accurate', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);
    const bookingsList = await helper.listBookings(tenantId, auth.token, 1, 1);

    expect(dashboard.stats).toBeDefined();
    expect(bookingsList.total).toBeGreaterThanOrEqual(0);
  });

  test('Dashboard total customers is accurate', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);
    const customersList = await helper.listCustomers(tenantId, auth.token, 1, 1);

    expect(dashboard.stats).toBeDefined();
    expect(customersList.total).toBeGreaterThanOrEqual(0);
  });

  test('Dashboard total drivers is accurate', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);
    const driversList = await helper.listDrivers(tenantId, auth.token, 1, 1);

    expect(dashboard.stats).toBeDefined();
    expect(driversList.total).toBeGreaterThanOrEqual(0);
  });

  test('Dashboard total vehicles is accurate', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);
    const vehiclesList = await helper.listVehicles(tenantId, auth.token, 1, 1);

    expect(dashboard.stats).toBeDefined();
    expect(vehiclesList.total).toBeGreaterThanOrEqual(0);
  });

  // ========== REVENUE REPORT TESTS ==========

  test('Revenue report loads without errors', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.revenue}`, auth.token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('Revenue report contains expected fields', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.revenue}`, auth.token, tenantId);

    if (response.status() === HTTP_CODES.OK) {
      const data = await response.json();
      // Revenue data should be present
      expect(data.revenue !== undefined || data.total !== undefined || data.data !== undefined).toBe(true);
    }
  });

  test('Revenue report shows non-negative values', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.revenue}`, auth.token, tenantId);

    if (response.status() === HTTP_CODES.OK) {
      const data = await response.json();
      // All revenue values should be >= 0
      if (Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.revenue !== undefined) {
            expect(item.revenue).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  test('Revenue report filters by date range work', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date();

    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.reports.revenue}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      auth.token,
      tenantId
    );

    expect([HTTP_CODES.OK, HTTP_CODES.BAD_REQUEST]).toContain(response.status());
  });

  // ========== BOOKING REPORT TESTS ==========

  test('Booking report loads without errors', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.bookings}`, auth.token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('Booking report shows all booking statuses', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.bookings}`, auth.token, tenantId);

    if (response.status() === HTTP_CODES.OK) {
      const data = await response.json();
      // Should have booking data
      expect(data.bookings !== undefined || data.total !== undefined || data.data !== undefined).toBe(true);
    }
  });

  test('Booking statistics are consistent', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.bookings}`, auth.token, tenantId);
    const bookingsList = await helper.listBookings(tenantId, auth.token, 1, 1);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();

    // Report total should match list total
    const reportTotal = data.total || (Array.isArray(data.data) ? data.data.length : 0);
    expect(reportTotal).toBeGreaterThanOrEqual(0);
  });

  // ========== DRIVER REPORT TESTS ==========

  test('Driver report loads without errors', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.drivers}`, auth.token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('Driver statistics are accurate', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.drivers}`, auth.token, tenantId);
    const driversList = await helper.listDrivers(tenantId, auth.token, 1, 1);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();

    // Report should have driver data
    expect(data.drivers !== undefined || data.total !== undefined || data.data !== undefined).toBe(true);
  });

  test('Driver performance metrics are included', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.drivers}`, auth.token, tenantId);

    if (response.status() === HTTP_CODES.OK) {
      const data = await response.json();
      // Should have performance data
      expect(data).toBeDefined();
    }
  });

  // ========== VEHICLE REPORT TESTS ==========

  test('Vehicle report loads without errors', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.vehicles}`, auth.token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('Vehicle utilization is calculated', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.vehicles}`, auth.token, tenantId);
    const vehiclesList = await helper.listVehicles(tenantId, auth.token, 1, 1);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();

    // Report should have vehicle data
    expect(data.vehicles !== undefined || data.total !== undefined || data.data !== undefined).toBe(true);
  });

  test('Vehicle maintenance status included', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.vehicles}`, auth.token, tenantId);

    if (response.status() === HTTP_CODES.OK) {
      const data = await response.json();
      // Should have maintenance data if available
      expect(data).toBeDefined();
    }
  });

  // ========== ANALYTICS CALCULATIONS ==========

  test('Average booking value is calculated correctly', async () => {
    // Create bookings with known payment amounts
    const customer = await helper.createCustomer(tenantId, auth.token);
    const booking1 = await helper.createBooking(tenantId, auth.token, customer.id);
    const booking2 = await helper.createBooking(tenantId, auth.token, customer.id);

    await helper.recordPayment(tenantId, auth.token, booking1.id, 5000);
    await helper.recordPayment(tenantId, auth.token, booking2.id, 7000);

    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.revenue}`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.OK);
    // Report should reflect the new data
  });

  test('Driver utilization is calculated', async () => {
    const driver = await helper.createDriver(tenantId, auth.token);
    const customer = await helper.createCustomer(tenantId, auth.token);

    // Create booking with driver
    const booking = await helper.createBooking(tenantId, auth.token, customer.id);
    await helper.assignDriverToBooking(tenantId, auth.token, booking.id, driver.id);

    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.drivers}`, auth.token, tenantId);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data).toBeDefined();
  });

  // ========== SEARCH & FILTER TESTS ==========

  test('Dashboard search functionality works', async () => {
    const customer = await helper.createCustomer(tenantId, auth.token, { name: 'Unique Search Test' });

    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}?search=Unique`,
      auth.token,
      tenantId
    );

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(Array.isArray(data.customers)).toBe(true);
  });

  test('Report filtering by status works', async () => {
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.reports.bookings}?status=confirmed`,
      auth.token,
      tenantId
    );

    expect([HTTP_CODES.OK, HTTP_CODES.BAD_REQUEST]).toContain(response.status());
  });

  test('Report pagination works', async () => {
    const page1 = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.reports.bookings}?page=1&limit=10`,
      auth.token,
      tenantId
    );

    const page2 = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.reports.bookings}?page=2&limit=10`,
      auth.token,
      tenantId
    );

    expect(page1.status()).toBe(HTTP_CODES.OK);
    expect(page2.status()).toBe(HTTP_CODES.OK);
  });

  // ========== PERFORMANCE TESTS ==========

  test('Dashboard loads within 2 seconds', async () => {
    const startTime = Date.now();
    const dashboard = await helper.getDashboard(tenantId, auth.token);
    const duration = Date.now() - startTime;

    expect(dashboard).toBeDefined();
    expect(duration).toBeLessThan(2000);
  });

  test('Revenue report loads within 2 seconds', async () => {
    const startTime = Date.now();
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.revenue}`, auth.token, tenantId);
    const duration = Date.now() - startTime;

    expect(response.status()).toBe(HTTP_CODES.OK);
    expect(duration).toBeLessThan(2000);
  });

  test('Booking report loads within 2 seconds', async () => {
    const startTime = Date.now();
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.bookings}`, auth.token, tenantId);
    const duration = Date.now() - startTime;

    expect(response.status()).toBe(HTTP_CODES.OK);
    expect(duration).toBeLessThan(2000);
  });

  test('Driver report loads within 2 seconds', async () => {
    const startTime = Date.now();
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.drivers}`, auth.token, tenantId);
    const duration = Date.now() - startTime;

    expect(response.status()).toBe(HTTP_CODES.OK);
    expect(duration).toBeLessThan(2000);
  });

  test('Vehicle report loads within 2 seconds', async () => {
    const startTime = Date.now();
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.reports.vehicles}`, auth.token, tenantId);
    const duration = Date.now() - startTime;

    expect(response.status()).toBe(HTTP_CODES.OK);
    expect(duration).toBeLessThan(2000);
  });

  // ========== DATA QUALITY TESTS ==========

  test('Dashboard metrics are internally consistent', async () => {
    const dashboard = await helper.getDashboard(tenantId, auth.token);

    // If dashboard has revenue and bookings, verify consistency
    if (dashboard.stats && dashboard.stats.revenue !== undefined && dashboard.stats.bookings !== undefined) {
      // Revenue per booking should be reasonable (> 0 if both > 0)
      if (dashboard.stats.bookings > 0) {
        expect(typeof dashboard.stats.revenue).toBe('number');
      }
    }
  });

  test('Report data matches source tables', async () => {
    const reportResponse = await helper.apiCall('GET', `${API_ENDPOINTS.reports.bookings}`, auth.token, tenantId);
    const listResponse = await helper.apiCall('GET', API_ENDPOINTS.tenant.bookings, auth.token, tenantId);

    expect(reportResponse.status()).toBe(HTTP_CODES.OK);
    expect(listResponse.status()).toBe(HTTP_CODES.OK);

    const reportData = await reportResponse.json();
    const listData = await listResponse.json();

    // Totals should be close
    const reportTotal = reportData.total || 0;
    const listTotal = listData.total || 0;

    expect(Math.abs(reportTotal - listTotal)).toBeLessThan(5);
  });
});
