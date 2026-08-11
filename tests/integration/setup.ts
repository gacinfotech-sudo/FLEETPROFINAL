/**
 * Integration Test Setup & Configuration
 * Provides test database setup, data seeding, mocking, and cleanup utilities
 */

import { vi } from 'vitest';
import * as crypto from 'crypto';

// ===== Test Database Setup =====
export async function setupTestDatabase() {
  const dbName = `fleetpro_test_${Date.now()}`;

  return {
    name: dbName,
    uri: `mongodb://127.0.0.1:27017/${dbName}`,
    async connect() {
      // Simulated DB connection
      console.log(`[TEST] Connected to ${dbName}`);
    },
    async disconnect() {
      console.log(`[TEST] Disconnected from ${dbName}`);
    },
    async clear() {
      console.log(`[TEST] Cleared ${dbName}`);
    },
  };
}

// ===== Test Data Seeding =====
export const testDataSeeds = {
  tenantId: () => `TENANT_${Date.now()}`,
  userId: () => `USER_${Date.now()}`,
  bookingId: () => `BOOKING_${Date.now()}`,
  vehicleId: () => `VEHICLE_${Date.now()}`,
  driverId: () => `DRIVER_${Date.now()}`,
  notificationId: () => `NOTIF_${Date.now()}`,

  booking: (overrides?: any) => ({
    id: `BOOKING_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    customerId: `CUST_${Date.now()}`,
    vehicleId: null,
    driverId: null,
    status: 'created',
    amount: 2500,
    paymentStatus: 'pending',
    pickupLocation: {
      address: '123 Main St, Bangalore',
      lat: 12.9716,
      lon: 77.5946,
    },
    dropoffLocation: {
      address: '456 Park Ave, Bangalore',
      lat: 12.9352,
      lon: 77.6245,
    },
    pickupTime: new Date(Date.now() + 60 * 60 * 1000),
    dropoffTime: new Date(Date.now() + 120 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  vehicle: (overrides?: any) => ({
    id: `VEHICLE_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    registrationNumber: `KA01AB${Math.random().toString().slice(2, 6)}`,
    model: 'Maruti Ertiga',
    capacity: 6,
    status: 'available',
    location: {
      lat: 12.9716,
      lon: 77.5946,
    },
    lastServiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    nextServiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    maintenanceStatus: 'good',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  driver: (overrides?: any) => ({
    id: `DRIVER_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    name: `Driver ${Math.random().toString().slice(2, 6)}`,
    phone: `+919${Math.random().toString().slice(2, 11)}`,
    email: `driver_${Date.now()}@test.com`,
    status: 'available',
    location: {
      lat: 12.9716,
      lon: 77.5946,
    },
    licenseNumber: `DL123456${Math.random().toString().slice(2, 6)}`,
    licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    rating: 4.5,
    totalRides: 250,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  payment: (overrides?: any) => ({
    id: `PAY_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    bookingId: `BOOKING_${Date.now()}`,
    amount: 2500,
    status: 'pending',
    method: 'card',
    provider: 'stripe',
    paymentIntentId: `pi_${crypto.randomBytes(12).toString('hex')}`,
    transactionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  notification: (overrides?: any) => ({
    id: `NOTIF_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    userId: `USER_${Date.now()}`,
    type: 'booking_update',
    channel: 'in_app',
    subject: 'Booking Update',
    message: 'Your booking has been updated',
    status: 'pending',
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  preference: (overrides?: any) => ({
    id: `PREF_${Date.now()}`,
    tenantId: `TENANT_${Date.now()}`,
    userId: `USER_${Date.now()}`,
    channels: {
      email: true,
      sms: true,
      push: true,
      in_app: true,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
    categories: {
      booking_updates: true,
      payment_updates: true,
      driver_notifications: true,
      promotional: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// ===== Mock Service Providers =====
export const mockProviders = {
  sendGrid: {
    send: vi.fn().mockResolvedValue({ messageId: `sg_${Date.now()}` }),
    verify: vi.fn().mockResolvedValue(true),
  },

  twilio: {
    send: vi.fn().mockResolvedValue({ sid: `SM${crypto.randomBytes(17).toString('hex')}` }),
    verify: vi.fn().mockResolvedValue(true),
  },

  stripe: {
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: `pi_${crypto.randomBytes(12).toString('hex')}`,
      status: 'requires_payment_method',
    }),
    confirmPayment: vi.fn().mockResolvedValue({
      id: `pi_${crypto.randomBytes(12).toString('hex')}`,
      status: 'succeeded',
    }),
  },

  googleMaps: {
    geocode: vi.fn().mockResolvedValue({
      lat: 12.9716,
      lon: 77.5946,
    }),
    directions: vi.fn().mockResolvedValue({
      distance: 5.2,
      duration: 15,
      path: [],
    }),
  },

  whatsapp: {
    send: vi.fn().mockResolvedValue({ messageId: `wa_${Date.now()}` }),
    verify: vi.fn().mockResolvedValue(true),
  },
};

// ===== Test Utilities =====
export async function createTestTenant() {
  return {
    id: `TENANT_${Date.now()}`,
    name: `Test Tenant ${Date.now()}`,
    status: 'active',
    createdAt: new Date(),
  };
}

export async function createTestUser(tenantId: string) {
  return {
    id: `USER_${Date.now()}`,
    tenantId,
    email: `user_${Date.now()}@test.com`,
    role: 'admin',
    status: 'active',
    createdAt: new Date(),
  };
}

export async function seedTestData() {
  const tenant = await createTestTenant();
  const user = await createTestUser(tenant.id);

  return {
    tenant,
    user,
    booking: testDataSeeds.booking({ tenantId: tenant.id }),
    vehicle: testDataSeeds.vehicle({ tenantId: tenant.id }),
    driver: testDataSeeds.driver({ tenantId: tenant.id }),
    payment: testDataSeeds.payment({ tenantId: tenant.id }),
    notification: testDataSeeds.notification({ tenantId: tenant.id, userId: user.id }),
  };
}

// ===== Cleanup Utilities =====
export async function cleanupTestData(testId: string) {
  console.log(`[TEST] Cleaning up data for test: ${testId}`);
  // Simulated cleanup
}

export async function cleanupAllTestData() {
  console.log('[TEST] Cleaning up all test data');
  // Simulated cleanup
}

// ===== Performance Monitoring =====
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  start(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(duration);
    };
  }

  getMetrics(label: string) {
    const times = this.metrics.get(label) || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0],
      max: sorted[len - 1],
      avg: times.reduce((a, b) => a + b, 0) / len,
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      count: len,
    };
  }

  report() {
    console.log('\n=== Performance Metrics ===');
    this.metrics.forEach((_, label) => {
      const metrics = this.getMetrics(label);
      console.log(`\n${label}:`);
      console.log(`  Count: ${metrics?.count}`);
      console.log(`  Min: ${metrics?.min.toFixed(2)}ms`);
      console.log(`  Max: ${metrics?.max.toFixed(2)}ms`);
      console.log(`  Avg: ${metrics?.avg.toFixed(2)}ms`);
      console.log(`  P50: ${metrics?.p50.toFixed(2)}ms`);
      console.log(`  P95: ${metrics?.p95.toFixed(2)}ms`);
      console.log(`  P99: ${metrics?.p99.toFixed(2)}ms`);
    });
  }

  reset() {
    this.metrics.clear();
  }
}

// ===== Assertion Helpers =====
export const assertions = {
  assertLatency: (duration: number, threshold: number) => {
    if (duration > threshold) {
      throw new Error(`Latency exceeded: ${duration}ms > ${threshold}ms`);
    }
  },

  assertThroughput: (count: number, duration: number, target: number) => {
    const actual = (count / duration) * 1000; // per second
    if (actual < target) {
      throw new Error(`Throughput below target: ${actual}/s < ${target}/s`);
    }
  },

  assertMemoryUsage: (current: number, threshold: number) => {
    if (current > threshold) {
      throw new Error(`Memory usage exceeded: ${(current / 1024 / 1024).toFixed(2)}MB > ${(threshold / 1024 / 1024).toFixed(2)}MB`);
    }
  },
};

// ===== Test Configuration =====
export const testConfig = {
  timeout: 30000,
  retries: 3,
  concurrency: 4,
  perfThresholds: {
    whatsappSend: 500, // ms
    callInitiate: 1000, // ms
    locationUpdate: 2000, // ms
    geofenceAlert: 3000, // ms
    webhookResponse: 500, // ms
  },
  memoryLimit: 500 * 1024 * 1024, // 500MB
  cpuLimit: 80, // percent
};

// ===== Global Test Setup =====
export async function globalSetup() {
  console.log('[TEST] Starting global setup');
  // Initialize test infrastructure
  vi.useFakeTimers();
}

export async function globalTeardown() {
  console.log('[TEST] Starting global teardown');
  // Clean up test infrastructure
  vi.useRealTimers();
  vi.clearAllMocks();
}
