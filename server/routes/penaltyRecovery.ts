/**
 * PENALTY & RECOVERY MANAGEMENT ROUTES
 * RESTful API endpoints for penalty and recovery operations
 */

import { Router, Request, Response } from 'express';
import { requireAuth, checkTenantAccess } from '../middleware/auth';
import {
  createPenalty,
  approvePenalty,
  getPenalties,
  createRecovery,
  recordRecoveryPayment,
  getRecoveries,
  getPenaltyRecoveryStats,
  generateReport,
} from '../services/penaltyRecoveryService';

const router = Router();

// Middleware
router.use(requireAuth);

/**
 * POST /api/penalties
 * Create a new penalty
 */
router.post('/penalties', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const {
      driverId,
      penaltyType,
      amount,
      reason,
      deductionMode,
      installments,
      notes,
    } = req.body;

    if (!driverId || !penaltyType || !amount || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const penalty = await createPenalty({
      tenantId: req.tenantId!,
      driverId,
      penaltyType,
      amount,
      reason,
      deductionMode,
      installments,
      notes,
      createdBy: {
        userId: req.user?.id || 'unknown',
        role: req.user?.role || 'admin',
      },
    });

    res.status(201).json(penalty);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create penalty' });
  }
});

/**
 * GET /api/penalties
 * Get penalties with filters
 */
router.get('/penalties', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { driverId, status, month, year, penaltyType } = req.query;

    const filters: any = { tenantId: req.tenantId };
    if (driverId) filters.driverId = driverId;
    if (status) filters.status = status;
    if (month) filters.month = Number(month);
    if (year) filters.year = Number(year);
    if (penaltyType) filters.penaltyType = penaltyType;

    const penalties = await getPenalties(filters);
    res.json(penalties);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch penalties' });
  }
});

/**
 * POST /api/penalties/:id/approve
 * Approve a penalty
 */
router.post('/penalties/:id/approve', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Penalty ID is required' });
    }

    const penalty = await approvePenalty(id, {
      userId: req.user?.id || 'unknown',
      role: req.user?.role || 'admin',
    });

    res.json(penalty);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve penalty' });
  }
});

/**
 * POST /api/recoveries
 * Create a new recovery
 */
router.post('/recoveries', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const {
      driverId,
      recoveryType,
      amount,
      description,
      recoveryMode,
      installments,
      startDate,
    } = req.body;

    if (!driverId || !recoveryType || !amount || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const recovery = await createRecovery({
      tenantId: req.tenantId!,
      driverId,
      recoveryType,
      amount,
      description,
      recoveryMode,
      installments,
      startDate: startDate ? new Date(startDate) : undefined,
      createdBy: {
        userId: req.user?.id || 'unknown',
        role: req.user?.role || 'admin',
      },
    });

    res.status(201).json(recovery);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create recovery' });
  }
});

/**
 * GET /api/recoveries
 * Get recoveries with filters
 */
router.get('/recoveries', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { driverId, status, recoveryType } = req.query;

    const filters: any = { tenantId: req.tenantId };
    if (driverId) filters.driverId = driverId;
    if (status) filters.status = status;
    if (recoveryType) filters.recoveryType = recoveryType;

    const recoveries = await getRecoveries(filters);
    res.json(recoveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch recoveries' });
  }
});

/**
 * POST /api/recoveries/:id/payment
 * Record a recovery payment
 */
router.post('/recoveries/:id/payment', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;

    if (!id || !paidAmount) {
      return res.status(400).json({ error: 'Recovery ID and paid amount are required' });
    }

    const updated = await recordRecoveryPayment(id, paidAmount, {
      userId: req.user?.id || 'unknown',
      role: req.user?.role || 'admin',
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record recovery payment' });
  }
});

/**
 * GET /api/penalties-recoveries/stats
 * Get penalty and recovery statistics
 */
router.get('/penalties-recoveries/stats', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { driverId, month, year } = req.query;

    const filters: any = { tenantId: req.tenantId };
    if (driverId) filters.driverId = driverId;
    if (month) filters.month = Number(month);
    if (year) filters.year = Number(year);

    const stats = await getPenaltyRecoveryStats(filters);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/penalties-recoveries/report
 * Generate penalty and recovery report
 */
router.get('/penalties-recoveries/report', checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { driverId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const filters: any = {
      tenantId: req.tenantId,
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };

    if (driverId) filters.driverId = driverId;

    const report = await generateReport(filters);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
