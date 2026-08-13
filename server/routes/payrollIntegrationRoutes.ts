/**
 * PAYROLL INTEGRATION ROUTES
 * REST API endpoints for linking salary calculations to ledger entries
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { z } from 'zod';
import {
  linkSalaryToLedger,
  linkBatchSalariesToLedger,
  linkMonthlyPayrollToLedger,
  reconcileSalaryLedger,
  getPayrollIntegrationReport,
  extractSalaryComponentBreakdown
} from '../services/payrollIntegrationService';
import { DriverSalary } from '../models/index';
import mongoose from 'mongoose';

const router = Router();

/**
 * Validation schemas
 */
const linkSalarySchema = z.object({
  salaryId: z.string().min(1, 'Salary ID is required'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020)
});

const linkMonthlyPayrollSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020)
});

const reconcileSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2020)
});

/**
 * GET /api/payroll/integration/status/:month/:year
 * Get integration status for a payroll period
 */
router.get(
  '/status/:month/:year',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const report = await getPayrollIntegrationReport(
        tenantId,
        parseInt(month),
        parseInt(year)
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get integration status'
      });
    }
  }
);

/**
 * POST /api/payroll/integration/link-salary
 * Link a single salary calculation to ledger entries
 */
router.post(
  '/link-salary',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  validateRequest(linkSalarySchema),
  async (req: Request, res: Response) => {
    try {
      const { salaryId, month, year } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Fetch salary record
      const salary = await DriverSalary.findById(salaryId);
      if (!salary) {
        return res.status(404).json({ error: 'Salary record not found' });
      }

      // Verify salary belongs to tenant
      if (salary.tenantId.toString() !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized access to salary record' });
      }

      // Link salary to ledger
      const result = await linkSalaryToLedger(
        salary,
        tenantId,
        month,
        year,
        {
          userId,
          role: req.user?.role || 'user'
        }
      );

      res.json({
        success: result.status === 'success',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to link salary to ledger'
      });
    }
  }
);

/**
 * POST /api/payroll/integration/link-monthly
 * Link all salaries for a month to ledger entries
 */
router.post(
  '/link-monthly',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  validateRequest(linkMonthlyPayrollSchema),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.userId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Link monthly payroll to ledger
      const { results, summary } = await linkMonthlyPayrollToLedger(
        tenantId,
        month,
        year,
        {
          userId,
          role: req.user?.role || 'user'
        }
      );

      res.json({
        success: summary.failedCount === 0,
        data: {
          results,
          summary
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to link monthly payroll to ledger'
      });
    }
  }
);

/**
 * POST /api/payroll/integration/reconcile
 * Reconcile salary calculations with ledger entries
 */
router.post(
  '/reconcile',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  validateRequest(reconcileSchema),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const reconciliation = await reconcileSalaryLedger(tenantId, month, year);

      res.json({
        success: reconciliation.salariesWithoutLedger === 0,
        data: reconciliation
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reconcile salary and ledger'
      });
    }
  }
);

/**
 * GET /api/payroll/integration/salary-breakdown/:salaryId
 * Get salary component breakdown for a specific salary
 */
router.get(
  '/salary-breakdown/:salaryId',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  async (req: Request, res: Response) => {
    try {
      const { salaryId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Fetch salary record
      const salary = await DriverSalary.findById(salaryId);
      if (!salary) {
        return res.status(404).json({ error: 'Salary record not found' });
      }

      // Verify salary belongs to tenant
      if (salary.tenantId.toString() !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized access to salary record' });
      }

      // Extract breakdown
      const breakdown = extractSalaryComponentBreakdown(salary);

      res.json({
        success: true,
        data: {
          salaryId: salary._id,
          driverId: salary.driverId,
          driverName: salary.driverName,
          month: salary.salaryPeriodStart?.getMonth() || 0 + 1,
          year: salary.salaryPeriodStart?.getFullYear() || 0,
          breakdown
        }
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get salary breakdown'
      });
    }
  }
);

/**
 * GET /api/payroll/integration/report/:month/:year
 * Get detailed integration report for a payroll period
 */
router.get(
  '/report/:month/:year',
  authenticate,
  authorize(['admin', 'finance', 'payroll_manager']),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const report = await getPayrollIntegrationReport(
        tenantId,
        parseInt(month),
        parseInt(year)
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get integration report'
      });
    }
  }
);

export default router;
