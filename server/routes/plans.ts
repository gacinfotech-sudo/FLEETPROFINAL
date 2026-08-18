/**
 * PHASE 2: Plan Management Routes
 * Endpoints for managing subscription plans (PLATFORM_ROOT only)
 * Tenants can view available plans but not create/modify
 */

import { Router, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../middleware/auth';
import { storage } from '../storage-mongodb';
import type { PlatformRole } from '../root/types';
import { isPlatformRole } from '../root/types';

const router = Router();

/**
 * Middleware: Require PLATFORM_ROOT role for admin endpoints
 */
function requirePlatformRoot(req: AuthRequest, res: Response, next: Function) {
  if (req.user?.platformRole !== 'PLATFORM_ROOT') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: PLATFORM_ROOT role required',
    });
  }
  next();
}

// ============================================================================
// PUBLIC ENDPOINTS (Available to all tenants)
// ============================================================================

/**
 * GET /api/plans
 * List all active plans available for subscription/upgrade
 */
router.get('/', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const plans = await storage.listPlans({ status: 'active', isActive: true });

    const planList = plans.map(plan => ({
      id: plan._id,
      name: plan.name,
      code: plan.code,
      description: plan.description,
      pricing: plan.pricing,
      limits: plan.limits,
      features: plan.features,
      trial: plan.trial,
      billingCycles: plan.billingCycles,
      displayOrder: plan.displayOrder,
    }));

    res.json({
      success: true,
      data: {
        plans: planList,
        count: planList.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans',
    });
  }
});

/**
 * GET /api/plans/:code
 * Get single plan by code
 */
router.get('/:code', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const plan = await storage.getPlanByCode(req.params.code);

    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found',
      });
    }

    res.json({
      success: true,
      data: { plan },
    });
  } catch (error: any) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan',
    });
  }
});

// ============================================================================
// ADMIN ENDPOINTS (PLATFORM_ROOT only)
// ============================================================================

/**
 * GET /api/admin/plans
 * List all plans (including archived and draft) - Admin only
 */
router.get(
  '/admin/all',
  authenticateUser,
  requirePlatformRoot,
  async (req: AuthRequest, res: Response) => {
    try {
      const plans = await storage.listPlans();

      res.json({
        success: true,
        data: {
          plans,
          count: plans.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching all plans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch plans',
      });
    }
  }
);

/**
 * POST /api/admin/plans
 * Create a new subscription plan
 */
router.post(
  '/admin',
  authenticateUser,
  requirePlatformRoot,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, code, description, pricing, limits, features, trial, billingCycles, displayOrder } = req.body;

      if (!name || !code) {
        return res.status(400).json({
          success: false,
          error: 'Name and code are required',
        });
      }

      // Check if code already exists
      const existing = await storage.getPlanByCode(code);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Plan code '${code}' already exists`,
        });
      }

      const plan = await storage.createPlan({
        name,
        code,
        description,
        pricing,
        limits,
        features,
        trial,
        billingCycles,
        displayOrder,
        createdBy: {
          userId: req.userId!,
          platformRole: req.user?.platformRole || 'UNKNOWN',
        },
      });

      res.status(201).json({
        success: true,
        message: 'Plan created successfully',
        data: { plan },
      });
    } catch (error: any) {
      console.error('Error creating plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create plan',
      });
    }
  }
);

/**
 * PUT /api/admin/plans/:id
 * Update a subscription plan
 */
router.put(
  '/admin/:id',
  authenticateUser,
  requirePlatformRoot,
  async (req: AuthRequest, res: Response) => {
    try {
      const plan = await storage.updatePlan(req.params.id, {
        ...req.body,
        updatedBy: {
          userId: req.userId!,
          platformRole: req.user?.platformRole || 'UNKNOWN',
        },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found',
        });
      }

      res.json({
        success: true,
        message: 'Plan updated successfully',
        data: { plan },
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update plan',
      });
    }
  }
);

/**
 * DELETE /api/admin/plans/:id
 * Archive/Delete a plan (soft delete - set to archived status)
 */
router.delete(
  '/admin/:id',
  authenticateUser,
  requirePlatformRoot,
  async (req: AuthRequest, res: Response) => {
    try {
      // Soft delete - mark as archived
      const plan = await storage.updatePlan(req.params.id, {
        status: 'archived',
        isActive: false,
        updatedBy: {
          userId: req.userId!,
          platformRole: req.user?.platformRole || 'UNKNOWN',
        },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found',
        });
      }

      res.json({
        success: true,
        message: 'Plan archived successfully',
      });
    } catch (error: any) {
      console.error('Error archiving plan:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to archive plan',
      });
    }
  }
);

/**
 * POST /api/admin/plans/seed
 * Seed default plans (one-time operation)
 */
router.post(
  '/admin/seed-defaults',
  authenticateUser,
  requirePlatformRoot,
  async (req: AuthRequest, res: Response) => {
    try {
      await storage.seedDefaultPlans();

      res.json({
        success: true,
        message: 'Default plans seeded successfully',
      });
    } catch (error: any) {
      console.error('Error seeding plans:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to seed plans',
      });
    }
  }
);

export default router;
