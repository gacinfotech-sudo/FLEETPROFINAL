/**
 * TEST HELPERS & UTILITIES
 * Reusable functions for authentication, data creation, and API calls
 */

import { APIRequestContext, expect } from '@playwright/test';
import { TEST_CONFIG, API_ENDPOINTS, HTTP_CODES } from './config';

export class TestHelper {
  constructor(private request: APIRequestContext) {}

  /**
   * Login as root user
   */
  async loginAsRoot() {
    const response = await this.request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.auth.login}`, {
      data: {
        email: TEST_CONFIG.rootUser.email,
        password: TEST_CONFIG.rootUser.password,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    return {
      token: data.token || data.session?.id,
      userId: data.user?.id || data.userId,
      user: data.user,
    };
  }

  /**
   * Login as tenant owner
   */
  async loginAsTenantOwner(tenantKey: string = 'dharvika') {
    const tenant = TEST_CONFIG.tenants[tenantKey as keyof typeof TEST_CONFIG.tenants];
    if (!tenant) throw new Error(`Tenant ${tenantKey} not found in config`);

    const response = await this.request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.auth.login}`, {
      data: {
        email: tenant.owner.email,
        password: tenant.owner.password,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    return {
      token: data.token || data.session?.id,
      userId: data.user?.id || data.userId,
      tenantId: tenant.id,
      user: data.user,
    };
  }

  /**
   * Login as tenant staff
   */
  async loginAsTenantStaff(tenantKey: string = 'dharvika') {
    const tenant = TEST_CONFIG.tenants[tenantKey as keyof typeof TEST_CONFIG.tenants];
    if (!tenant) throw new Error(`Tenant ${tenantKey} not found in config`);

    const response = await this.request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.auth.login}`, {
      data: {
        email: tenant.staff.email,
        password: tenant.staff.password,
      },
    });

    expect(response.status()).toBe(HTTP_CODES.OK);
    const data = await response.json();
    return {
      token: data.token || data.session?.id,
      userId: data.user?.id || data.userId,
      tenantId: tenant.id,
      user: data.user,
    };
  }

  /**
   * Logout user
   */
  async logout(token: string) {
    const response = await this.request.post(`${TEST_CONFIG.baseUrl}${API_ENDPOINTS.auth.logout}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect([HTTP_CODES.OK, HTTP_CODES.NO_CONTENT]).toContain(response.status());
  }

  /**
   * Make authenticated API call
   */
  async apiCall(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    token: string,
    tenantId?: string,
    data?: any
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
    const options = { headers };

    let response;
    if (method === 'GET') {
      response = await this.request.get(url, options);
    } else if (method === 'POST') {
      response = await this.request.post(url, { ...options, data });
    } else if (method === 'PUT') {
      response = await this.request.put(url, { ...options, data });
    } else if (method === 'DELETE') {
      response = await this.request.delete(url, options);
    } else if (method === 'PATCH') {
      response = await this.request.patch(url, { ...options, data });
    }

    return response!;
  }

  /**
   * Create a test customer
   */
  async createCustomer(tenantId: string, token: string, overrides: any = {}) {
    const customerData = {
      ...TEST_CONFIG.testData.customer,
      ...overrides,
      mobile: overrides.mobile || `${Math.floor(Math.random() * 9000000000 + 9000000000)}`,
    };

    const response = await this.apiCall('POST', API_ENDPOINTS.tenant.customers, token, tenantId, customerData);

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    const data = await response.json();
    return data.customer || data;
  }

  /**
   * Create a test driver
   */
  async createDriver(tenantId: string, token: string, overrides: any = {}) {
    const driverData = {
      ...TEST_CONFIG.testData.driver,
      ...overrides,
      mobile: overrides.mobile || `${Math.floor(Math.random() * 9000000000 + 9000000000)}`,
    };

    const response = await this.apiCall('POST', API_ENDPOINTS.tenant.drivers, token, tenantId, driverData);

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    const data = await response.json();
    return data.driver || data;
  }

  /**
   * Create a test vehicle
   */
  async createVehicle(tenantId: string, token: string, overrides: any = {}) {
    const vehicleData = {
      ...TEST_CONFIG.testData.vehicle,
      ...overrides,
      registrationNumber:
        overrides.registrationNumber ||
        `KA01TST${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0')}`,
    };

    const response = await this.apiCall('POST', API_ENDPOINTS.tenant.vehicles, token, tenantId, vehicleData);

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    const data = await response.json();
    return data.vehicle || data;
  }

  /**
   * Create a test booking
   */
  async createBooking(
    tenantId: string,
    token: string,
    customerId: string,
    overrides: any = {}
  ) {
    const bookingData = {
      ...TEST_CONFIG.testData.booking,
      ...overrides,
      customerId,
      pickupLocation: 'Bangalore',
      dropLocation: 'Mysore',
      travelDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const response = await this.apiCall('POST', API_ENDPOINTS.tenant.bookings, token, tenantId, bookingData);

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    const data = await response.json();
    return data.booking || data;
  }

  /**
   * Assign driver to booking
   */
  async assignDriverToBooking(tenantId: string, token: string, bookingId: string, driverId: string) {
    const response = await this.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.bookings}/${bookingId}`,
      token,
      tenantId,
      { driverId }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    return await response.json();
  }

  /**
   * Assign vehicle to booking
   */
  async assignVehicleToBooking(tenantId: string, token: string, bookingId: string, vehicleId: string) {
    const response = await this.apiCall(
      'PUT',
      `${API_ENDPOINTS.tenant.bookings}/${bookingId}`,
      token,
      tenantId,
      { vehicleId }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    return await response.json();
  }

  /**
   * Get tenant dashboard
   */
  async getDashboard(tenantId: string, token: string) {
    const response = await this.apiCall('GET', API_ENDPOINTS.tenant.dashboard, token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * List customers with pagination
   */
  async listCustomers(tenantId: string, token: string, page: number = 1, limit: number = 20) {
    const response = await this.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.customers}?page=${page}&limit=${limit}`,
      token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * List drivers with pagination
   */
  async listDrivers(tenantId: string, token: string, page: number = 1, limit: number = 20) {
    const response = await this.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.drivers}?page=${page}&limit=${limit}`,
      token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * List vehicles with pagination
   */
  async listVehicles(tenantId: string, token: string, page: number = 1, limit: number = 20) {
    const response = await this.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.vehicles}?page=${page}&limit=${limit}`,
      token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * List bookings with pagination
   */
  async listBookings(tenantId: string, token: string, page: number = 1, limit: number = 20) {
    const response = await this.apiCall(
      'GET',
      `${API_ENDPOINTS.tenant.bookings}?page=${page}&limit=${limit}`,
      token,
      tenantId
    );

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * Get booking details
   */
  async getBookingDetails(tenantId: string, token: string, bookingId: string) {
    const response = await this.apiCall('GET', `${API_ENDPOINTS.tenant.bookings}/${bookingId}`, token, tenantId);

    expect([HTTP_CODES.OK]).toContain(response.status());
    return await response.json();
  }

  /**
   * Record payment for booking
   */
  async recordPayment(
    tenantId: string,
    token: string,
    bookingId: string,
    amount: number,
    method: string = 'cash'
  ) {
    const response = await this.apiCall(
      'POST',
      `${API_ENDPOINTS.tenant.bookings}/${bookingId}/payment`,
      token,
      tenantId,
      { amount, method }
    );

    expect([HTTP_CODES.OK, HTTP_CODES.CREATED]).toContain(response.status());
    return await response.json();
  }

  /**
   * Retry request with exponential backoff
   */
  async retryRequest<T>(fn: () => Promise<T>, maxAttempts: number = TEST_CONFIG.retries.maxAttempts): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = TEST_CONFIG.retries.delayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Wait for condition to be true
   */
  async waitFor(
    condition: () => Promise<boolean> | boolean,
    timeoutMs: number = 30000,
    intervalMs: number = 500
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = await Promise.resolve(condition());
      if (result) return;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
  }

  /**
   * Verify data counts
   */
  async verifyDataCounts(tenantId: string, token: string, expectedCounts: Record<string, number>) {
    const results: Record<string, any> = {};

    for (const [resource, expected] of Object.entries(expectedCounts)) {
      const endpoint = API_ENDPOINTS.tenant[resource as keyof typeof API_ENDPOINTS.tenant];
      if (!endpoint) continue;

      const response = await this.apiCall('GET', `${endpoint}?limit=1`, token, tenantId);
      const data = await response.json();
      const total = data.total || data.count || 0;

      results[resource] = {
        expected,
        actual: total,
        matches: total >= expected * 0.8, // Allow 20% variance
      };
    }

    return results;
  }
}
