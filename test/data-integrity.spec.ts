/**
 * DATA INTEGRITY TESTS
 * Validates that recovered data is intact and accessible
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Data Integrity Tests', () => {
  let helper: TestHelper;
  let auth: any;
  let tenantId: string;
  let rootAuth: any;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
    auth = await helper.loginAsTenantOwner('dharvika');
    rootAuth = await helper.loginAsRoot();
    tenantId = auth.tenantId;
  });

  test.afterEach(async () => {
    if (auth?.token) {
      await helper.logout(auth.token);
    }
    if (rootAuth?.token) {
      await helper.logout(rootAuth.token);
    }
  });

  // ========== TENANT VERIFICATION ==========

  test('Dharvika Travels exists and is accessible', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootAuth.token);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.tenant.name).toBe('Dharvika Travels');
    expect(data.tenant.status).toBe('active');
  });

  test('Dharvika Travels has valid owner', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}/users`, rootAuth.token);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();

    const owner = data.users.find((u: any) => u.role === 'owner');
    expect(owner).toBeDefined();
    expect(owner.email).toBe(TEST_CONFIG.tenants.dharvika.owner.email);
  });

  // ========== CUSTOMER DATA RECOVERY ==========

  test('Verify customers are recovered (~1730 expected)', async () => {
    const response = await helper.listCustomers(tenantId, auth.token, 1, 1);

    expect(response.total).toBeDefined();
    const total = response.total;

    // Allow 20% variance from expected count
    const lowerBound = TEST_CONFIG.expectedDataCounts.dharvika.customers * 0.8;
    const upperBound = TEST_CONFIG.expectedDataCounts.dharvika.customers * 1.2;

    expect(total).toBeGreaterThanOrEqual(lowerBound);
    expect(total).toBeLessThanOrEqual(upperBound);
  });

  test('Sample customers have valid data', async () => {
    const response = await helper.listCustomers(tenantId, auth.token, 1, 10);

    expect(response.customers.length).toBeGreaterThan(0);

    for (const customer of response.customers) {
      expect(customer.id).toBeDefined();
      expect(customer.name).toBeDefined();
      expect(customer.mobile).toBeDefined();
      expect(customer.createdAt).toBeDefined();
    }
  });

  test('Customers have correct tenant association', async () => {
    const response = await helper.listCustomers(tenantId, auth.token, 1, 10);

    expect(response.customers.length).toBeGreaterThan(0);

    for (const customer of response.customers) {
      expect(customer.tenantId).toBe(tenantId);
    }
  });

  // ========== BOOKING DATA RECOVERY ==========

  test('Verify bookings are recovered (~1381 expected)', async () => {
    const response = await helper.listBookings(tenantId, auth.token, 1, 1);

    expect(response.total).toBeDefined();
    const total = response.total;

    // Allow 20% variance from expected count
    const lowerBound = TEST_CONFIG.expectedDataCounts.dharvika.bookings * 0.8;
    const upperBound = TEST_CONFIG.expectedDataCounts.dharvika.bookings * 1.2;

    expect(total).toBeGreaterThanOrEqual(lowerBound);
    expect(total).toBeLessThanOrEqual(upperBound);
  });

  test('Sample bookings have valid data', async () => {
    const response = await helper.listBookings(tenantId, auth.token, 1, 10);

    expect(response.bookings.length).toBeGreaterThan(0);

    for (const booking of response.bookings) {
      expect(booking.id).toBeDefined();
      expect(booking.customerId).toBeDefined();
      expect(booking.createdAt).toBeDefined();
    }
  });

  test('Bookings have correct tenant association', async () => {
    const response = await helper.listBookings(tenantId, auth.token, 1, 10);

    expect(response.bookings.length).toBeGreaterThan(0);

    for (const booking of response.bookings) {
      expect(booking.tenantId).toBe(tenantId);
    }
  });

  // ========== DRIVER DATA RECOVERY ==========

  test('Verify drivers are recovered (~255 expected)', async () => {
    const response = await helper.listDrivers(tenantId, auth.token, 1, 1);

    expect(response.total).toBeDefined();
    const total = response.total;

    // Allow 20% variance from expected count
    const lowerBound = TEST_CONFIG.expectedDataCounts.dharvika.drivers * 0.8;
    const upperBound = TEST_CONFIG.expectedDataCounts.dharvika.drivers * 1.2;

    expect(total).toBeGreaterThanOrEqual(lowerBound);
    expect(total).toBeLessThanOrEqual(upperBound);
  });

  test('Sample drivers have valid data', async () => {
    const response = await helper.listDrivers(tenantId, auth.token, 1, 10);

    expect(response.drivers.length).toBeGreaterThan(0);

    for (const driver of response.drivers) {
      expect(driver.id).toBeDefined();
      expect(driver.name).toBeDefined();
      expect(driver.mobile).toBeDefined();
      expect(driver.createdAt).toBeDefined();
    }
  });

  test('Drivers have correct tenant association', async () => {
    const response = await helper.listDrivers(tenantId, auth.token, 1, 10);

    expect(response.drivers.length).toBeGreaterThan(0);

    for (const driver of response.drivers) {
      expect(driver.tenantId).toBe(tenantId);
    }
  });

  // ========== VEHICLE DATA RECOVERY ==========

  test('Verify vehicles are recovered (~368 expected)', async () => {
    const response = await helper.listVehicles(tenantId, auth.token, 1, 1);

    expect(response.total).toBeDefined();
    const total = response.total;

    // Allow 20% variance from expected count
    const lowerBound = TEST_CONFIG.expectedDataCounts.dharvika.vehicles * 0.8;
    const upperBound = TEST_CONFIG.expectedDataCounts.dharvika.vehicles * 1.2;

    expect(total).toBeGreaterThanOrEqual(lowerBound);
    expect(total).toBeLessThanOrEqual(upperBound);
  });

  test('Sample vehicles have valid data', async () => {
    const response = await helper.listVehicles(tenantId, auth.token, 1, 10);

    expect(response.vehicles.length).toBeGreaterThan(0);

    for (const vehicle of response.vehicles) {
      expect(vehicle.id).toBeDefined();
      expect(vehicle.registrationNumber).toBeDefined();
      expect(vehicle.model).toBeDefined();
      expect(vehicle.createdAt).toBeDefined();
    }
  });

  test('Vehicles have correct tenant association', async () => {
    const response = await helper.listVehicles(tenantId, auth.token, 1, 10);

    expect(response.vehicles.length).toBeGreaterThan(0);

    for (const vehicle of response.vehicles) {
      expect(vehicle.tenantId).toBe(tenantId);
    }
  });

  // ========== RELATIONSHIP INTEGRITY ==========

  test('Bookings reference valid customers', async () => {
    const bookingsResponse = await helper.listBookings(tenantId, auth.token, 1, 10);

    expect(bookingsResponse.bookings.length).toBeGreaterThan(0);

    for (const booking of bookingsResponse.bookings) {
      const customerResponse = await helper.apiCall(
        'GET',
        `${API_ENDPOINTS.tenant.customers}/${booking.customerId}`,
        auth.token,
        tenantId
      );

      expect([HTTP_CODES.OK]).toContain(customerResponse.status());
    }
  });

  test('Bookings with drivers reference valid drivers', async () => {
    const bookingsResponse = await helper.listBookings(tenantId, auth.token, 1, 20);

    const bookingsWithDriver = bookingsResponse.bookings.filter((b: any) => b.driverId);

    if (bookingsWithDriver.length > 0) {
      for (const booking of bookingsWithDriver.slice(0, 5)) {
        const driverResponse = await helper.apiCall(
          'GET',
          `${API_ENDPOINTS.tenant.drivers}/${booking.driverId}`,
          auth.token,
          tenantId
        );

        expect([HTTP_CODES.OK]).toContain(driverResponse.status());
      }
    }
  });

  test('Bookings with vehicles reference valid vehicles', async () => {
    const bookingsResponse = await helper.listBookings(tenantId, auth.token, 1, 20);

    const bookingsWithVehicle = bookingsResponse.bookings.filter((b: any) => b.vehicleId);

    if (bookingsWithVehicle.length > 0) {
      for (const booking of bookingsWithVehicle.slice(0, 5)) {
        const vehicleResponse = await helper.apiCall(
          'GET',
          `${API_ENDPOINTS.tenant.vehicles}/${booking.vehicleId}`,
          auth.token,
          tenantId
        );

        expect([HTTP_CODES.OK]).toContain(vehicleResponse.status());
      }
    }
  });

  // ========== DUPLICATE & ORPHAN DETECTION ==========

  test('No duplicate tenants with same name exist', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}?limit=100`, rootAuth.token);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();

    const nameMap = new Map();
    for (const tenant of data.tenants) {
      if (nameMap.has(tenant.name)) {
        throw new Error(`Duplicate tenant name found: ${tenant.name}`);
      }
      nameMap.set(tenant.name, tenant.id);
    }
  });

  test('No orphaned customers detected', async () => {
    const response = await helper.listCustomers(tenantId, auth.token, 1, 10);

    for (const customer of response.customers) {
      // Customer should have required fields
      expect(customer.id).toBeDefined();
      expect(customer.tenantId).toBe(tenantId);
    }
  });

  test('No orphaned drivers detected', async () => {
    const response = await helper.listDrivers(tenantId, auth.token, 1, 10);

    for (const driver of response.drivers) {
      // Driver should have required fields
      expect(driver.id).toBeDefined();
      expect(driver.tenantId).toBe(tenantId);
    }
  });

  test('No orphaned vehicles detected', async () => {
    const response = await helper.listVehicles(tenantId, auth.token, 1, 10);

    for (const vehicle of response.vehicles) {
      // Vehicle should have required fields
      expect(vehicle.id).toBeDefined();
      expect(vehicle.tenantId).toBe(tenantId);
    }
  });

  // ========== DATA CONSISTENCY ==========

  test('Customer data is consistent across requests', async () => {
    const response1 = await helper.listCustomers(tenantId, auth.token, 1, 5);
    const customerId = response1.customers[0].id;

    const response2 = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}/${customerId}`,
      auth.token,
      tenantId
    );

    const customer1 = response1.customers[0];
    const customer2 = await response2.json();

    expect(customer1.id).toBe(customer2.id);
    expect(customer1.name).toBe(customer2.name);
    expect(customer1.mobile).toBe(customer2.mobile);
  });

  test('No data mutation on read operations', async () => {
    const response1 = await helper.listCustomers(tenantId, auth.token, 1, 5);
    const customer1 = JSON.stringify(response1.customers[0]);

    // Read same page again
    const response2 = await helper.listCustomers(tenantId, auth.token, 1, 5);
    const customer2 = JSON.stringify(response2.customers[0]);

    expect(customer1).toBe(customer2);
  });
});
