// Notification Rate Limiting API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationRateLimiter, RateLimitWindow } from '../utils/notificationRateLimiter';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationRateLimitAPI');
const router = express.Router();

// POST /api/notification-rate-limit/policies
// Create rate limit policy (admin only)
router.post('/policies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, scope, window, maxRequests } = req.body;

    if (!name || !scope || !window || maxRequests === undefined) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name, scope, window, and maxRequests are required'
      });
    }

    if (!Object.values(RateLimitWindow).includes(window)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: `window must be one of: ${Object.values(RateLimitWindow).join(', ')}`
      });
    }

    const policyId = await notificationRateLimiter.createPolicy({
      name,
      scope,
      window,
      maxRequests,
      status: 'active'
    });

    log.info('Rate limit policy created via API', { policyId, name });

    res.json({
      success: true,
      message: 'Rate limit policy created successfully',
      policyId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to create rate limit policy', { error });
    res.status(500).json({
      error: 'Failed to create rate limit policy',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-rate-limit/policies
// List rate limit policies (admin only)
router.get('/policies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scope, status } = req.query;

    const policies = await notificationRateLimiter.getPolicies(scope as string, status as string);

    log.info('Rate limit policies listed', { count: policies.length });

    res.json({
      success: true,
      policies,
      count: policies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to list rate limit policies', { error });
    res.status(500).json({
      error: 'Failed to list rate limit policies',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-rate-limit/check
// Check if notification would be rate limited (admin debugging)
router.post('/check', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, category, channel } = req.body;

    if (!userId || !category || !channel) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId, category, and channel are required'
      });
    }

    const result = await notificationRateLimiter.checkRateLimit(userId, category, channel);

    log.info('Rate limit check performed', { userId, category, channel, allowed: result.allowed });

    res.json({
      success: true,
      allowed: result.allowed,
      tokensRemaining: result.tokensRemaining,
      resetTime: result.resetTime,
      retryAfterSeconds: result.retryAfterSeconds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to check rate limit', { error });
    res.status(500).json({
      error: 'Failed to check rate limit',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-rate-limit/stats
// Get rate limiting statistics (admin only)
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationRateLimiter.getRateLimitStats();

    log.info('Rate limit stats retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get rate limit stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

export default router;
