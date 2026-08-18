/**
 * MULTI-TENANT ISOLATION TESTS
 * Validates that tenants cannot access each other's data
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Multi-Tenant Isolation Tests', () => {
  let helper: TestHelper;
  let authDharvika: any;
  let authQATest: any;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
    authDharvika = await helper.loginAsTenantOwner('dharvika');
    authQATest = await helper.loginAsTenantOwner('qaTest');
  });

  test.afterEach(async () => {
    if (authDharvika?.token) {
      await helper.logout(authDharvika.token);
    }
    if (authQATest?.token) {
      await helper.logout(authQATest.token);
    }
  });

  // ========== DATA ACCESS ISOLATION ==========

  test('Tenant A user cannot list Tenant B customers', async () => {
    // Create customer in Tenant B
    await helper.createCustomer(authQATest.tenantId, authQATest.token, { name: 'QA Test Customer' });

    // Try to list customers using Tenant A token
    const response = await helper.apiCall(
      'GET',
      API_ENDPOINTS.tenant.customers,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A user cannot list Tenant B drivers', async () => {
    // Create driver in Tenant B
    await helper.createDriver(authQATest.tenantId, authQATest.token, { name: 'QA Test Driver' });

    // Try to list drivers using Tenant A token
    const response = await helper.apiCall(
      'GET',
      API_ENDPOINTS.tenant.drivers,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A user cannot list Tenant B vehicles', async () => {
    // Create vehicle in Tenant B
    await helper.createVehicle(authQATest.tenantId, authQATest.token, { model: 'QA Test Vehicle' });

    // Try to list vehicles using Tenant A token
    const response = await helper.apiCall(
      'GET',
      API_ENDPOINTS.tenant.vehicles,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A user cannot list Tenant B bookings', async () => {
    // Create booking in Tenant B
    const customer = await helper.createCustomer(authQATest.tenantId, authQATest.token);
    await helper.createBooking(authQATest.tenantId, authQATest.token, customer.id);

    // Try to list bookings using Tenant A token
    const response = await helper.apiCall(
      'GET',
      API_ENDPOINTS.tenant.bookings,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== RECORD-LEVEL ISOLATION ==========

  test('Tenant A cannot read Tenant B customer record', async () => {
    // Create customer in Tenant B
    const customer = await helper.createCustomer(authQATest.tenantId, authQATest.token);

    // Try to read using Tenant A token
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}/${customer.id}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot read Tenant B driver record', async () => {
    // Create driver in Tenant B
    const driver = await helper.createDriver(authQATest.tenantId, authQATest.token);

    // Try to read using Tenant A token
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.drivers}/${driver.id}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot read Tenant B vehicle record', async () => {
    // Create vehicle in Tenant B
    const vehicle = await helper.createVehicle(authQATest.tenantId, authQATest.token);

    // Try to read using Tenant A token
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.vehicles}/${vehicle.id}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot read Tenant B booking record', async () => {
    // Create booking in Tenant B
    const customer = await helper.createCustomer(authQATest.tenantId, authQATest.token);
    const booking = await helper.createBooking(authQATest.tenantId, authQATest.token, customer.id);

    // Try to read using Tenant A token
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.bookings}/${booking.id}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== MODIFICATION ISOLATION ==========

  test('Tenant A cannot create customer in Tenant B', async () => {
    const response = await helper.apiCall(
      'POST',
      API_ENDPOINTS.tenant.customers,
      authDharvika.token,
      authQATest.tenantId,
      TEST_CONFIG.testData.customer
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot create driver in Tenant B', async () => {
    const response = await helper.apiCall(
      'POST',
      API_ENDPOINTS.tenant.drivers,
      authDharvika.token,
      authQATest.tenantId,
      TEST_CONFIG.testData.driver
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot create vehicle in Tenant B', async () => {
    const response = await helper.apiCall(
      'POST',
      API_ENDPOINTS.tenant.vehicles,
      authDharvika.token,
      authQATest.tenantId,
      TEST_CONFIG.testData.vehicle
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot create booking in Tenant B', async () => {
    const response = await helper.apiCall(
      'POST',
      API_ENDPOINTS.tenant.bookings,
      authDharvika.token,
      authQATest.tenantId,
      {
        ...TEST_CONFIG.testData.booking,
        customerId: '507f1f77bcf86cd799439300',
      }
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot update Tenant B customer', async () => {
    // Create customer in Tenant B
    const customer = await helper.createCustomer(authQATest.tenantId, authQATest.token);

    // Try to update using Tenant A token
    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.customers}/${customer.id}`,
      authDharvika.token,
      authQATest.tenantId,
      { name: 'Hacked Name' }
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot update Tenant B driver', async () => {
    // Create driver in Tenant B
    const driver = await helper.createDriver(authQATest.tenantId, authQATest.token);

    // Try to update using Tenant A token
    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.drivers}/${driver.id}`,
      authDharvika.token,
      authQATest.tenantId,
      { name: 'Hacked Name' }
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot update Tenant B vehicle', async () => {
    // Create vehicle in Tenant B
    const vehicle = await helper.createVehicle(authQATest.tenantId, authQATest.token);

    // Try to update using Tenant A token
    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.vehicles}/${vehicle.id}`,
      authDharvika.token,
      authQATest.tenantId,
      { model: 'Hacked Model' }
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A cannot delete Tenant B customer', async () => {
    // Create customer in Tenant B
    const customer = await helper.createCustomer(authQATest.tenantId, authQATest.token);

    // Try to delete using Tenant A token
    const response = await helper.apiCall(
      'DELETE',
      `${API_ENDPOINTS.tenant.customers}/${customer.id}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);

    // Verify customer still exists in Tenant B
    const verifyResponse = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}/${customer.id}`,
      authQATest.token,
      authQATest.tenantId
    );

    expect(verifyResponse.status()).toBe(HTTP_CODES.OK);
  });

  // ========== DASHBOARD ISOLATION ==========

  test('Tenant A cannot access Tenant B dashboard', async () => {
    const response = await helper.apiCall('GET', API_ENDPOINTS.tenant.dashboard, authDharvika.token, authQATest.tenantId);

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Each tenant sees their own dashboard', async () => {
    const dashA = await helper.getDashboard(authDharvika.tenantId, authDharvika.token);
    const dashB = await helper.getDashboard(authQATest.tenantId, authQATest.token);

    // Both should be valid
    expect(dashA).toBeDefined();
    expect(dashB).toBeDefined();

    // Dashboard stats should be different
    expect(dashA.tenantId || authDharvika.tenantId).not.toBe(dashB.tenantId || authQATest.tenantId);
  });

  // ========== ADMIN ENDPOINTS ISOLATION ==========

  test('Tenant A cannot access Tenant B admin endpoints', async () => {
    const response = await helper.apiCall(
      'GET',
      `${API_ENDPOINTS.admin.users}`,
      authDharvika.token,
      authQATest.tenantId
    );

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== TOKEN CONTEXT VALIDATION ==========

  test('Token is bound to specific tenant', async () => {
    // Get Dharvika dashboard with Dharvika token
    const response1 = await helper.getDashboard(authDharvika.tenantId, authDharvika.token);
    expect(response1).toBeDefined();

    // Try to use Dharvika token with QA Test tenant context
    const response2 = await helper.apiCall('GET', API_ENDPOINTS.tenant.dashboard, authDharvika.token, authQATest.tenantId);

    expect(response2.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== CONCURRENT ACCESS ISOLATION ==========

  test('Concurrent requests from different tenants are isolated', async ({ request }) => {
    const helper1 = new TestHelper(request);
    const helper2 = new TestHelper(request);

    const auth1 = await helper1.loginAsTenantOwner('dharvika');
    const auth2 = await helper1.loginAsTenantOwner('qaTest');

    // Create customers in parallel
    const customer1Promise = helper1.createCustomer(auth1.tenantId, auth1.token, { name: 'Dharvika Customer' });
    const customer2Promise = helper2.createCustomer(auth2.tenantId, auth2.token, { name: 'QA Test Customer' });

    const [customer1, customer2] = await Promise.all([customer1Promise, customer2Promise]);

    // Verify each tenant can only see their own customer
    const list1 = await helper1.listCustomers(auth1.tenantId, auth1.token, 1, 100);
    const list2 = await helper2.listCustomers(auth2.tenantId, auth2.token, 1, 100);

    const found1 = list1.customers.some((c: any) => c.id === customer1.id);
    const found2 = list2.customers.some((c: any) => c.id === customer2.id);

    expect(found1).toBe(true);
    expect(found2).toBe(true);

    // Cross-tenant should fail
    const crossCheck1 = await helper1.apiCall('GET', `${API_ENDPOINTS.tenant.customers}/${customer2.id}`, auth1.token, auth2.tenantId);
    const crossCheck2 = await helper2.apiCall('GET', `${API_ENDPOINTS.tenant.customers}/${customer1.id}`, auth2.token, auth1.tenantId);

    expect(crossCheck1.status()).not.toBe(HTTP_CODES.OK);
    expect(crossCheck2.status()).not.toBe(HTTP_CODES.OK);
  });
});
