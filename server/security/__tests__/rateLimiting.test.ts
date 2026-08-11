import {
  RateLimiter,
  createLoginRateLimiter,
  createPerUserRateLimiter,
  createPerChannelRateLimiter,
  createPerTriggerRateLimiter,
  createIPBasedRateLimiter,
  createWebhookRateLimiter,
  AdaptiveRateLimiter,
} from '../rateLimiting';
import { Request, Response } from 'express';

/**
 * Mock Request and Response for testing
 */
function createMockRequest(ip: string = '127.0.0.1'): any {
  return {
    ip,
    body: {},
    query: {},
    user: { id: 'test-user' },
  };
}

function createMockResponse(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
}

describe('RateLimiter', () => {
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      for (let i = 0; i < 5; i++) {
        const allowed = await limiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }
    });

    it('should block requests exceeding limit', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      // First 3 requests should pass
      for (let i = 0; i < 3; i++) {
        const allowed = await limiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }

      // 4th request should fail
      const allowed = await limiter.checkLimit(req, res);
      expect(allowed).toBe(false);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should use custom key generator', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: (req: any) => req.user.id,
      });

      const req1 = createMockRequest();
      req1.user.id = 'user1';

      const req2 = createMockRequest();
      req2.user.id = 'user2';

      const res = createMockResponse();

      // User1: 2 requests allowed
      await limiter.checkLimit(req1, res);
      await limiter.checkLimit(req1, res);
      let allowed = await limiter.checkLimit(req1, res);
      expect(allowed).toBe(false);

      // User2: 2 requests allowed independently
      allowed = await limiter.checkLimit(req2, res);
      expect(allowed).toBe(true);
      allowed = await limiter.checkLimit(req2, res);
      expect(allowed).toBe(true);
      allowed = await limiter.checkLimit(req2, res);
      expect(allowed).toBe(false);
    });

    it('should set proper rate limit headers', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await limiter.checkLimit(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });
  });

  describe('Login Rate Limiter', () => {
    it('should enforce login rate limits', async () => {
      const limiter = createLoginRateLimiter();
      const middleware = limiter.middleware();

      const req = createMockRequest('192.168.1.1');
      const res = createMockResponse();
      let nextCalled = false;

      const next = () => {
        nextCalled = true;
      };

      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        nextCalled = false;
        await middleware(req, res, next);
        expect(nextCalled).toBe(true);
      }

      // 6th request should fail
      nextCalled = false;
      await middleware(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should rate limit per IP', async () => {
      const limiter = createLoginRateLimiter();

      const req1 = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.2');
      const res = createMockResponse();

      // IP1: Should be able to make 5 requests
      for (let i = 0; i < 5; i++) {
        const allowed = await limiter.checkLimit(req1, res);
        expect(allowed).toBe(i < 5);
      }

      // IP2: Should have independent limit
      for (let i = 0; i < 5; i++) {
        const allowed = await limiter.checkLimit(req2, res);
        expect(allowed).toBe(i < 5);
      }
    });
  });

  describe('Per-User Rate Limiter', () => {
    it('should rate limit per user', async () => {
      const limiter = createPerUserRateLimiter();

      const req = createMockRequest();
      req.user.id = 'user123';
      const res = createMockResponse();

      let allowed: boolean;
      for (let i = 0; i < 30; i++) {
        allowed = await limiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }

      // 31st request should fail
      allowed = await limiter.checkLimit(req, res);
      expect(allowed).toBe(false);
    });
  });

  describe('Per-Channel Rate Limiter', () => {
    it('should rate limit per channel', async () => {
      const emailLimiter = createPerChannelRateLimiter('email');
      const smgLimiter = createPerChannelRateLimiter('sms');

      const req = createMockRequest();
      req.user.id = 'user123';
      const res = createMockResponse();

      // Email: 10 requests allowed
      for (let i = 0; i < 10; i++) {
        const allowed = await emailLimiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }

      // 11th email request should fail
      let allowed = await emailLimiter.checkLimit(req, res);
      expect(allowed).toBe(false);

      // SMS: Should have independent limit
      for (let i = 0; i < 10; i++) {
        allowed = await smgLimiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }
    });
  });

  describe('Per-Trigger Rate Limiter', () => {
    it('should rate limit per trigger event', async () => {
      const bookingTrigger = createPerTriggerRateLimiter('booking.created');
      const paymentTrigger = createPerTriggerRateLimiter('payment.processed');

      const req = createMockRequest();
      req.user.id = 'user123';
      const res = createMockResponse();

      // Booking trigger: 5 requests allowed
      for (let i = 0; i < 5; i++) {
        const allowed = await bookingTrigger.checkLimit(req, res);
        expect(allowed).toBe(true);
      }

      // 6th booking trigger request should fail
      let allowed = await bookingTrigger.checkLimit(req, res);
      expect(allowed).toBe(false);

      // Payment trigger: Should have independent limit
      for (let i = 0; i < 5; i++) {
        allowed = await paymentTrigger.checkLimit(req, res);
        expect(allowed).toBe(true);
      }
    });
  });

  describe('Webhook Rate Limiter', () => {
    it('should handle high webhook traffic', async () => {
      const limiter = createWebhookRateLimiter('webhook-123');
      const req = createMockRequest();
      const res = createMockResponse();

      // Webhooks can handle 100 requests per minute
      for (let i = 0; i < 100; i++) {
        const allowed = await limiter.checkLimit(req, res);
        expect(allowed).toBe(true);
      }

      // 101st request should fail
      const allowed = await limiter.checkLimit(req, res);
      expect(allowed).toBe(false);
    });
  });

  describe('Adaptive Rate Limiter', () => {
    it('should create adaptive rate limiter', () => {
      const limiter = new AdaptiveRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
      });

      const middleware = limiter.middleware();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle custom error handler', async () => {
      const customHandler = jest.fn();
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        handler: customHandler,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      // First request passes
      await limiter.checkLimit(req, res);

      // Second request triggers handler
      await limiter.checkLimit(req, res);
      expect(customHandler).toHaveBeenCalled();
    });
  });
});

describe('Rate Limiter Security', () => {
  describe('DDoS Protection', () => {
    it('should protect against rapid requests', async () => {
      const limiter = createIPBasedRateLimiter(100);
      const req = createMockRequest('192.168.1.100');
      const res = createMockResponse();

      // Simulate DDoS: 150 requests
      let blockedCount = 0;
      for (let i = 0; i < 150; i++) {
        const allowed = await limiter.checkLimit(req, res);
        if (!allowed) blockedCount++;
      }

      // Should block after 100 requests
      expect(blockedCount).toBeGreaterThan(0);
    });

    it('should isolate attack per IP', async () => {
      const limiter = createIPBasedRateLimiter(10);
      const res = createMockResponse();

      const attackIP = '192.168.1.100';
      const normalIP = '192.168.1.200';

      // Attack from one IP
      for (let i = 0; i < 15; i++) {
        const req = createMockRequest(attackIP);
        await limiter.checkLimit(req, res);
      }

      // Normal traffic from other IP should work
      const normalReq = createMockRequest(normalIP);
      const allowed = await limiter.checkLimit(normalReq, res);
      expect(allowed).toBe(true);
    });
  });

  describe('Injection Attack Prevention', () => {
    it('should not be vulnerable to key injection', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: (req: any) => req.user.id,
      });

      const req = createMockRequest();
      req.user.id = 'user1"; DROP TABLE users; --';
      const res = createMockResponse();

      // Should handle malicious key safely
      const allowed = await limiter.checkLimit(req, res);
      expect(typeof allowed).toBe('boolean');
    });
  });
});
