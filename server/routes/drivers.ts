/**
 * DRIVER DISCOVERY & MANAGEMENT ROUTES
 * Complete workflow for driver search, selection, and profiling
 * Supports: search, filter, complete profile, salary details, attendance, advances, recoveries
 */

import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant } from '../middleware/auth';
import {
  Driver,
  DriverSalaryMaster,
  DriverAdvance,
  DriverAttendance,
  DriverRecovery,
  DriverSalaryPayment,
  Booking
} from '../models/index';

const router: Router = express.Router();

const fmtMoney = (n: number) => n ? `₹${n.toLocaleString('en-IN')}` : '₹0';

/**
 * GET /api/drivers
 * Discover drivers with optional filters
 * Query params: status (active/inactive), tenantId, search (name/mobile)
 */
router.get('/', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status = 'active', search } = req.query;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search filter (name or phone)
    if (search && search !== '') {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const drivers = await Driver.find(query)
      .select('_id name phone email status dateOfJoining licenseNumber rating')
      .sort({ dateOfJoining: -1 })
      .lean();

    // Enrich with salary master status
    const enrichedDrivers = await Promise.all(
      drivers.map(async (driver: any) => {
        const salaryMaster = await DriverSalaryMaster.findOne({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: driver._id,
          status: 'active'
        }).lean();

        return {
          ...driver,
          id: driver._id?.toString(),
          hasSalaryConfig: !!salaryMaster,
          salaryStatus: salaryMaster?.status || 'unconfigured',
          baseSalary: salaryMaster?.baseSalary || 0
        };
      })
    );

    res.json({
      success: true,
      count: enrichedDrivers.length,
      data: enrichedDrivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

/**
 * GET /api/drivers/:id/complete-profile
 * Get complete driver profile with all related data
 * Includes: basic info, salary config, attendance, advances, penalties, payment history
 */
router.get('/:id/complete-profile', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const driverId = new mongoose.Types.ObjectId(id);

    // Fetch driver basic info
    const driver = await Driver.findOne({
      _id: driverId,
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).lean();

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId
    }).lean();

    // Fetch current month attendance
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const attendance = await DriverAttendance.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      date: { $gte: monthStart, $lte: monthEnd }
    }).lean();

    // Fetch active advances
    const advances = await DriverAdvance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      status: { $in: ['paid', 'partially_recovered'] }
    }).lean();

    // Fetch recent penalties (model not yet implemented)
    const penalties: any[] = [];

    // Fetch trip count for current month
    const bookings = await Booking.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).countDocuments();

    // Fetch recent payments (using payroll data instead)
    const payments: any[] = [];

    // Calculate totals
    const totalAdvances = advances.reduce((sum: number, a: any) => sum + (a.remaining || 0), 0);
    const totalPenalties = penalties.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    res.json({
      success: true,
      data: {
        driver: {
          id: driver._id?.toString(),
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          status: driver.status,
          dateOfJoining: driver.dateOfJoining,
          licenseNumber: driver.licenseNumber,
          rating: driver.rating,
          lifecycleStage: driver.lifecycleStage
        },
        salary: salaryMaster ? {
          id: salaryMaster._id?.toString(),
          baseSalary: salaryMaster.baseSalary,
          allowances: salaryMaster.allowances || [],
          deductions: salaryMaster.deductions || [],
          status: salaryMaster.status,
          configuredAt: salaryMaster.createdAt
        } : null,
        attendance: attendance ? {
          presentDays: attendance.presentDays || 0,
          absentDays: attendance.absentDays || 0,
          paidLeaveDays: attendance.paidLeaveDays || 0,
          unpaidLeaveDays: attendance.unpaidLeaveDays || 0,
          weeklyOffDays: attendance.weeklyOffDays || 0,
          halfDays: attendance.halfDays || 0
        } : null,
        advances: {
          count: advances.length,
          total: totalAdvances,
          items: advances.map((a: any) => ({
            id: a._id?.toString(),
            amount: a.amount,
            remaining: a.remaining,
            status: a.status,
            requestedAt: a.createdAt
          }))
        },
        penalties: {
          count: penalties.length,
          total: totalPenalties,
          items: penalties.map((p: any) => ({
            id: p._id?.toString(),
            amount: p.amount,
            reason: p.reason,
            status: p.status,
            createdAt: p.createdAt
          }))
        },
        trips: {
          monthCount: bookings,
          weekCount: await Booking.find({
            tenantId: new mongoose.Types.ObjectId(tenantId),
            driverId,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }).countDocuments()
        },
        payments: {
          count: payments.length,
          totalPaid,
          recent: payments.map((p: any) => ({
            id: p._id?.toString(),
            amount: p.amount,
            mode: p.paymentMode,
            date: p.createdAt
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

/**
 * GET /api/drivers/:id/salary-summary
 * Quick salary summary for driver in a payroll period
 */
router.get('/:id/salary-summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { month, year } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const driverId = new mongoose.Types.ObjectId(id);
    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      status: 'active'
    }).lean();

    if (!salaryMaster) {
      return res.status(404).json({ error: 'Salary configuration not found' });
    }

    // Calculate period dates
    const periodStart = new Date(targetYear, targetMonth - 1, 1);
    const periodEnd = new Date(targetYear, targetMonth, 0);

    // Get attendance
    const attendance = await DriverAttendance.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      date: { $gte: periodStart, $lte: periodEnd }
    }).lean();

    // Get advances
    const advances = await DriverAdvance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      status: 'paid'
    }).lean();

    // Get penalties (model not yet implemented)
    const penalties: any[] = [];

    // Get payment ledger for the month (using payroll data instead)
    const payments: any[] = [];

    // Calculate totals
    const advanceDeduction = advances.reduce((sum: number, a: any) => sum + (a.remaining || 0), 0);
    const penaltyDeduction = penalties.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Estimate gross (simplified)
    const baseSalary = salaryMaster.baseSalary;
    const totalAllowances = (salaryMaster.allowances || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
    const grossSalary = baseSalary + totalAllowances;

    const totalDeductions = advanceDeduction + penaltyDeduction;
    const netPayable = grossSalary - totalDeductions;
    const pending = netPayable - totalPaid;

    res.json({
      success: true,
      data: {
        driverId: id,
        period: `${targetMonth}/${targetYear}`,
        salary: {
          baseSalary,
          allowances: totalAllowances,
          grossSalary,
          deductions: totalDeductions,
          netPayable,
          paid: totalPaid,
          pending
        },
        attendance: {
          presentDays: attendance?.presentDays || 0,
          absentDays: attendance?.absentDays || 0,
          paidLeaveDays: attendance?.paidLeaveDays || 0
        },
        advances: {
          count: advances.length,
          deduction: advanceDeduction
        },
        penalties: {
          count: penalties.length,
          deduction: penaltyDeduction
        }
      }
    });
  } catch (error) {
    console.error('Error fetching salary summary:', error);
    res.status(500).json({ error: 'Failed to fetch salary summary' });
  }
});

/**
 * GET /api/drivers/:id/auto-360
 * Get complete real-time 360 view with all connected data
 * Fetches: driver info, salary, attendance, bookings, advances, penalties, payroll
 * Returns: always current data (real-time sync)
 */
router.get('/:id/auto-360', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    // Import auto-enrollment service for 360 view
    const { getAuto360View } = await import('../services/driverAutoEnrollmentService');

    const view360 = await getAuto360View(id, tenantId);

    res.json({
      success: true,
      data: view360,
      meta: {
        lastUpdated: new Date(),
        realtime: true,
        dataSource: 'auto-sync'
      }
    });
  } catch (error) {
    console.error('Error fetching auto-360 view:', error);
    res.status(500).json({ error: 'Failed to fetch 360 view' });
  }
});

/**
 * GET /api/drivers/:id/360-with-payroll
 * Get enhanced Driver 360 view with integrated payroll data
 * Includes: driver info, salary breakdown, payment history, YTD earnings
 * Returns: comprehensive payroll-integrated view
 */
router.get('/:id/360-with-payroll', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const driverId = new mongoose.Types.ObjectId(id);

    // Import services
    const { getDriver360WithEnhancedPayroll } = await import('../services/driver360Service');
    const { getDriverPayrollAggregation } = await import('../services/driverPayrollAggregationService');

    // Get base 360 data with enhanced payroll
    const driver360 = await getDriver360WithEnhancedPayroll(tenantId, id);

    if (!driver360) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Also get pure payroll aggregation for frontend
    const payrollAgg = await getDriverPayrollAggregation(tenantId, id);

    res.json({
      success: true,
      data: {
        driver360,
        payroll: payrollAgg,
        metadata: {
          lastUpdated: new Date(),
          realtime: true,
          dataSource: 'driver360-payroll-aggregation'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching driver 360 with payroll:', error);
    res.status(500).json({ error: 'Failed to fetch driver 360 with payroll data' });
  }
});

/**
 * GET /api/drivers/:id/payroll-summary
 * Get quick payroll summary for driver
 * Includes: current month salary, last payment, next payment, YTD
 * Use this for dashboard cards and quick views
 */
router.get('/:id/payroll-summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const { getDriverPayrollAggregation } = await import('../services/driverPayrollAggregationService');
    const payroll = await getDriverPayrollAggregation(tenantId, id);

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll data not found' });
    }

    res.json({
      success: true,
      data: {
        currentMonth: payroll.currentMonth,
        lastPayment: payroll.lastPayment,
        nextPayment: payroll.nextPayment,
        ytdEarnings: payroll.ytdEarnings,
        status: payroll.status
      },
      meta: {
        lastUpdated: new Date(),
        source: 'payroll-aggregation'
      }
    });
  } catch (error) {
    console.error('Error fetching payroll summary:', error);
    res.status(500).json({ error: 'Failed to fetch payroll summary' });
  }
});

/**
 * GET /api/drivers/:id/payroll-details
 * Get detailed payroll breakdown
 * Includes: full salary calculation, payment history, detailed deductions
 * Use this for detailed salary modals
 */
router.get('/:id/payroll-details', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid driver ID' });
    }

    const { getDriverPayrollAggregation } = await import('../services/driverPayrollAggregationService');
    const payroll = await getDriverPayrollAggregation(tenantId, id);

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll data not found' });
    }

    res.json({
      success: true,
      data: payroll,
      meta: {
        lastUpdated: new Date(),
        source: 'payroll-aggregation'
      }
    });
  } catch (error) {
    console.error('Error fetching payroll details:', error);
    res.status(500).json({ error: 'Failed to fetch payroll details' });
  }
});

/**
 * GET /api/drivers/payroll/candidates
 * Get drivers eligible for payroll
 */
router.get('/payroll/candidates', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    // Get active drivers with salary config
    const drivers = await Driver.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: 'active'
    }).select('_id name phone').lean();

    // Filter to only those with salary master
    const candidates = await Promise.all(
      drivers.map(async (d: any) => {
        const salaryMaster = await DriverSalaryMaster.findOne({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: d._id,
          status: 'active'
        }).lean();

        if (!salaryMaster) return null;

        return {
          id: d._id?.toString(),
          name: d.name,
          phone: d.phone,
          baseSalary: salaryMaster.baseSalary
        };
      })
    );

    res.json({
      success: true,
      count: candidates.filter(c => c).length,
      data: candidates.filter(c => c)
    });
  } catch (error) {
    console.error('Error fetching payroll candidates:', error);
    res.status(500).json({ error: 'Failed to fetch payroll candidates' });
  }
});

export default router;
