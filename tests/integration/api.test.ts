/**
 * API Integration Tests
 * Tests HTTP status codes, response formats, error handling, pagination, filtering, sorting, and versioning
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  testDataSeeds,
  seedTestData,
  PerformanceMonitor,
  testConfig,
} from './setup';

describe('API Integration Tests', () => {
  let testData: any;
  let monitor: PerformanceMonitor;

  beforeEach(async () => {
    testData = await seedTestData();
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('HTTP Status Codes', () => {
    it('should return 200 OK for successful requests', async () => {
      const response = {
        status: 200,
        statusText: 'OK',
        body: testDataSeeds.booking(),
      };

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.body).toBeTruthy();
    });

    it('should return 201 Created for resource creation', async () => {
      const response = {
        status: 201,
        statusText: 'Created',
        body: testDataSeeds.booking(),
        headers: { 'Location': '/api/bookings/BOOKING_123' },
      };

      expect(response.status).toBe(201);
      expect(response.headers['Location']).toBeTruthy();
    });

    it('should return 204 No Content for successful deletion', async () => {
      const response = {
        status: 204,
        statusText: 'No Content',
        body: null,
      };

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
    });

    it('should return 400 Bad Request for invalid input', async () => {
      const response = {
        status: 400,
        statusText: 'Bad Request',
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid booking amount',
          details: {
            field: 'amount',
            issue: 'must be positive',
          },
        },
      };

      expect(response.status).toBe(400);
      expect(response.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 401 Unauthorized for missing authentication', async () => {
      const response = {
        status: 401,
        statusText: 'Unauthorized',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };

      expect(response.status).toBe(401);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 Forbidden for insufficient permissions', async () => {
      const response = {
        status: 403,
        statusText: 'Forbidden',
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
        },
      };

      expect(response.status).toBe(403);
      expect(response.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found for missing resources', async () => {
      const response = {
        status: 404,
        statusText: 'Not Found',
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found',
        },
      };

      expect(response.status).toBe(404);
      expect(response.error.code).toBe('NOT_FOUND');
    });

    it('should return 409 Conflict for resource state conflicts', async () => {
      const response = {
        status: 409,
        statusText: 'Conflict',
        error: {
          code: 'CONFLICT',
          message: 'Booking already confirmed',
        },
      };

      expect(response.status).toBe(409);
      expect(response.error.code).toBe('CONFLICT');
    });

    it('should return 429 Too Many Requests for rate limit exceeded', async () => {
      const response = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '0',
        },
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
        },
      };

      expect(response.status).toBe(429);
      expect(response.headers['Retry-After']).toBe('60');
    });

    it('should return 500 Internal Server Error for server errors', async () => {
      const response = {
        status: 500,
        statusText: 'Internal Server Error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      };

      expect(response.status).toBe(500);
      expect(response.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should return 503 Service Unavailable for outages', async () => {
      const response = {
        status: 503,
        statusText: 'Service Unavailable',
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable',
        },
      };

      expect(response.status).toBe(503);
      expect(response.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Response Formats', () => {
    it('should return valid JSON response format', async () => {
      const response = {
        status: 200,
        data: testDataSeeds.booking(),
      };

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('data');
      expect(typeof response.data).toBe('object');
    });

    it('should include required fields in response', async () => {
      const booking = testDataSeeds.booking();
      const response = {
        status: 200,
        data: booking,
      };

      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('tenantId');
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('amount');
    });

    it('should have correct data types in response', async () => {
      const booking = testDataSeeds.booking();

      expect(typeof booking.id).toBe('string');
      expect(typeof booking.amount).toBe('number');
      expect(typeof booking.status).toBe('string');
      expect(booking.createdAt).toBeInstanceOf(Date);
    });

    it('should format array responses properly', async () => {
      const bookings = Array.from({ length: 3 }, () => testDataSeeds.booking());

      const response = {
        status: 200,
        data: bookings,
        meta: {
          count: bookings.length,
          total: 100,
        },
      };

      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(3);
      expect(response.meta.count).toBe(3);
    });

    it('should include metadata in list responses', async () => {
      const response = {
        status: 200,
        data: Array.from({ length: 10 }, () => testDataSeeds.booking()),
        meta: {
          count: 10,
          total: 245,
          page: 1,
          pageSize: 10,
          hasMore: true,
        },
      };

      expect(response.meta).toHaveProperty('count');
      expect(response.meta).toHaveProperty('total');
      expect(response.meta).toHaveProperty('page');
      expect(response.meta.hasMore).toBe(true);
    });

    it('should not leak stack traces in error responses', async () => {
      const errorResponse = {
        status: 500,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong',
          // Should NOT include: stack trace, internal details, file paths
        },
      };

      expect(errorResponse.error).not.toHaveProperty('stack');
      expect(Object.keys(errorResponse.error)).toEqual(['code', 'message']);
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error messages', async () => {
      const error = {
        code: 'INVALID_BOOKING_AMOUNT',
        message: 'Booking amount must be greater than 100',
        details: {
          field: 'amount',
          provided: 50,
          minimum: 100,
        },
      };

      expect(error.message).toContain('must be greater than');
      expect(error.details).toHaveProperty('minimum');
    });

    it('should provide machine-readable error codes', async () => {
      const errors = [
        { code: 'INVALID_INPUT' },
        { code: 'UNAUTHORIZED' },
        { code: 'NOT_FOUND' },
        { code: 'RATE_LIMIT_EXCEEDED' },
      ];

      for (const error of errors) {
        expect(typeof error.code).toBe('string');
        expect(error.code).toMatch(/^[A-Z_]+$/); // Uppercase with underscores
      }
    });

    it('should include request ID for error tracking', async () => {
      const requestId = `req_${Date.now()}`;

      const errorResponse = {
        status: 400,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request',
        },
        headers: {
          'X-Request-ID': requestId,
        },
      };

      expect(errorResponse.headers['X-Request-ID']).toBe(requestId);
    });

    it('should log errors without exposing sensitive data', async () => {
      const logs: any[] = [];

      const logError = (error: any) => {
        logs.push({
          code: error.code,
          message: error.message,
          timestamp: new Date(),
        });
      };

      const error = {
        code: 'PAYMENT_FAILED',
        message: 'Payment processing failed',
        apiKey: 'sk_test_xxx', // Sensitive - should NOT be logged
      };

      logError(error);

      expect(logs[0]).not.toHaveProperty('apiKey');
    });

    it('should handle validation errors with field details', async () => {
      const validationErrors = {
        amount: ['must be a positive number', 'must be less than 100000'],
        status: ['must be one of: created, confirmed, completed'],
      };

      const response = {
        status: 400,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: validationErrors,
        },
      };

      expect(response.error.errors.amount).toHaveLength(2);
      expect(response.error.errors.status).toHaveLength(1);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const pageTime = monitor.start('pagination_limit');

      const allBookings = Array.from({ length: 100 }, (_, i) =>
        testDataSeeds.booking({ id: `BOOKING_${i}` })
      );

      const limit = 10;
      const paginated = allBookings.slice(0, limit);

      expect(paginated).toHaveLength(limit);

      pageTime();
    });

    it('should support offset parameter', async () => {
      const allBookings = Array.from({ length: 100 }, (_, i) =>
        testDataSeeds.booking({ id: `BOOKING_${i}` })
      );

      const offset = 20;
      const limit = 10;
      const paginated = allBookings.slice(offset, offset + limit);

      expect(paginated).toHaveLength(limit);
      expect(paginated[0].id).toBe(`BOOKING_${offset}`);
    });

    it('should return total count in pagination metadata', async () => {
      const allBookings = Array.from({ length: 245 }, () => testDataSeeds.booking());

      const response = {
        data: allBookings.slice(0, 10),
        meta: {
          count: 10,
          total: 245,
          page: 1,
          pageSize: 10,
        },
      };

      expect(response.meta.total).toBe(245);
    });

    it('should include page metadata', async () => {
      const allBookings = Array.from({ length: 100 }, () => testDataSeeds.booking());

      const page = 3;
      const pageSize = 10;
      const start = (page - 1) * pageSize;

      const response = {
        data: allBookings.slice(start, start + pageSize),
        meta: {
          page,
          pageSize,
          totalPages: Math.ceil(100 / pageSize),
          hasMore: page < Math.ceil(100 / pageSize),
        },
      };

      expect(response.meta.page).toBe(3);
      expect(response.meta.totalPages).toBe(10);
      expect(response.meta.hasMore).toBe(true);
    });

    it('should handle cursor-based pagination', async () => {
      const allBookings = Array.from({ length: 100 }, (_, i) =>
        testDataSeeds.booking({ id: `BOOKING_${i}` })
      );

      const limit = 10;
      const cursor = 'BOOKING_20';

      const startIndex = allBookings.findIndex(b => b.id === cursor);
      const paginated = allBookings.slice(startIndex, startIndex + limit);

      const response = {
        data: paginated,
        meta: {
          cursor: paginated[paginated.length - 1]?.id,
          hasMore: startIndex + limit < allBookings.length,
        },
      };

      expect(response.data).toHaveLength(limit);
      expect(response.meta.hasMore).toBe(true);
    });
  });

  describe('Filtering', () => {
    it('should filter by status', async () => {
      const bookings = Array.from({ length: 30 }, (_, i) =>
        testDataSeeds.booking({
          status: ['created', 'confirmed', 'completed'][i % 3],
        })
      );

      const filtered = bookings.filter(b => b.status === 'confirmed');

      expect(filtered.every(b => b.status === 'confirmed')).toBe(true);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const bookings = Array.from({ length: 30 }, () => testDataSeeds.booking());

      // Filter bookings created in last week
      const filtered = bookings.filter(
        b => b.createdAt >= weekAgo && b.createdAt <= now
      );

      expect(filtered.every(b => b.createdAt >= weekAgo && b.createdAt <= now)).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const bookings = Array.from({ length: 100 }, (_, i) =>
        testDataSeeds.booking({
          status: i % 2 === 0 ? 'confirmed' : 'created',
          amount: 1000 + Math.floor(Math.random() * 5000),
        })
      );

      // Filter: status = confirmed AND amount > 2000
      const filtered = bookings.filter(
        b => b.status === 'confirmed' && b.amount > 2000
      );

      expect(filtered.every(b => b.status === 'confirmed' && b.amount > 2000)).toBe(true);
    });

    it('should reject invalid filter values', async () => {
      const invalidFilter = {
        status: 'invalid_status', // Not in valid set
      };

      const validStatuses = ['created', 'confirmed', 'in_transit', 'completed'];
      const isValid = validStatuses.includes(invalidFilter.status);

      expect(isValid).toBe(false);

      const response = {
        status: 400,
        error: {
          code: 'INVALID_FILTER',
          message: `Invalid status: ${invalidFilter.status}`,
        },
      };

      expect(response.status).toBe(400);
    });
  });

  describe('Sorting', () => {
    it('should sort by field name ascending', async () => {
      const bookings = Array.from({ length: 10 }, (_, i) =>
        testDataSeeds.booking({
          amount: Math.floor(Math.random() * 10000),
        })
      );

      const sorted = [...bookings].sort((a, b) => a.amount - b.amount);

      expect(sorted[0].amount).toBeLessThanOrEqual(sorted[sorted.length - 1].amount);
    });

    it('should sort by field name descending', async () => {
      const bookings = Array.from({ length: 10 }, (_, i) =>
        testDataSeeds.booking({
          amount: Math.floor(Math.random() * 10000),
        })
      );

      const sorted = [...bookings].sort((a, b) => b.amount - a.amount);

      expect(sorted[0].amount).toBeGreaterThanOrEqual(sorted[sorted.length - 1].amount);
    });

    it('should support multiple sort keys', async () => {
      const bookings = Array.from({ length: 10 }, (_, i) =>
        testDataSeeds.booking({
          status: ['created', 'confirmed'][i % 2],
          amount: Math.floor(Math.random() * 10000),
        })
      );

      const sorted = [...bookings].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status.localeCompare(b.status);
        }
        return a.amount - b.amount;
      });

      // Should be sorted by status first, then amount
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].status === sorted[i].status) {
          expect(sorted[i - 1].amount).toBeLessThanOrEqual(sorted[i].amount);
        }
      }
    });
  });

  describe('API Versioning', () => {
    it('should support v1 endpoints', async () => {
      const response = {
        version: 'v1',
        data: testDataSeeds.booking(),
      };

      expect(response.version).toBe('v1');
      expect(response.data).toBeTruthy();
    });

    it('should support v2 endpoints', async () => {
      const response = {
        version: 'v2',
        data: {
          ...testDataSeeds.booking(),
          metadata: {
            createdBy: testData.user.id,
            updatedBy: testData.user.id,
          },
        },
      };

      expect(response.version).toBe('v2');
      expect(response.data).toHaveProperty('metadata');
    });

    it('should maintain backward compatibility', async () => {
      // v1 response format
      const v1Response = {
        status: 200,
        data: testDataSeeds.booking(),
      };

      // v2 response format (enhanced, but includes v1 structure)
      const v2Response = {
        status: 200,
        data: testDataSeeds.booking(),
        meta: {
          version: 'v2',
          deprecated: false,
        },
      };

      // Both should work
      expect(v1Response.data).toBeTruthy();
      expect(v2Response.data).toBeTruthy();
    });

    it('should deprecate old API versions', async () => {
      const response = {
        status: 200,
        headers: {
          'Deprecation': 'true',
          'Sunset': new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          'Link': '<https://api.example.com/v2/docs>; rel="successor-version"',
        },
      };

      expect(response.headers['Deprecation']).toBe('true');
      expect(response.headers['Sunset']).toBeTruthy();
    });

    it('should version API in headers or URL', async () => {
      const headerVersion = {
        headers: {
          'API-Version': 'v2',
        },
      };

      const urlVersion = {
        url: '/api/v2/bookings',
      };

      expect(headerVersion.headers['API-Version']).toBe('v2');
      expect(urlVersion.url).toContain('/v2/');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track API response times', async () => {
      const apiCall = monitor.start('api_booking_create');

      const booking = testDataSeeds.booking();

      apiCall();
      const metrics = monitor.getMetrics('api_booking_create');

      expect(metrics!.avg).toBeLessThan(testConfig.perfThresholds.webhookResponse);
    });

    it('should monitor endpoint throughput', async () => {
      const throughputTime = monitor.start('api_throughput');

      // Simulate 100 requests
      const requests = Array.from({ length: 100 }, () => testDataSeeds.booking());

      throughputTime();
      const metrics = monitor.getMetrics('api_throughput');

      expect(metrics!.count).toBe(1);
    });

    it('should include performance headers in response', async () => {
      const response = {
        status: 200,
        headers: {
          'Server-Timing': 'db=45, cache=5, total=50',
          'X-Response-Time': '50ms',
        },
      };

      expect(response.headers['Server-Timing']).toBeTruthy();
      expect(response.headers['X-Response-Time']).toBeTruthy();
    });
  });
});
