/**
 * PLATFORM ADMIN TESTS
 * Validates root/platform admin functionality
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

test.describe('Platform Admin Tests', () => {
  let helper: TestHelper;
  let rootToken: string;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
    const auth = await helper.loginAsRoot();
    rootToken = auth.token;
  });

  test.afterEach(async () => {
    if (rootToken) {
      await helper.logout(rootToken);
    }
  });

  // ========== TENANT MANAGEMENT ==========

  test('Root can list all tenants', async () => {
    const response = await helper.apiCall('GET', API_ENDPOINTS.root.tenants, rootToken);
    expect(response.status()).toBe(HTTP_CODES.OK);

    const data = await response.json();
    expect(data.tenants).toBeDefined();
    expect(Array.isArray(data.tenants)).toBe(true);
  });

  test('Dharvika Travels is visible in tenant list', async () => {
    const response = await helper.apiCall('GET', API_ENDPOINTS.root.tenants, rootToken);
    expect(response.status()).toBe(HTTP_CODES.OK);

    const data = await response.json();
    const dharvika = data.tenants.find((t: any) => t.name === 'Dharvika Travels');
    expect(dharvika).toBeDefined();
    expect(dharvika.id).toBe(TEST_CONFIG.tenants.dharvika.id);
  });

  test('Root can get tenant details', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.tenant).toBeDefined();
    expect(data.tenant.id).toBe(tenantId);
    expect(data.tenant.name).toBe('Dharvika Travels');
  });

  test('Root can edit tenant details', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const response = await helper.apiCall('PUT', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken, undefined, {
      name: 'Dharvika Travels Updated',
      description: 'Updated description',
    });

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
  });

  test('Root can verify tenant is active', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.tenant.status).toBe('active');
  });

  // ========== TENANT USER MANAGEMENT ==========

  test('Root can list tenant users', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}/users`, rootToken);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
  });

  test('Root can get tenant user details', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const ownerId = TEST_CONFIG.tenants.dharvika.owner.userId;

    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}/users/${ownerId}`, rootToken);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(ownerId);
  });

  test('Root can create new tenant user', async () => {
    const tenantId = TEST_CONFIG.tenants.qaTest.id;
    const response = await helper.apiCall('POST', `${API_ENDPOINTS.root.tenants}/${tenantId}/users`, rootToken, undefined, {
      email: `newuser-${Date.now()}@qatest.local`,
      password: 'NewUserPassword123!@#',
      name: 'New Test User',
      role: 'staff',
    });

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    const data = await response.json();
    expect(data.user).toBeDefined();
  });

  test('Tenant owner has correct role', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const ownerId = TEST_CONFIG.tenants.dharvika.owner.userId;

    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}/users/${ownerId}`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.user.role).toBe('owner');
  });

  test('Tenant staff has correct role', async () => {
    const tenantId = TEST_CONFIG.tenants.dharvika.id;
    const staffId = TEST_CONFIG.tenants.dharvika.staff.userId;

    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/${tenantId}/users/${staffId}`, rootToken);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(['staff', 'employee', 'manager']).toContain(data.user.role);
  });

  // ========== PERMISSIONS & ROLES ==========

  test('Tenant owner has admin permissions', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');
    const response = await helper.apiCall('GET', API_ENDPOINTS.admin.permissions, auth.token, auth.tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    // Owner should have full permissions
    expect(data.permissions).toBeDefined();
  });

  test('Tenant staff has limited permissions', async () => {
    const auth = await helper.loginAsTenantStaff('dharvika');
    const response = await helper.apiCall('GET', API_ENDPOINTS.admin.permissions, auth.token, auth.tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    // Staff should have limited permissions
    expect(data.permissions).toBeDefined();
  });

  test('Root can list all roles', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root}/roles`, rootToken);

    expect([HTTP_CODES.OK]).toContain(response.status());
    const data = await response.json();
    expect(data.roles).toBeDefined();
    expect(Array.isArray(data.roles)).toBe(true);
  });

  // ========== TENANT SUSPENSION/ACTIVATION ==========

  test('Root can suspend a tenant', async () => {
    const tenantId = TEST_CONFIG.tenants.qaTest.id;
    const response = await helper.apiCall(
      'PUT',
      `${API_ENDPOINTS.root.tenants}/${tenantId}`,
      rootToken,
      undefined,
      { status: 'suspended' }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
  });

  test('Suspended tenant user cannot login', async ({ request }) => {
    // First suspend the tenant
    const tenantId = TEST_CONFIG.tenants.qaTest.id;
    await helper.apiCall('PUT', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken, undefined, {
      status: 'suspended',
    });

    // Wait a moment for suspension to take effect
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try to login
    const loginResponse = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.tenants.qaTest.owner.email,
        password: TEST_CONFIG.tenants.qaTest.owner.password,
      },
    });

    expect(loginResponse.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Root can activate a suspended tenant', async () => {
    const tenantId = TEST_CONFIG.tenants.qaTest.id;

    // Suspend tenant
    await helper.apiCall('PUT', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken, undefined, {
      status: 'suspended',
    });

    // Activate tenant
    const response = await helper.apiCall('PUT', `${API_ENDPOINTS.root.tenants}/${tenantId}`, rootToken, undefined, {
      status: 'active',
    });

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());

    // Verify tenant can login again
    const auth = await helper.loginAsTenantOwner('qaTest');
    expect(auth.token).toBeDefined();
  });

  // ========== PLATFORM STATISTICS ==========

  test('Root can view platform statistics', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root}/stats`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.stats).toBeDefined();
  });

  test('Platform statistics include tenant count', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root}/stats`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.stats.tenantCount).toBeGreaterThan(0);
  });

  test('Platform statistics include user count', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root}/stats`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    expect(data.stats.userCount).toBeGreaterThan(0);
  });

  // ========== AUTHORIZATION TESTS ==========

  test('Tenant owner cannot access root endpoints', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');
    const response = await helper.apiCall('GET', API_ENDPOINTS.root.tenants, auth.token);

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant staff cannot access root endpoints', async () => {
    const auth = await helper.loginAsTenantStaff('dharvika');
    const response = await helper.apiCall('GET', API_ENDPOINTS.root.tenants, auth.token);

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Non-existent tenant returns 404', async () => {
    const response = await helper.apiCall('GET', `${API_ENDPOINTS.root.tenants}/nonexistent-id`, rootToken);

    expect(response.status()).toBe(HTTP_CODES.NOT_FOUND);
  });
});

// Helper to extend TestHelper with tenant-specific methods
declare global {
  namespace PlaywrightTest {
    interface TestContext {
      helper?: TestHelper;
      rootToken?: string;
    }
  }
}
