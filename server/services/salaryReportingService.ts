/**
 * PHASE 11: SALARY REPORTS & DASHBOARD
 * Comprehensive reporting service for salary analytics
 */

import mongoose from 'mongoose';
import { DriverSalary, DriverAdvance, DriverRecovery } from '../models/index';

export interface SalaryReportInput {
  tenantId: string | mongoose.Types.ObjectId;
  month?: number;
  year?: number;
  driverId?: string | mongoose.Types.ObjectId;
  status?: string;
}

export async function generateSalaryReport(input: SalaryReportInput) {
  const tenantObjId = typeof input.tenantId === 'string' ? new mongoose.Types.ObjectId(input.tenantId) : input.tenantId;

  const query: any = { tenantId: tenantObjId };

  if (input.month && input.year) {
    const startDate = new Date(input.year, input.month - 1, 1);
    const endDate = new Date(input.year, input.month, 0);
    query.salaryPeriodStart = { $gte: startDate };
    query.salaryPeriodEnd = { $lte: endDate };
  }

  if (input.driverId) {
    query.driverId = typeof input.driverId === 'string' ? new mongoose.Types.ObjectId(input.driverId) : input.driverId;
  }

  if (input.status) {
    query.status = input.status;
  }

  const salaries = await DriverSalary.find(query).populate('driverId', 'name phone');

  const report = {
    period: input.month && input.year ? `${input.month}/${input.year}` : 'All',
    totalRecords: salaries.length,
    summary: {
      totalGross: 0,
      totalDeductions: 0,
      totalNetPayable: 0,
      totalPaid: 0,
      totalDue: 0
    },
    details: [] as any[],
    statistics: {
      averageGross: 0,
      averageNet: 0,
      highestEarner: '',
      highestEarnings: 0,
      lowestEarner: '',
      lowestEarnings: 0,
      paidCount: 0,
      partiallyPaidCount: 0,
      pendingCount: 0
    }
  };

  let maxEarnings = 0;
  let minEarnings = Infinity;

  for (const salary of salaries) {
    report.summary.totalGross += salary.grossEarned;
    report.summary.totalDeductions += salary.totalDeductions;
    report.summary.totalNetPayable += salary.netPayable;
    report.summary.totalPaid += salary.totalPaid;
    report.summary.totalDue += salary.remainingBalance;

    // Track highest/lowest earners
    if (salary.netPayable > maxEarnings) {
      maxEarnings = salary.netPayable;
      report.statistics.highestEarner = (salary.driverId as any).name;
      report.statistics.highestEarnings = salary.netPayable;
    }

    if (salary.netPayable < minEarnings) {
      minEarnings = salary.netPayable;
      report.statistics.lowestEarner = (salary.driverId as any).name;
      report.statistics.lowestEarnings = salary.netPayable;
    }

    // Count statuses
    if (salary.status === 'paid') report.statistics.paidCount++;
    else if (salary.status === 'partially_paid') report.statistics.partiallyPaidCount++;
    else if (['draft', 'calculated', 'approved'].includes(salary.status)) report.statistics.pendingCount++;

    report.details.push({
      driverId: salary.driverId._id,
      driverName: (salary.driverId as any).name,
      driverPhone: (salary.driverId as any).phone,
      baseSalary: salary.baseMonthly,
      payableDays: salary.payableDays,
      serviceBeats: salary.dayWiseBreakdown?.filter((d: any) => d.dayType === 'booking_service').length || 0,
      gross: salary.grossEarned,
      deductions: salary.totalDeductions,
      net: salary.netPayable,
      paid: salary.totalPaid,
      due: salary.remainingBalance,
      status: salary.status,
      paidAt: salary.paidAt
    });
  }

  // Calculate averages
  if (salaries.length > 0) {
    report.statistics.averageGross = report.summary.totalGross / salaries.length;
    report.statistics.averageNet = report.summary.totalNetPayable / salaries.length;
  }

  return report;
}

export async function generateAdvanceReport(tenantId: string | mongoose.Types.ObjectId) {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  const advances = await DriverAdvance.find({
    tenantId: tenantObjId,
    status: { $in: ['approved', 'paid'] }
  }).populate('driverId', 'name phone');

  const report = {
    title: 'Driver Advances Report',
    totalAdvances: advances.length,
    summary: {
      totalAdvanceAmount: 0,
      totalRecovered: 0,
      totalOutstanding: 0
    },
    details: [] as any[]
  };

  for (const advance of advances) {
    report.summary.totalAdvanceAmount += advance.amount;
    report.summary.totalRecovered += advance.totalDeducted;
    report.summary.totalOutstanding += advance.remaining;

    const daysOutstanding = Math.floor(
      (new Date().getTime() - advance.requestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    report.details.push({
      advanceId: advance._id,
      driverId: advance.driverId._id,
      driverName: (advance.driverId as any).name,
      driverPhone: (advance.driverId as any).phone,
      totalAmount: advance.amount,
      recovered: advance.totalDeducted,
      outstanding: advance.remaining,
      requestDate: advance.requestDate,
      daysOutstanding,
      deductionMode: advance.deductionMode,
      status: advance.status,
      recoveryProgress: ((advance.totalDeducted / advance.amount) * 100).toFixed(2) + '%'
    });
  }

  return report;
}

export async function generateRecoveryReport(tenantId: string | mongoose.Types.ObjectId) {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  const recoveries = await DriverRecovery.find({
    tenantId: tenantObjId
  }).populate('driverId', 'name phone');

  const report = {
    title: 'Driver Recovery Report',
    totalRecoveries: recoveries.length,
    summary: {
      totalAmount: 0,
      pendingAmount: 0,
      recoveredAmount: 0
    },
    details: [] as any[],
    byType: {} as any
  };

  for (const recovery of recoveries) {
    report.summary.totalAmount += recovery.amount;

    if (recovery.status === 'pending' || recovery.status === 'approved') {
      report.summary.pendingAmount += recovery.amount;
    } else if (recovery.status === 'recovered') {
      report.summary.recoveredAmount += recovery.amount;
    }

    // Count by type
    if (!report.byType[recovery.type]) {
      report.byType[recovery.type] = { count: 0, amount: 0 };
    }
    report.byType[recovery.type].count++;
    report.byType[recovery.type].amount += recovery.amount;

    report.details.push({
      recoveryId: recovery._id,
      driverId: recovery.driverId._id,
      driverName: (recovery.driverId as any).name,
      amount: recovery.amount,
      type: recovery.type,
      reason: recovery.reason,
      date: recovery.date,
      status: recovery.status,
      daysOldstanding: Math.floor((new Date().getTime() - recovery.date.getTime()) / (1000 * 60 * 60 * 24))
    });
  }

  return report;
}

export async function generateDashboardStats(tenantId: string | mongoose.Types.ObjectId) {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const currentMonthSalaries = await DriverSalary.find({
    tenantId: tenantObjId,
    salaryPeriodStart: { $gte: monthStart },
    salaryPeriodEnd: { $lte: monthEnd }
  });

  const totalPayable = currentMonthSalaries.reduce((sum, s) => sum + s.netPayable, 0);
  const totalPaid = currentMonthSalaries.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalDue = currentMonthSalaries.reduce((sum, s) => sum + s.remainingBalance, 0);

  // Last 3 months trend
  const trend = [];
  for (let i = 2; i >= 0; i--) {
    const month = new Date();
    month.setMonth(month.getMonth() - i);

    const ms = new Date(month.getFullYear(), month.getMonth(), 1);
    const me = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const salaries = await DriverSalary.find({
      tenantId: tenantObjId,
      salaryPeriodStart: { $gte: ms },
      salaryPeriodEnd: { $lte: me }
    });

    const monthPayable = salaries.reduce((sum, s) => sum + s.netPayable, 0);
    const monthPaid = salaries.reduce((sum, s) => sum + s.totalPaid, 0);

    trend.push({
      month: month.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      payable: monthPayable,
      paid: monthPaid,
      driverCount: salaries.length
    });
  }

  // Outstanding advances
  const advances = await DriverAdvance.find({
    tenantId: tenantObjId,
    remaining: { $gt: 0 }
  });

  const totalAdvancesOutstanding = advances.reduce((sum, a) => sum + a.remaining, 0);

  return {
    currentMonth: {
      month: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      totalPayable,
      totalPaid,
      totalDue,
      percentagePaid: totalPayable > 0 ? ((totalPaid / totalPayable) * 100).toFixed(2) : '0',
      driverCount: currentMonthSalaries.length
    },
    trend,
    outstanding: {
      salary: totalDue,
      advances: totalAdvancesOutstanding,
      total: totalDue + totalAdvancesOutstanding
    },
    metrics: {
      salariesGenerated: currentMonthSalaries.length,
      salariesPaid: currentMonthSalaries.filter(s => s.status === 'paid').length,
      salariesPartiallyPaid: currentMonthSalaries.filter(s => s.status === 'partially_paid').length,
      averageSalary: currentMonthSalaries.length > 0 ? (totalPayable / currentMonthSalaries.length).toFixed(2) : '0'
    }
  };
}
