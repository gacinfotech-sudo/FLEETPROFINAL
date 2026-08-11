import { z } from 'zod';

// DriverSalaryMaster Schema Validation
export const createSalaryMasterSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  driverId: z.string().min(1, 'Driver ID is required'),
  salaryType: z.enum(['fixed_monthly', 'daily', 'per_trip', 'fixed_incentive', 'custom']),
  baseSalary: z.number().min(0, 'Base salary cannot be negative'),
  perDaySalary: z.number().min(0).optional(),
  perTripSalary: z.number().min(0).optional(),
  kmIncentivePerKm: z.number().min(0).optional(),
  nightAllowancePerNight: z.number().min(0).optional(),
  outstationAllowancePerDay: z.number().min(0).optional(),
  foodAllowance: z.number().min(0).optional(),
  overtimeRatePerHour: z.number().min(0).optional(),
  extraDutyRate: z.number().min(0).optional(),
  weeklyOffDays: z.array(z.number().min(0).max(6)).optional(),
  weeklyOffLeaveType: z.enum(['paid', 'unpaid', 'compensatory']).optional(),
  salaryStartDate: z.coerce.date(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional()
}).strict();

export const updateSalaryMasterSchema = createSalaryMasterSchema.partial().extend({
  status: z.enum(['active', 'inactive']).optional()
});

// DriverAdvance Schema Validation
export const createAdvanceRequestSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  driverId: z.string().min(1, 'Driver ID is required'),
  amount: z.number().min(100, 'Advance amount must be at least ₹100').max(1000000, 'Advance amount cannot exceed ₹10,00,000'),
  reason: z.string().optional(),
  deductionMode: z.enum(['full_next_salary', 'emi', 'manual']),
  emiInstallments: z.number().min(2).max(24).optional()
}).strict().refine(
  (data) => {
    if (data.deductionMode === 'emi' && !data.emiInstallments) {
      return false;
    }
    return true;
  },
  { message: 'EMI installments required for EMI deduction mode' }
);

export const approveAdvanceSchema = z.object({
  approvedBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  }),
  notes: z.string().optional()
}).strict();

export const recordAdvancePaymentSchema = z.object({
  paidBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  }),
  paymentMode: z.enum(['cash', 'bank_transfer', 'upi']),
  transactionReference: z.string().optional()
}).strict();

export const recordAdvanceDeductionSchema = z.object({
  advanceId: z.string().min(1),
  deductedAmount: z.number().min(0),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  recordedBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  })
}).strict();

// Monthly Payroll Schema Validation
export const calculatePayrollSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  drivers: z.array(z.string()).optional(),
  overrideAttendance: z.record(z.string(), z.object({
    presentDays: z.number().min(0).max(31),
    absentDays: z.number().min(0).max(31),
    paidLeaves: z.number().min(0).max(31),
    unpaidLeaves: z.number().min(0).max(31),
    halfDays: z.number().min(0).max(31),
    weeklyOffs: z.number().min(0).max(31),
    totalWorkingDays: z.number().min(0).max(31)
  })).optional(),
  overrideTripIncentives: z.record(z.string(), z.object({
    totalTrips: z.number().min(0),
    totalKm: z.number().min(0),
    nightDutyTrips: z.number().min(0),
    outstationTrips: z.number().min(0),
    specialDutyTrips: z.number().min(0)
  })).optional(),
  overrideDeductions: z.record(z.string(), z.object({
    absenceDays: z.number().min(0),
    penalties: z.number().min(0),
    damageRecovery: z.number().min(0),
    challanRecovery: z.number().min(0),
    cashShortage: z.number().min(0),
    fuelExcess: z.number().min(0),
    otherDeductions: z.number().min(0)
  })).optional()
}).strict();

export const approvePayrollSchema = z.object({
  approvedBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  }),
  notes: z.string().optional()
}).strict();

export const recordPaymentSchema = z.object({
  driverId: z.string().min(1),
  paidAmount: z.number().min(0),
  paymentMode: z.enum(['cash', 'bank_transfer', 'upi', 'split']),
  paidBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  }),
  transactionReference: z.string().optional()
}).strict();

// DriverSalaryLedger Schema Validation
export const recordLedgerEntrySchema = z.object({
  tenantId: z.string().min(1),
  driverId: z.string().min(1),
  driverName: z.string().min(1),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  transactionType: z.enum([
    'base_salary', 'attendance_bonus', 'trip_incentive', 'km_incentive',
    'night_allowance', 'outstation_allowance', 'food_allowance',
    'overtime_earning', 'bonus', 'manual_incentive',
    'absence_deduction', 'advance_recovery', 'loan_recovery',
    'penalty', 'damage_recovery', 'challan_recovery',
    'cash_shortage', 'fuel_excess', 'other_deduction'
  ]),
  amount: z.number().min(0),
  reason: z.string().optional(),
  referenceType: z.enum(['booking_id', 'advance_id', 'trip_id', 'deduction_id', 'manual']).optional(),
  referenceId: z.string().optional(),
  createdBy: z.object({
    userId: z.string().min(1),
    role: z.string().min(1)
  })
}).strict();

// Query validation schemas
export const payrollListQuerySchema = z.object({
  status: z.string().optional(),
  month: z.string().transform(Number).optional(),
  year: z.string().transform(Number).optional()
}).strict();

export const advanceListQuerySchema = z.object({
  status: z.string().optional(),
  driverId: z.string().optional()
}).strict();

export const ledgerQuerySchema = z.object({
  month: z.string().transform(Number),
  year: z.string().transform(Number),
  driverId: z.string().optional()
}).strict();
