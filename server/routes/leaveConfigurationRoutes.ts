/**
 * LEAVE CONFIGURATION ROUTES
 * REST API endpoints for managing leave policies
 */

import express, { Router, Request, Response } from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import { z } from 'zod';
import {
  getLeaveConfiguration,
  updateLeaveConfiguration,
  updatePaidLeavePolicy,
  updateUnpaidLeavePolicy,
  updateWeeklyOffPolicy,
  addHoliday,
  removeHoliday,
  isHoliday,
  validateLeaveRequest,
} from '../services/leaveConfigurationService';
import { Logger } from '../utils/logger';

const router: Router = express.Router();
const logger = new Logger('LeaveConfigRoutes');

// Validation schemas
const paidLeavePolicySchema = z.object({
  annualQuota: z.number().min(0).max(365),
  accrualType: z.enum(['fixed', 'monthly', 'quarterly']),
  accrualValue: z.number().min(0),
  carryForwardAllowed: z.boolean(),
  maxCarryForward: z.number().min(0),
  expiryMonths: z.number().min(0),
});

const unpaidLeavePolicySchema = z.object({
  allowUnpaid: z.boolean(),
  maxConsecutiveDays: z.number().min(0),
  requireApproval: z.boolean(),
  deductionType: z.enum(['full', 'half', 'none']),
});

const weeklyOffPolicySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  alternateWeeklyOff: z.boolean(),
  alternatePattern: z.enum(['first_second', 'weekly_rotation']),
  compensatoryOffAllowed: z.boolean(),
  compOffExpiryDays: z.number().min(0),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
});

const validateLeaveRequestSchema = z.object({
  leaveType: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  dayPart: z.string().optional(),
});

/**
 * GET /api/leave-configuration
 * Get current leave configuration for tenant
 */
router.get('/', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const config = await getLeaveConfiguration(tenantId);

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error(`Failed to get leave configuration: ${error}`);
    res.status(500).json({
      error: 'Failed to fetch leave configuration',
    });
  }
});

/**
 * PUT /api/leave-configuration
 * Update entire leave configuration
 */
router.put('/', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const updates = req.body;

    const config = await updateLeaveConfiguration(tenantId, updates);

    res.json({
      success: true,
      data: config,
      message: 'Leave configuration updated successfully',
    });
  } catch (error) {
    logger.error(`Failed to update leave configuration: ${error}`);
    res.status(500).json({
      error: 'Failed to update leave configuration',
    });
  }
});

/**
 * PUT /api/leave-configuration/paid-leave-policy
 * Update paid leave policy
 */
router.put(
  '/paid-leave-policy',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;

      // Validate request
      const validation = paidLeavePolicySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid policy data',
          details: validation.error.errors,
        });
      }

      const config = await updatePaidLeavePolicy(tenantId, validation.data);

      res.json({
        success: true,
        data: config,
        message: 'Paid leave policy updated successfully',
      });
    } catch (error) {
      logger.error(`Failed to update paid leave policy: ${error}`);
      res.status(500).json({
        error: 'Failed to update paid leave policy',
      });
    }
  }
);

/**
 * PUT /api/leave-configuration/unpaid-leave-policy
 * Update unpaid leave policy
 */
router.put(
  '/unpaid-leave-policy',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;

      // Validate request
      const validation = unpaidLeavePolicySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid policy data',
          details: validation.error.errors,
        });
      }

      const config = await updateUnpaidLeavePolicy(tenantId, validation.data);

      res.json({
        success: true,
        data: config,
        message: 'Unpaid leave policy updated successfully',
      });
    } catch (error) {
      logger.error(`Failed to update unpaid leave policy: ${error}`);
      res.status(500).json({
        error: 'Failed to update unpaid leave policy',
      });
    }
  }
);

/**
 * PUT /api/leave-configuration/weekly-off-policy
 * Update weekly off policy
 */
router.put(
  '/weekly-off-policy',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;

      // Validate request
      const validation = weeklyOffPolicySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid policy data',
          details: validation.error.errors,
        });
      }

      const config = await updateWeeklyOffPolicy(tenantId, validation.data);

      res.json({
        success: true,
        data: config,
        message: 'Weekly off policy updated successfully',
      });
    } catch (error) {
      logger.error(`Failed to update weekly off policy: ${error}`);
      res.status(500).json({
        error: 'Failed to update weekly off policy',
      });
    }
  }
);

/**
 * POST /api/leave-configuration/holidays
 * Add a holiday
 */
router.post('/holidays', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    // Validate request
    const validation = holidaySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid holiday data',
        details: validation.error.errors,
      });
    }

    const config = await addHoliday(tenantId, validation.data.date, validation.data.name);

    res.json({
      success: true,
      data: config,
      message: 'Holiday added successfully',
    });
  } catch (error) {
    logger.error(`Failed to add holiday: ${error}`);
    res.status(500).json({
      error: 'Failed to add holiday',
    });
  }
});

/**
 * DELETE /api/leave-configuration/holidays/:date
 * Remove a holiday
 */
router.delete(
  '/holidays/:date',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { date } = req.params;

      const config = await removeHoliday(tenantId, date);

      res.json({
        success: true,
        data: config,
        message: 'Holiday removed successfully',
      });
    } catch (error) {
      logger.error(`Failed to remove holiday: ${error}`);
      res.status(500).json({
        error: 'Failed to remove holiday',
      });
    }
  }
);

/**
 * GET /api/leave-configuration/is-holiday/:date
 * Check if a date is a holiday
 */
router.get(
  '/is-holiday/:date',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { date } = req.params;

      const holiday = await isHoliday(tenantId, date);

      res.json({
        success: true,
        data: { date, isHoliday: holiday },
      });
    } catch (error) {
      logger.error(`Failed to check holiday: ${error}`);
      res.status(500).json({
        error: 'Failed to check holiday',
      });
    }
  }
);

/**
 * POST /api/leave-configuration/validate-leave-request
 * Validate a leave request against configuration
 */
router.post(
  '/validate-leave-request',
  authenticateUser,
  requireTenant,
  async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;

      // Validate request
      const validation = validateLeaveRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid leave request data',
          details: validation.error.errors,
        });
      }

      const result = await validateLeaveRequest(tenantId, validation.data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`Failed to validate leave request: ${error}`);
      res.status(500).json({
        error: 'Failed to validate leave request',
      });
    }
  }
);

export default router;
