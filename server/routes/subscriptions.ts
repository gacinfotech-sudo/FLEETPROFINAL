import { Router, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage-mongodb';

const router = Router();

// ============================================================================
// TENANT SUBSCRIPTION ENDPOINTS (Phase 3)
// ============================================================================

/**
 * GET /api/subscription
 * Get current tenant's subscription
 */
router.get('/', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await storage.getSubscriptionByTenant(req.tenantId!);

    if (!subscription) {
      return res.json({
        success: true,
        data: { subscription: null, message: 'No active subscription' },
      });
    }

    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription._id,
          tenantId: subscription.tenantId,
          plan: (subscription.planId as any)?.name || 'Unknown',
          planId: subscription.planId,
          status: subscription.status,
          startDate: subscription.startDate,
          renewalDate: subscription.renewalDate,
          billingCycle: subscription.billingCycle,
          isTrial: subscription.isTrial,
          trialEndsAt: subscription.trialEndsAt,
          autoRenew: subscription.autoRenew,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscription/create-trial
 * Create a trial subscription for tenant (on signup)
 */
router.post('/create-trial', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { planCode } = req.body;

    if (!planCode) {
      return res.status(400).json({ success: false, error: 'Plan code required' });
    }

    const plan = await storage.getPlanByCode(planCode);
    if (!plan || !plan.trial.enabled) {
      return res.status(400).json({ success: false, error: 'Trial not available for this plan' });
    }

    // Check if subscription already exists
    const existing = await storage.getSubscriptionByTenant(req.tenantId!);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Subscription already exists' });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trial.daysCount);

    const subscription = await storage.createSubscription({
      tenantId: req.tenantId!,
      planId: plan._id,
      status: 'TRIAL',
      isTrial: true,
      trialEndsAt,
      renewalDate: trialEndsAt,
      billingCycle: 'monthly',
    });

    res.status(201).json({
      success: true,
      message: `Trial activated for ${plan.trial.daysCount} days`,
      data: { subscription },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to create trial' });
  }
});

/**
 * POST /api/subscription/upgrade
 * Upgrade tenant's subscription to different plan
 */
router.post('/upgrade', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const { planCode, billingCycle } = req.body;

    if (!planCode) {
      return res.status(400).json({ success: false, error: 'Plan code required' });
    }

    const plan = await storage.getPlanByCode(planCode);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    // Get or create subscription
    let subscription = await storage.getSubscriptionByTenant(req.tenantId!);

    if (!subscription) {
      // Create new subscription
      const renewalDate = new Date();
      if (billingCycle === 'annual') {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      }

      subscription = await storage.createSubscription({
        tenantId: req.tenantId!,
        planId: plan._id,
        status: 'PAYMENT_PENDING',
        billingCycle: billingCycle || 'annual',
        renewalDate,
      });
    } else {
      // Update subscription
      const renewalDate = new Date();
      if (billingCycle === 'annual') {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
      }

      subscription = await storage.updateSubscription(subscription._id.toString(), {
        planId: plan._id,
        status: 'PAYMENT_PENDING',
        billingCycle: billingCycle || 'annual',
        renewalDate,
      });
    }

    res.json({
      success: true,
      message: 'Upgrade request created. Awaiting payment.',
      data: { subscription, plan },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to upgrade subscription' });
  }
});

/**
 * POST /api/subscription/activate
 * Activate subscription after payment (called by payment webhook)
 */
router.post('/activate', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await storage.getSubscriptionByTenant(req.tenantId!);

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'No pending subscription' });
    }

    const updated = await storage.updateSubscription(subscription._id.toString(), {
      status: 'ACTIVE',
      lastPaymentDate: new Date(),
    });

    res.json({
      success: true,
      message: 'Subscription activated',
      data: { subscription: updated },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to activate subscription' });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateUser, requireTenant, async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await storage.getSubscriptionByTenant(req.tenantId!);

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'No active subscription' });
    }

    const updated = await storage.updateSubscription(subscription._id.toString(), {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      autoRenew: false,
    });

    res.json({
      success: true,
      message: 'Subscription cancelled',
      data: { subscription: updated },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

/**
 * GET /api/admin/subscriptions
 * Admin endpoint to list all subscriptions
 */
router.get('/admin/all', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const subscriptions = await storage.listSubscriptions();

    res.json({
      success: true,
      data: { subscriptions, count: subscriptions.length },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

export default router;
