/**
 * AUTH & SESSION TESTS
 * Validates all authentication flows and session management
 */

import { test, expect } from '@playwright/test';
import { TestHelper } from './helpers';
import { TEST_CONFIG, HTTP_CODES } from './config';

test.describe('Auth & Session Tests', () => {
  let helper: TestHelper;

  test.beforeEach(async ({ request }) => {
    helper = new TestHelper(request);
  });

  // ========== ROOT USER AUTHENTICATION ==========

  test('Root user can login successfully', async () => {
    const auth = await helper.loginAsRoot();
    expect(auth.token).toBeDefined();
    expect(auth.userId).toBeDefined();
    expect(auth.user).toBeDefined();
  });

  test('Root user can logout successfully', async () => {
    const auth = await helper.loginAsRoot();
    await helper.logout(auth.token);
    // Verify token is invalidated
    const response = await helper.apiCall('GET', '/api/root/stats', auth.token);
    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Root user cannot login with invalid credentials', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: TEST_CONFIG.rootUser.email,
        password: 'InvalidPassword123!@#',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Root user cannot login with non-existent email', async ({ request }) => {
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: 'nonexistent@fleetpro.local',
        password: 'AnyPassword123!@#',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== TENANT OWNER AUTHENTICATION ==========

  test('Tenant owner can login successfully', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');
    expect(auth.token).toBeDefined();
    expect(auth.userId).toBeDefined();
    expect(auth.tenantId).toBe(TEST_CONFIG.tenants.dharvika.id);
  });

  test('Tenant owner can logout successfully', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');
    await helper.logout(auth.token);
    // Verify token is invalidated
    const response = await helper.apiCall('GET', '/api/tenant/dashboard', auth.token, auth.tenantId);
    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant owner cannot login with invalid credentials', async ({ request }) => {
    const tenant = TEST_CONFIG.tenants.dharvika;
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: tenant.owner.email,
        password: 'InvalidPassword123!@#',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant owner has access to tenant dashboard', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');
    const dashboard = await helper.getDashboard(auth.tenantId, auth.token);
    expect(dashboard).toBeDefined();
  });

  // ========== TENANT STAFF AUTHENTICATION ==========

  test('Tenant staff can login successfully', async () => {
    const auth = await helper.loginAsTenantStaff('dharvika');
    expect(auth.token).toBeDefined();
    expect(auth.userId).toBeDefined();
    expect(auth.tenantId).toBe(TEST_CONFIG.tenants.dharvika.id);
  });

  test('Tenant staff can logout successfully', async () => {
    const auth = await helper.loginAsTenantStaff('dharvika');
    await helper.logout(auth.token);
    // Verify token is invalidated
    const response = await helper.apiCall('GET', '/api/tenant/dashboard', auth.token, auth.tenantId);
    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant staff cannot login with invalid credentials', async ({ request }) => {
    const tenant = TEST_CONFIG.tenants.dharvika;
    const response = await request.post(`${TEST_CONFIG.baseUrl}/api/auth/login`, {
      data: {
        email: tenant.staff.email,
        password: 'InvalidPassword123!@#',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant staff has access to tenant dashboard', async () => {
    const auth = await helper.loginAsTenantStaff('dharvika');
    const dashboard = await helper.getDashboard(auth.tenantId, auth.token);
    expect(dashboard).toBeDefined();
  });

  // ========== SESSION MANAGEMENT ==========

  test('Multiple concurrent logins for same user work independently', async ({ request }) => {
    const helper1 = new TestHelper(request);
    const helper2 = new TestHelper(request);

    const auth1 = await helper1.loginAsRoot();
    const auth2 = await helper2.loginAsRoot();

    expect(auth1.token).not.toBe(auth2.token);
    expect(auth1.userId).toBe(auth2.userId);

    // Both sessions should be valid
    const response1 = await helper1.apiCall('GET', '/api/root/stats', auth1.token);
    const response2 = await helper2.apiCall('GET', '/api/root/stats', auth2.token);

    expect(response1.status()).toBe(HTTP_CODES.OK);
    expect(response2.status()).toBe(HTTP_CODES.OK);
  });

  test('Session is destroyed after logout', async () => {
    const auth = await helper.loginAsRoot();

    // Verify session is valid
    let response = await helper.apiCall('GET', '/api/root/stats', auth.token);
    expect(response.status()).toBe(HTTP_CODES.OK);

    // Logout
    await helper.logout(auth.token);

    // Verify session is destroyed
    response = await helper.apiCall('GET', '/api/root/stats', auth.token);
    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Root user dashboard does not reappear after logout', async () => {
    const auth = await helper.loginAsRoot();

    // Get dashboard
    let response = await helper.apiCall('GET', '/api/root/stats', auth.token);
    expect(response.status()).toBe(HTTP_CODES.OK);

    // Logout
    await helper.logout(auth.token);

    // Verify dashboard is not accessible
    response = await helper.apiCall('GET', '/api/root/stats', auth.token);
    expect(response.status()).not.toBe(HTTP_CODES.OK);

    // Verify new login works
    const newAuth = await helper.loginAsRoot();
    response = await helper.apiCall('GET', '/api/root/stats', newAuth.token);
    expect(response.status()).toBe(HTTP_CODES.OK);
  });

  test('Account switching works correctly (Dharvika -> QA Test)', async () => {
    // Login to Dharvika
    const auth1 = await helper.loginAsTenantOwner('dharvika');
    const response1 = await helper.apiCall('GET', '/api/tenant/dashboard', auth1.token, auth1.tenantId);
    expect(response1.status()).toBe(HTTP_CODES.OK);

    // Logout from Dharvika
    await helper.logout(auth1.token);

    // Login to QA Test
    const auth2 = await helper.loginAsTenantOwner('qaTest');
    const response2 = await helper.apiCall('GET', '/api/tenant/dashboard', auth2.token, auth2.tenantId);
    expect(response2.status()).toBe(HTTP_CODES.OK);

    // Verify tenant IDs are different
    expect(auth1.tenantId).not.toBe(auth2.tenantId);
  });

  test('No stale sessions after account switching', async () => {
    // Login to Dharvika
    const auth1 = await helper.loginAsTenantOwner('dharvika');

    // Login to QA Test (simulating account switch)
    const auth2 = await helper.loginAsTenantOwner('qaTest');

    // Verify first session is still valid (not stale)
    const response1 = await helper.apiCall('GET', '/api/tenant/dashboard', auth1.token, auth1.tenantId);
    expect(response1.status()).toBe(HTTP_CODES.OK);

    // Verify second session is valid
    const response2 = await helper.apiCall('GET', '/api/tenant/dashboard', auth2.token, auth2.tenantId);
    expect(response2.status()).toBe(HTTP_CODES.OK);
  });

  // ========== TOKEN VALIDATION ==========

  test('Request without token is rejected', async ({ request }) => {
    const response = await request.get(`${TEST_CONFIG.baseUrl}/api/tenant/dashboard`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Request with invalid token is rejected', async ({ request }) => {
    const response = await request.get(`${TEST_CONFIG.baseUrl}/api/tenant/dashboard`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Request with expired token is rejected', async ({ request }) => {
    // Create a JWT-like token that looks valid but is expired
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjB9.InvalidExpiredToken';

    const response = await request.get(`${TEST_CONFIG.baseUrl}/api/tenant/dashboard`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  // ========== CROSS-TENANT ACCESS CONTROL ==========

  test('Tenant A user cannot access Tenant B dashboard', async () => {
    const authA = await helper.loginAsTenantOwner('dharvika');
    const authB = await helper.loginAsTenantOwner('qaTest');

    // Try to access Tenant B data with Tenant A token
    const response = await helper.apiCall('GET', '/api/tenant/dashboard', authA.token, authB.tenantId);

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });

  test('Tenant A token is tenant-specific', async () => {
    const auth = await helper.loginAsTenantOwner('dharvika');

    // Verify tenant context is set
    expect(auth.tenantId).toBe(TEST_CONFIG.tenants.dharvika.id);

    // Verify accessing with wrong tenant context fails
    const response = await helper.apiCall('GET', '/api/tenant/dashboard', auth.token, TEST_CONFIG.tenants.qaTest.id);

    expect(response.status()).not.toBe(HTTP_CODES.OK);
  });
});
