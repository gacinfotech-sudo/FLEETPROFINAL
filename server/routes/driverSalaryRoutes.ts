/**
 * PHASE 4: SALARY PERIOD & GENERATION ROUTES
 * API endpoints for driver salary management
 */

import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant } from '../middleware/auth';
import {
  DriverSalaryMaster,
  DriverSalary,
  DriverSalaryPayment,
  DriverRecharge,
  DriverRecovery,
  IDriverSalary,
  IDriverSalaryPayment
} from '../models/index';
import * as driverSalaryService from '../services/driverSalaryService';
import * as salaryEngine from '../services/salaryCalculationEngine';
import * as ledgerAutomation from '../services/ledgerEntryAutomation';
import * as salarySlipService from '../services/salarySSlipService';

const router: Router = express.Router();

/**
 * GET /api/driver-salary/master/:driverId
 * Get salary master configuration for a driver
 */
router.get('/master/:driverId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const tenantId = (req as any).tenantId;

    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId)
    });

    if (!salaryMaster) {
      return res.status(404).json({ error: 'Salary master not found for driver' });
    }

    res.json({
      success: true,
      data: salaryMaster
    });
  } catch (error) {
    console.error('Error fetching salary master:', error);
    res.status(500).json({ error: 'Failed to fetch salary master' });
  }
});

/**
 * POST /api/driver-salary/generate
 * Generate salary for driver + period (PHASE 4 CORE)
 * AUTO-FETCHES: attendance, bookings, advances, recharges, recoveries
 * RETURNS: Full salary calculation breakdown with NET PAYABLE
 */
router.post('/generate', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { driverId, salaryPeriodStart, salaryPeriodEnd, payableDays } = req.body;

    // Validation
    if (!driverId || !salaryPeriodStart || !salaryPeriodEnd) {
      return res.status(400).json({
        error: 'Missing required fields: driverId, salaryPeriodStart, salaryPeriodEnd'
      });
    }

    const startDate = new Date(salaryPeriodStart);
    const endDate = new Date(salaryPeriodEnd);

    // Check if salary already exists for this period
    const existingSalary = await DriverSalary.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      salaryPeriodStart: startDate,
      salaryPeriodEnd: endDate
    });

    if (existingSalary && existingSalary.status !== 'draft') {
      return res.status(409).json({
        error: 'Salary already generated for this period. Status: ' + existingSalary.status
      });
    }

    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: 'active'
    });

    if (!salaryMaster) {
      return res.status(404).json({
        error: 'Active salary configuration not found for driver'
      });
    }

    // PHASE 2: AUTO-FETCH all data from existing modules
    const salaryData = await driverSalaryService.fetchAllSalaryCalculationData({
      tenantId,
      driverId,
      salaryPeriodStart: startDate,
      salaryPeriodEnd: endDate
    });

    // Validate fetched data
    const validation = driverSalaryService.validateSalaryCalculationData(salaryData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Incomplete salary data',
        details: validation.errors
      });
    }

    // Calculate payroll days (days in month)
    const payrollDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Use provided payableDays or default to attendance presentDays
    const finalPayableDays = payableDays || salaryData.attendance.presentDays;

    // PHASE 3: CALCULATE SALARY using engine
    const calculationInput: salaryEngine.SalaryCalculationInput = {
      salaryMaster,
      salaryPeriodStart: startDate,
      salaryPeriodEnd: endDate,
      payableDays: finalPayableDays,
      payrollDays,
      presentDays: salaryData.attendance.presentDays,
      paidLeaveDays: salaryData.attendance.paidLeaveDays,
      unpaidLeaveDays: salaryData.attendance.unpaidLeaveDays,
      weeklyOffDays: salaryData.attendance.weeklyOffDays,
      halfDays: salaryData.attendance.halfDays,
      absentDays: salaryData.attendance.absentDays,
      bookingServiceDays: salaryData.bookingServiceDays.uniqueServiceDays,
      totalKilometers: salaryData.bookingServiceDays.totalKilometers,
      nightDutyTrips: salaryData.bookingServiceDays.nightDutyTrips,
      outstationTrips: salaryData.bookingServiceDays.outstationTrips,
      recharges: salaryData.recharges,
      recoveries: salaryData.recoveries,
      advances: salaryData.advances
    };

    // Validate calculation input
    const calcValidation = salaryEngine.validateSalaryCalculationInput(calculationInput);
    if (!calcValidation.valid) {
      return res.status(400).json({
        error: 'Invalid salary calculation input',
        details: calcValidation.errors
      });
    }

    // Calculate salary
    const salaryCalculation = salaryEngine.calculateSalary(calculationInput);

    // Calculate total recharge deduction (only DEDUCT_FROM_DRIVER)
    let totalRechargeDeduction = 0;
    for (const recharge of salaryData.recharges) {
      if (recharge.treatment === 'DEDUCT_FROM_DRIVER' && recharge.status === 'completed') {
        totalRechargeDeduction += recharge.amount;
      }
    }

    // Calculate total recovery deduction
    let totalRecoveryDeduction = 0;
    for (const recovery of salaryData.recoveries) {
      if (recovery.status === 'approved' || recovery.status === 'recovered') {
        totalRecoveryDeduction += recovery.amount;
      }
    }

    // Calculate total advance deduction
    let totalAdvanceDeduction = 0;
    for (const advance of salaryData.advances) {
      if (advance.status === 'paid') {
        if (advance.deductionMode === 'full_next_salary') {
          totalAdvanceDeduction += advance.remaining || 0;
        } else if (advance.deductionMode === 'emi' && advance.emiAmount) {
          totalAdvanceDeduction += advance.emiAmount;
        }
      }
    }

    // Create or update DriverSalary record
    let driverSalary: IDriverSalary;

    if (existingSalary) {
      // Update existing draft salary
      Object.assign(existingSalary, {
        baseMonthly: salaryMaster.baseSalary,
        payableDays: finalPayableDays,
        payrollDays,
        dailyRate: salaryCalculation.earnings.baseSalary / finalPayableDays,
        grossEarned: salaryCalculation.grossEarned,
        allowances: salaryCalculation.earnings.allowances,
        incentives: salaryCalculation.earnings.incentives,
        bonuses: 0,
        advanceDeduction: totalAdvanceDeduction,
        rechargeDeduction: totalRechargeDeduction,
        recoveryDeduction: totalRecoveryDeduction,
        totalDeductions: salaryCalculation.totalDeductions,
        netPayable: salaryCalculation.netPayable,
        totalPaid: 0,
        remainingBalance: salaryCalculation.netPayable,
        status: 'calculated',
        calculatedBy: { userId, role: (req as any).userRole },
        calculatedAt: new Date(),
        notes: `Auto-generated: ${finalPayableDays} payable days, ${salaryData.bookingServiceDays.uniqueServiceDays} booking service days`
      });
      driverSalary = await existingSalary.save();
    } else {
      // Create new salary record
      driverSalary = new DriverSalary({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        salaryPeriodStart: startDate,
        salaryPeriodEnd: endDate,
        baseMonthly: salaryMaster.baseSalary,
        payableDays: finalPayableDays,
        payrollDays,
        dailyRate: salaryCalculation.earnings.baseSalary / finalPayableDays,
        grossEarned: salaryCalculation.grossEarned,
        allowances: salaryCalculation.earnings.allowances,
        incentives: salaryCalculation.earnings.incentives,
        bonuses: 0,
        advanceDeduction: totalAdvanceDeduction,
        rechargeDeduction: totalRechargeDeduction,
        recoveryDeduction: totalRecoveryDeduction,
        totalDeductions: salaryCalculation.totalDeductions,
        netPayable: salaryCalculation.netPayable,
        totalPaid: 0,
        remainingBalance: salaryCalculation.netPayable,
        status: 'calculated',
        calculatedBy: { userId, role: (req as any).userRole },
        calculatedAt: new Date(),
        notes: `Auto-generated: ${finalPayableDays} payable days, ${salaryData.bookingServiceDays.uniqueServiceDays} booking service days`
      });
      driverSalary = await driverSalary.save();
    }

    // PHASE 5: AUTO-CREATE ledger entry for salary
    await ledgerAutomation.autoCreateSalaryEntry(
      tenantId,
      driverId,
      salaryMaster.name,
      driverSalary._id!,
      salaryCalculation.netPayable,
      startDate.getMonth() + 1,
      startDate.getFullYear(),
      { userId, role: (req as any).userRole }
    );

    res.status(201).json({
      success: true,
      message: 'Salary calculated successfully',
      data: {
        salaryId: driverSalary._id,
        driverId,
        driverName: salaryMaster.name,
        period: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        calculation: salaryCalculation,
        formattedCalculation: salaryEngine.formatSalaryCalculation(salaryCalculation)
      }
    });
  } catch (error) {
    console.error('Error generating salary:', error);
    res.status(500).json({ error: 'Failed to generate salary' });
  }
});

/**
 * GET /api/driver-salary/list
 * List salaries for tenant with optional filters
 */
router.get('/list', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId, status, month, year } = req.query;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (driverId) {
      query.driverId = new mongoose.Types.ObjectId(driverId as string);
    }

    if (status) {
      query.status = status;
    }

    if (month && year) {
      const startOfMonth = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endOfMonth = new Date(parseInt(year as string), parseInt(month as string), 0);
      query.salaryPeriodStart = { $gte: startOfMonth };
      query.salaryPeriodEnd = { $lte: endOfMonth };
    }

    const salaries = await DriverSalary.find(query)
      .populate('driverId', 'name phone')
      .sort({ salaryPeriodStart: -1 })
      .limit(100);

    res.json({
      success: true,
      count: salaries.length,
      data: salaries
    });
  } catch (error) {
    console.error('Error listing salaries:', error);
    res.status(500).json({ error: 'Failed to list salaries' });
  }
});

/**
 * GET /api/driver-salary/:salaryId
 * Get salary details
 */
router.get('/:salaryId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { salaryId } = req.params;

    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('driverId', 'name phone email');

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    res.json({
      success: true,
      data: salary
    });
  } catch (error) {
    console.error('Error fetching salary:', error);
    res.status(500).json({ error: 'Failed to fetch salary' });
  }
});

/**
 * POST /api/driver-salary/:salaryId/approve
 * Approve salary for processing
 */
router.post('/:salaryId/approve', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { salaryId } = req.params;
    const { approvalNotes } = req.body;

    const salary = await DriverSalary.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(salaryId),
        tenantId: new mongoose.Types.ObjectId(tenantId)
      },
      {
        status: 'approved',
        approvedBy: { userId, role: (req as any).userRole },
        approvedAt: new Date(),
        notes: approvalNotes || salary?.notes
      },
      { new: true }
    );

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    res.json({
      success: true,
      message: 'Salary approved successfully',
      data: salary
    });
  } catch (error) {
    console.error('Error approving salary:', error);
    res.status(500).json({ error: 'Failed to approve salary' });
  }
});

/**
 * POST /api/driver-salary/:salaryId/payment
 * Record salary payment (Full/Partial/Multiple payments support)
 * PHASE 6 ENHANCED: Robust payment tracking with balance validation
 */
router.post('/:salaryId/payment', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { salaryId } = req.params;
    const { amount, paymentMode, transactionReference, paymentDate } = req.body;

    // Validation
    if (!amount || !paymentMode) {
      return res.status(400).json({ error: 'Missing required fields: amount, paymentMode' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const validPaymentModes = ['cash', 'bank_transfer', 'upi', 'check', 'split'];
    if (!validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({ error: `Invalid payment mode. Must be one of: ${validPaymentModes.join(', ')}` });
    }

    // Get salary record
    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).populate('driverId', 'name phone');

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    // Validate status
    if (salary.status === 'locked') {
      return res.status(403).json({ error: 'Salary is locked and cannot accept payments' });
    }

    // Validate payment amount doesn't exceed remaining balance
    if (amount > salary.remainingBalance) {
      return res.status(400).json({
        error: `Payment amount (₹${amount}) exceeds remaining balance (₹${salary.remainingBalance})`,
        remainingBalance: salary.remainingBalance
      });
    }

    // Calculate new totals
    const newTotalPaid = salary.totalPaid + amount;
    const newRemainingBalance = salary.remainingBalance - amount;
    const driverName = (salary.driverId as any).name || 'Unknown';

    // Create payment record
    const payment = new DriverSalaryPayment({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: salary.driverId._id,
      salaryId: salary._id,
      amount,
      date: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      transactionReference,
      status: 'completed',
      remainingBalance: newRemainingBalance,
      paidBy: { userId, role: (req as any).userRole }
    });

    await payment.save();

    // Determine new status
    let newStatus = salary.status;
    if (newRemainingBalance === 0) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    }

    // Update salary record
    salary.totalPaid = newTotalPaid;
    salary.remainingBalance = newRemainingBalance;
    salary.status = newStatus;
    if (newRemainingBalance === 0) {
      salary.paidAt = new Date();
      // Lock salary after full payment
      // salary.status = 'locked'; // Uncomment to auto-lock after payment
    }
    salary.updatedAt = new Date();

    await salary.save();

    // AUTO-CREATE ledger entry for payment
    await ledgerAutomation.autoCreateSalaryPaymentEntry(
      tenantId,
      salary.driverId._id,
      driverName,
      payment._id!,
      amount,
      paymentMode,
      salary.salaryPeriodStart.getMonth() + 1,
      salary.salaryPeriodStart.getFullYear(),
      { userId, role: (req as any).userRole }
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: payment._id,
        payment: {
          amount,
          date: payment.date,
          mode: paymentMode,
          transactionReference,
          status: 'completed'
        },
        salaryUpdate: {
          totalPaid: salary.totalPaid,
          remainingBalance: salary.remainingBalance,
          status: salary.status,
          paymentProgress: `₹${salary.totalPaid} / ₹${salary.netPayable}`,
          percentagePaid: ((salary.totalPaid / salary.netPayable) * 100).toFixed(2) + '%'
        }
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * GET /api/driver-salary/:salaryId/ledger
 * Get ledger entries for a salary
 */
router.get('/:salaryId/ledger', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { salaryId } = req.params;

    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    const entries = await ledgerAutomation.getLedgerEntries(
      tenantId,
      salary.driverId,
      salary.salaryPeriodStart.getMonth() + 1,
      salary.salaryPeriodStart.getFullYear()
    );

    res.json({
      success: true,
      count: entries.length,
      data: entries
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ error: 'Failed to fetch ledger' });
  }
});

/**
 * POST /api/driver-salary/:salaryId/day-wise-breakdown
 * PHASE 7: Auto-populate day-wise breakdown from Attendance + Booking
 * Also handles manual corrections
 */
router.post('/:salaryId/day-wise-breakdown', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;
    const { salaryId } = req.params;
    const { regenerate, corrections } = req.body;

    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    // Fetch attendance data for period
    const attendanceRecords = await (await import('../models/index')).DriverAttendance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: salary.driverId,
      date: { $gte: salary.salaryPeriodStart, $lte: salary.salaryPeriodEnd }
    }).sort({ date: 1 });

    // Fetch booking data for period
    const bookings = await (await import('../models/index')).Booking.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: salary.driverId,
      pickupDate: { $gte: salary.salaryPeriodStart, $lte: salary.salaryPeriodEnd },
      status: { $in: ['completed', 'in_progress', 'confirmed'] }
    }).sort({ pickupDate: 1 });

    // Build day-wise breakdown
    const dayWiseBreakdown: any[] = [];
    const currentDate = new Date(salary.salaryPeriodStart);
    const endDate = new Date(salary.salaryPeriodEnd);

    const bookingsByDay = new Map<string, number>();
    for (const booking of bookings) {
      const dateKey = booking.pickupDate?.toISOString().split('T')[0];
      if (dateKey) {
        bookingsByDay.set(dateKey, (bookingsByDay.get(dateKey) || 0) + 1);
      }
    }

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const attendance = attendanceRecords.find(
        a => a.date.toISOString().split('T')[0] === dateKey
      );

      const bookingCount = bookingsByDay.get(dateKey) || 0;
      let dayType = 'free';

      if (attendance) {
        switch (attendance.status) {
          case 'present':
          case 'late':
          case 'on_duty':
            dayType = 'booking_service';
            break;
          case 'paid_leave':
            dayType = 'paid_leave';
            break;
          case 'unpaid_leave':
            dayType = 'unpaid_leave';
            break;
          case 'absent':
            dayType = 'absent';
            break;
          case 'weekly_off':
            dayType = 'weekly_off';
            break;
          case 'half_day':
            dayType = 'half_day';
            break;
        }
      }

      dayWiseBreakdown.push({
        date: new Date(currentDate),
        dayType,
        bookingsServed: bookingCount,
        reason: attendance?.notes || '',
        autoGenerated: true,
        manual: false
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Apply corrections if provided
    if (corrections && Array.isArray(corrections)) {
      for (const correction of corrections) {
        if (correction.date && correction.dayType) {
          const correctionDate = new Date(correction.date).toISOString().split('T')[0];
          const index = dayWiseBreakdown.findIndex(
            d => d.date.toISOString().split('T')[0] === correctionDate
          );

          if (index >= 0) {
            dayWiseBreakdown[index] = {
              ...dayWiseBreakdown[index],
              ...correction,
              manual: true,
              overriddenAt: new Date(),
              overriddenBy: { userId, role: (req as any).userRole },
              autoGenerated: false
            };
          }
        }
      }
    }

    // Update salary with day-wise breakdown
    salary.dayWiseBreakdown = dayWiseBreakdown;
    salary.updatedAt = new Date();
    await salary.save();

    res.json({
      success: true,
      message: 'Day-wise breakdown populated successfully',
      data: {
        totalDays: dayWiseBreakdown.length,
        breakdown: dayWiseBreakdown
      }
    });
  } catch (error) {
    console.error('Error populating day-wise breakdown:', error);
    res.status(500).json({ error: 'Failed to populate day-wise breakdown' });
  }
});

/**
 * GET /api/driver-salary/:salaryId/slip
 * PHASE 10: Generate and download PDF salary slip
 */
router.get('/:salaryId/slip', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { salaryId } = req.params;

    const { generateSalarySlip } = await import('../services/salarySlipGenerator');
    const pdfBuffer = await generateSalarySlip(tenantId, salaryId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="salary-slip-${salaryId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating salary slip:', error);
    res.status(500).json({ error: 'Failed to generate salary slip' });
  }
});

/**
 * GET /api/driver-salary/:salaryId/day-wise-breakdown
 * Get day-wise breakdown for a salary
 */
router.get('/:salaryId/day-wise-breakdown', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { salaryId } = req.params;

    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    const breakdown = salary.dayWiseBreakdown || [];
    const summary = {
      totalDays: breakdown.length,
      bookingServiceDays: breakdown.filter(d => d.dayType === 'booking_service').length,
      paidLeaveDays: breakdown.filter(d => d.dayType === 'paid_leave').length,
      unpaidLeaveDays: breakdown.filter(d => d.dayType === 'unpaid_leave').length,
      weeklyOffDays: breakdown.filter(d => d.dayType === 'weekly_off').length,
      halfDays: breakdown.filter(d => d.dayType === 'half_day').length,
      absentDays: breakdown.filter(d => d.dayType === 'absent').length,
      freeDays: breakdown.filter(d => d.dayType === 'free').length,
      manualOverrides: breakdown.filter(d => d.manual).length
    };

    res.json({
      success: true,
      summary,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching day-wise breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch day-wise breakdown' });
  }
});

/**
 * GET /api/driver-salary/:salaryId/slip
 * Download salary slip PDF (PHASE 10)
 */
router.get('/:salaryId/slip', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { salaryId } = req.params;

    const salary = await DriverSalary.findOne({
      _id: new mongoose.Types.ObjectId(salaryId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    });

    if (!salary) {
      return res.status(404).json({ error: 'Salary record not found' });
    }

    const pdfBuffer = await salarySlipService.generateSalarySlip(tenantId, salaryId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="salary-slip-${salary._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating salary slip:', error);
    res.status(500).json({ error: 'Failed to generate salary slip' });
  }
});

/**
 * GET /api/driver-salary/finance/summary
 * Finance dashboard summary (PHASE 9)
 */
router.get('/finance/summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { month, year } = req.query;

    const startDate = new Date(
      parseInt(year as string) || new Date().getFullYear(),
      parseInt(month as string) ? parseInt(month as string) - 1 : new Date().getMonth(),
      1
    );
    const endDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0
    );

    const salaries = await DriverSalary.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      salaryPeriodStart: { $gte: startDate },
      salaryPeriodEnd: { $lte: endDate }
    });

    const summary = {
      totalPayable: salaries.reduce((sum, s) => sum + s.netPayable, 0),
      totalPaid: salaries.reduce((sum, s) => sum + s.totalPaid, 0),
      totalDue: salaries.reduce((sum, s) => sum + s.remainingBalance, 0),
      driverCount: salaries.length,
      salaryCount: salaries.length,
      paidCount: salaries.filter(s => s.status === 'paid').length,
      partiallyPaidCount: salaries.filter(s => s.status === 'partially_paid').length,
      pendingCount: salaries.filter(s => s.status === 'calculated' || s.status === 'approved').length,
      period: { month, year }
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching finance summary:', error);
    res.status(500).json({ error: 'Failed to fetch finance summary' });
  }
});

/**
 * GET /api/driver-salary/finance/advances-outstanding
 * Outstanding advances report (PHASE 9)
 */
router.get('/finance/advances-outstanding', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;

    const advances = await (require('../models/index').DriverAdvance).find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['approved', 'paid'] },
      remaining: { $gt: 0 }
    })
      .populate('driverId', 'name phone')
      .sort({ remaining: -1 });

    const summary = {
      totalOutstanding: advances.reduce((sum: number, a: any) => sum + a.remaining, 0),
      advanceCount: advances.length,
      driverCount: new Set(advances.map((a: any) => a.driverId._id.toString())).size,
      advances: advances.map((a: any) => ({
        driverId: a.driverId._id,
        driverName: a.driverId.name,
        amount: a.amount,
        remaining: a.remaining,
        deducted: a.totalDeducted,
        requestDate: a.requestDate,
        type: a.deductionMode
      }))
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching advances outstanding:', error);
    res.status(500).json({ error: 'Failed to fetch advances' });
  }
});

/**
 * GET /api/driver-salary/driver/:driverId/summary
 * Driver salary summary for Driver 360 (PHASE 8)
 */
router.get('/driver/:driverId/summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;

    // Current month salary
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const currentSalary = await DriverSalary.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      salaryPeriodStart: { $gte: currentMonthStart },
      salaryPeriodEnd: { $lte: currentMonthEnd }
    });

    // Last month salary
    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(currentMonthStart);
    lastMonthEnd.setDate(0);

    const lastSalary = await DriverSalary.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      salaryPeriodStart: { $gte: lastMonthStart },
      salaryPeriodEnd: { $lte: lastMonthEnd }
    });

    // All advances
    const advances = await (require('../models/index').DriverAdvance).find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: { $in: ['approved', 'paid'] },
      remaining: { $gt: 0 }
    }).sort({ requestDate: -1 });

    res.json({
      success: true,
      data: {
        currentSalary: currentSalary ? {
          id: currentSalary._id,
          period: `${currentSalary.salaryPeriodStart.toLocaleDateString()} to ${currentSalary.salaryPeriodEnd.toLocaleDateString()}`,
          baseMonthly: currentSalary.baseMonthly,
          grossEarned: currentSalary.grossEarned,
          netPayable: currentSalary.netPayable,
          totalPaid: currentSalary.totalPaid,
          remainingBalance: currentSalary.remainingBalance,
          status: currentSalary.status
        } : null,
        lastSalary: lastSalary ? {
          id: lastSalary._id,
          period: `${lastSalary.salaryPeriodStart.toLocaleDateString()} to ${lastSalary.salaryPeriodEnd.toLocaleDateString()}`,
          netPayable: lastSalary.netPayable,
          status: lastSalary.status
        } : null,
        outstandingAdvances: {
          count: advances.length,
          totalAmount: advances.reduce((sum: number, a: any) => sum + a.remaining, 0),
          advances: advances.slice(0, 5).map((a: any) => ({
            id: a._id,
            amount: a.amount,
            remaining: a.remaining,
            requestDate: a.requestDate,
            type: a.deductionMode
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching driver salary summary:', error);
    res.status(500).json({ error: 'Failed to fetch driver salary summary' });
  }
});

/**
 * GET /api/driver-salary/consolidated/dashboard?month=8&year=2026
 * Get consolidated salary dashboard with properly merged pending/paid/gross amounts
 */
router.get('/consolidated/dashboard', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const { getSalaryDashboard } = await import('../services/consolidatedSalaryService');
    const dashboard = await getSalaryDashboard(tenantId, month, year);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error fetching consolidated salary dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated salary dashboard' });
  }
});

/**
 * GET /api/driver-salary/consolidated/:driverId?month=8&year=2026
 * Get consolidated salary data for a single driver
 * Returns: {
 *   driverId, driverName, month, year,
 *   baseSalary, incentives, allowances, bonuses, grossSalary,
 *   advanceDeductions, rechargeDeductions, recoveryDeductions, penaltyDeductions, totalDeductions,
 *   totalPaid, totalPending, remainingBalance,
 *   paymentStatus: "pending" | "partially_paid" | "paid",
 *   transactions, ledgerEntries, paymentHistory
 * }
 */
router.get('/consolidated/:driverId', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const { getDriverSalaryConsolidated } = await import('../services/consolidatedSalaryService');
    const consolidated = await getDriverSalaryConsolidated(tenantId, driverId, month, year);

    res.json({
      success: true,
      data: consolidated
    });
  } catch (error) {
    console.error('Error fetching consolidated driver salary:', error);
    res.status(500).json({ error: 'Failed to fetch consolidated driver salary' });
  }
});

/**
 * GET /api/driver-salary/consolidated/:driverId/summary
 * Get consolidated salary summary for a driver (YTD, current month, previous month)
 */
router.get('/consolidated/:driverId/summary', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;

    const { getDriverSalarySummary } = await import('../services/consolidatedSalaryService');
    const summary = await getDriverSalarySummary(tenantId, driverId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching driver salary summary:', error);
    res.status(500).json({ error: 'Failed to fetch driver salary summary' });
  }
});

/**
 * GET /api/driver-salary/consolidated/:driverId/validate?month=8&year=2026
 * Validate salary calculations and identify discrepancies
 */
router.get('/consolidated/:driverId/validate', authenticateUser, requireTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { driverId } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const { validateSalaryConsolidation } = await import('../services/consolidatedSalaryService');
    const validation = await validateSalaryConsolidation(tenantId, driverId, month, year);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating salary consolidation:', error);
    res.status(500).json({ error: 'Failed to validate salary consolidation' });
  }
});

export default router;
