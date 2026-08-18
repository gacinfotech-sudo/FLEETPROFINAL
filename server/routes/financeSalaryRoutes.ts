/**
 * PHASE 9: FINANCE INTEGRATION
 * Endpoints for Finance module to query salary data
 * NO manual re-entry - reads from DriverSalary + DriverSalaryPayment collections
 */

import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant } from '../middleware/auth';
import { DriverSalary, DriverSalaryPayment, DriverAdvance, DriverRecovery } from '../models/index';

const router: Router = express.Router();

/**
 * GET /api/finance/salary-summary
 * Get monthly salary summary for Finance dashboard
 * Returns: totalPayable, totalPaid, totalDue, by-driver breakdown
 */
router.get('/salary-summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
      return res.status(400).json({ error: 'Invalid month or year' });
    }

    // Date range for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);

    // Fetch all salaries for the month
    const salaries = await DriverSalary.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      salaryPeriodStart: { $gte: startDate },
      salaryPeriodEnd: { $lte: endDate }
    }).populate('driverId', 'name phone');

    // Calculate summary
    let totalPayable = 0;
    let totalPaid = 0;
    let totalDue = 0;
    const driverBreakdown = [];

    for (const salary of salaries) {
      totalPayable += salary.netPayable;
      totalPaid += salary.totalPaid;
      totalDue += salary.remainingBalance;

      driverBreakdown.push({
        driverId: salary.driverId._id,
        driverName: (salary.driverId as any).name,
        salaryId: salary._id,
        netPayable: salary.netPayable,
        totalPaid: salary.totalPaid,
        remaining: salary.remainingBalance,
        status: salary.status
      });
    }

    res.json({
      success: true,
      period: `${monthNum}/${yearNum}`,
      summary: {
        totalPayable,
        totalPaid,
        totalDue,
        percentagePaid: totalPayable > 0 ? ((totalPaid / totalPayable) * 100).toFixed(2) : '0.00',
        driverCount: salaries.length
      },
      driverBreakdown,
      expense: {
        month: monthNum,
        year: yearNum,
        category: 'Salary Expense',
        amount: totalPayable
      }
    });
  } catch (error) {
    console.error('Error fetching salary summary:', error);
    res.status(500).json({ error: 'Failed to fetch salary summary' });
  }
});

/**
 * GET /api/finance/advances-outstanding
 * Get all outstanding driver advances
 */
router.get('/advances-outstanding', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const advances = await DriverAdvance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['approved', 'paid'] },
      remaining: { $gt: 0 }
    }).populate('driverId', 'name phone');

    let totalOutstanding = 0;
    const breakdown = [];

    for (const advance of advances) {
      totalOutstanding += advance.remaining;
      breakdown.push({
        advanceId: advance._id,
        driverId: advance.driverId._id,
        driverName: (advance.driverId as any).name,
        totalAmount: advance.amount,
        recovered: advance.totalDeducted,
        remaining: advance.remaining,
        requestDate: advance.requestDate,
        deductionMode: advance.deductionMode
      });
    }

    res.json({
      success: true,
      totalOutstanding,
      count: advances.length,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching outstanding advances:', error);
    res.status(500).json({ error: 'Failed to fetch advances' });
  }
});

/**
 * GET /api/finance/recoveries-outstanding
 * Get all pending/approved recoveries
 */
router.get('/recoveries-outstanding', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const recoveries = await DriverRecovery.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['pending', 'approved'] }
    }).populate('driverId', 'name phone');

    let totalOutstanding = 0;
    const breakdown = [];

    for (const recovery of recoveries) {
      totalOutstanding += recovery.amount;
      breakdown.push({
        recoveryId: recovery._id,
        driverId: recovery.driverId._id,
        driverName: (recovery.driverId as any).name,
        amount: recovery.amount,
        type: recovery.type,
        reason: recovery.reason,
        date: recovery.date,
        status: recovery.status
      });
    }

    res.json({
      success: true,
      totalOutstanding,
      count: recoveries.length,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching outstanding recoveries:', error);
    res.status(500).json({ error: 'Failed to fetch recoveries' });
  }
});

/**
 * GET /api/finance/salary-expense-chart
 * Get month-wise salary expense data for chart
 */
router.get('/salary-expense-chart', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { months = 12 } = req.query;

    const chartData = [];
    const months_num = Math.min(parseInt(months as string) || 12, 24);

    for (let i = months_num - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const salaries = await DriverSalary.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        salaryPeriodStart: { $gte: monthStart },
        salaryPeriodEnd: { $lte: monthEnd }
      });

      const totalPayable = salaries.reduce((sum, s) => sum + s.netPayable, 0);
      const totalPaid = salaries.reduce((sum, s) => sum + s.totalPaid, 0);

      chartData.push({
        month: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        payable: totalPayable,
        paid: totalPaid,
        pending: Math.max(0, totalPayable - totalPaid),
        driverCount: salaries.length
      });
    }

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

/**
 * GET /api/finance/salary-due
 * Get drivers with salary due
 */
router.get('/salary-due', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const salaries = await DriverSalary.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      remainingBalance: { $gt: 0 },
      status: { $ne: 'locked' }
    }).populate('driverId', 'name phone').sort({ remainingBalance: -1 });

    let totalDue = 0;
    const dueDays: Map<string, number> = new Map();

    for (const salary of salaries) {
      totalDue += salary.remainingBalance;
      const daysOverdue = Math.floor(
        (new Date().getTime() - salary.salaryPeriodEnd.getTime()) / (1000 * 60 * 60 * 24)
      );
      dueDays.set(salary._id.toString(), Math.max(0, daysOverdue));
    }

    res.json({
      success: true,
      totalDue,
      count: salaries.length,
      data: salaries.map((salary, idx) => ({
        driverId: salary.driverId._id,
        driverName: (salary.driverId as any).name,
        salaryId: salary._id,
        period: `${salary.salaryPeriodStart.getMonth() + 1}/${salary.salaryPeriodStart.getFullYear()}`,
        due: salary.remainingBalance,
        daysOverdue: dueDays.get(salary._id.toString()),
        status: salary.status
      }))
    });
  } catch (error) {
    console.error('Error fetching salary due:', error);
    res.status(500).json({ error: 'Failed to fetch salary due' });
  }
});

/**
 * PHASE 11: Reports endpoints
 */

/**
 * GET /api/finance/reports/salary
 * Generate comprehensive salary report
 */
router.get('/reports/salary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { month, year, driverId, status } = req.query;

    const { generateSalaryReport } = await import('../services/salaryReportingService');

    const report = await generateSalaryReport({
      tenantId,
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      driverId: driverId as string,
      status: status as string
    });

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating salary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/finance/reports/advances
 * Generate advances outstanding report
 */
router.get('/reports/advances', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const { generateAdvanceReport } = await import('../services/salaryReportingService');
    const report = await generateAdvanceReport(tenantId);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating advances report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/finance/reports/recoveries
 * Generate recoveries report
 */
router.get('/reports/recoveries', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const { generateRecoveryReport } = await import('../services/salaryReportingService');
    const report = await generateRecoveryReport(tenantId);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating recoveries report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/finance/dashboard-stats
 * Get dashboard statistics
 */
router.get('/dashboard-stats', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const { generateDashboardStats } = await import('../services/salaryReportingService');
    const stats = await generateDashboardStats(tenantId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    res.status(500).json({ error: 'Failed to generate stats' });
  }
});

export default router;
