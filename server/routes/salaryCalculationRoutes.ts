import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  calculateMonthlySalary,
  calculateTeamSalaries,
  calculateTeamSalaryStatistics,
  formatSalaryCalculation,
  validateSalaryCalculation,
  MonthlySalaryCalculation
} from '../services/salaryCoreCalculationService';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const calculateSalarySchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID required'),
  driverId: z.string().min(1, 'Driver ID required'),
  month: z.number().min(1).max(12, 'Month must be 1-12'),
  year: z.number().min(2020).max(2099, 'Year must be 2020-2099')
}).strict();

const calculateTeamSalarySchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID required'),
  month: z.number().min(1).max(12, 'Month must be 1-12'),
  year: z.number().min(2020).max(2099, 'Year must be 2020-2099'),
  driverIds: z.array(z.string()).optional()
}).strict();

/**
 * Calculate salary for a single driver
 * POST /api/salary/calculate
 */
router.post('/calculate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = calculateSalarySchema.parse(req.body);

    // Verify tenant access
    if (req.user?.tenantId !== validated.tenantId) {
      return res.status(403).json({ error: 'Unauthorized access to this tenant' });
    }

    const calculation = await calculateMonthlySalary({
      tenantId: validated.tenantId,
      driverId: validated.driverId,
      month: validated.month,
      year: validated.year
    });

    // Validate the calculation
    const validation = validateSalaryCalculation(calculation);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Salary calculation validation failed',
        errors: validation.errors
      });
    }

    return res.json({
      success: true,
      data: calculation,
      formatted: formatSalaryCalculation(calculation)
    });
  } catch (error: any) {
    console.error('Salary calculation error:', error);
    return res.status(500).json({
      error: 'Failed to calculate salary',
      message: error.message
    });
  }
});

/**
 * Calculate salaries for multiple drivers (team)
 * POST /api/salary/calculate-team
 */
router.post('/calculate-team', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = calculateTeamSalarySchema.parse(req.body);

    // Verify tenant access
    if (req.user?.tenantId !== validated.tenantId) {
      return res.status(403).json({ error: 'Unauthorized access to this tenant' });
    }

    const calculations = await calculateTeamSalaries(
      validated.tenantId,
      validated.month,
      validated.year,
      validated.driverIds
    );

    // Calculate summary statistics
    const totalGrossEarnings = calculations.reduce((sum, c) => sum + c.grossEarnings, 0);
    const totalDeductions = calculations.reduce((sum, c) => sum + c.totalDeductions, 0);
    const totalNetPayable = calculations.reduce((sum, c) => sum + c.netPayable, 0);
    const totalAmountPaid = calculations.reduce((sum, c) => sum + c.amountPaid, 0);
    const totalAmountPending = calculations.reduce((sum, c) => sum + c.amountPending, 0);

    return res.json({
      success: true,
      period: `${validated.month}/${validated.year}`,
      driverCount: calculations.length,
      summary: {
        totalGrossEarnings,
        totalDeductions,
        totalNetPayable,
        totalAmountPaid,
        totalAmountPending,
        averageSalary: calculations.length > 0 ? totalNetPayable / calculations.length : 0
      },
      calculations
    });
  } catch (error: any) {
    console.error('Team salary calculation error:', error);
    return res.status(500).json({
      error: 'Failed to calculate team salaries',
      message: error.message
    });
  }
});

/**
 * Get salary statistics for a period
 * GET /api/salary/statistics/:tenantId/:month/:year
 */
router.get(
  '/statistics/:tenantId/:month/:year',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, month, year } = req.params;

      // Verify tenant access
      if (req.user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized access to this tenant' });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
        return res.status(400).json({
          error: 'Invalid month or year'
        });
      }

      const statistics = await calculateTeamSalaryStatistics(tenantId, monthNum, yearNum);

      return res.json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Salary statistics error:', error);
      return res.status(500).json({
        error: 'Failed to get salary statistics',
        message: error.message
      });
    }
  }
);

/**
 * Get formatted salary slip for display
 * GET /api/salary/slip/:tenantId/:driverId/:month/:year
 */
router.get(
  '/slip/:tenantId/:driverId/:month/:year',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, driverId, month, year } = req.params;

      // Verify tenant access
      if (req.user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized access to this tenant' });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
        return res.status(400).json({
          error: 'Invalid month or year'
        });
      }

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: monthNum,
        year: yearNum
      });

      const formatted = formatSalaryCalculation(calculation);

      // Return as formatted text and JSON
      return res.json({
        success: true,
        data: calculation,
        slip: formatted
      });
    } catch (error: any) {
      console.error('Salary slip error:', error);
      return res.status(500).json({
        error: 'Failed to generate salary slip',
        message: error.message
      });
    }
  }
);

/**
 * Export salary data as CSV/JSON
 * GET /api/salary/export/:tenantId/:month/:year
 */
router.get(
  '/export/:tenantId/:month/:year',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, month, year } = req.params;
      const format = req.query.format as string || 'json';

      // Verify tenant access
      if (req.user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized access to this tenant' });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
        return res.status(400).json({
          error: 'Invalid month or year'
        });
      }

      const calculations = await calculateTeamSalaries(tenantId, monthNum, yearNum);

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = convertToCSV(calculations);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="salaries-${monthNum}-${yearNum}.csv"`);
        return res.send(csvData);
      }

      // Default to JSON
      return res.json({
        success: true,
        period: `${monthNum}/${yearNum}`,
        count: calculations.length,
        data: calculations
      });
    } catch (error: any) {
      console.error('Salary export error:', error);
      return res.status(500).json({
        error: 'Failed to export salary data',
        message: error.message
      });
    }
  }
);

/**
 * Convert salary calculations to CSV format
 */
function convertToCSV(calculations: MonthlySalaryCalculation[]): string {
  const headers = [
    'Driver ID',
    'Driver Name',
    'Month/Year',
    'Base Salary',
    'Total Allowances',
    'Gross Earnings',
    'Total Deductions',
    'Advances Deduction',
    'Penalties',
    'Net Payable',
    'Amount Paid',
    'Amount Pending'
  ];

  const rows = calculations.map(calc => [
    calc.driverId,
    calc.driverName,
    `${calc.month}/${calc.year}`,
    calc.components.baseSalary.toFixed(2),
    calc.components.allowances.total.toFixed(2),
    calc.grossEarnings.toFixed(2),
    calc.components.deductions.total.toFixed(2),
    calc.components.advances.total.toFixed(2),
    calc.components.penalties.total.toFixed(2),
    calc.netPayable.toFixed(2),
    calc.amountPaid.toFixed(2),
    calc.amountPending.toFixed(2)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

export default router;
