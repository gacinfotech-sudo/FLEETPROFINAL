import { IDriverSalaryMaster, IDriverAdvance } from '../models/index';

export interface AttendanceData {
  presentDays: number;
  absentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  halfDays: number;
  weeklyOffs: number;
  totalWorkingDays: number;
}

export interface TripIncentiveData {
  totalTrips: number;
  totalKm: number;
  nightDutyTrips: number;
  outstationTrips: number;
  specialDutyTrips: number;
}

export interface DeductionData {
  absenceDays: number;
  penalties: number;
  damageRecovery: number;
  challanRecovery: number;
  cashShortage: number;
  fuelExcess: number;
  otherDeductions: number;
}

export interface SalaryCalculationInput {
  salaryMaster: IDriverSalaryMaster;
  month: number;
  year: number;
  attendance?: AttendanceData;
  tripIncentives?: TripIncentiveData;
  deductions?: DeductionData;
  advances?: IDriverAdvance[];
}

export interface SalaryBreakup {
  month: number;
  year: number;
  driverId: string;
  driverName: string;
  salaryType: string;

  // Earnings components
  earnings: {
    baseSalary: number;
    attendanceBonus: number;
    tripIncentive: number;
    kmIncentive: number;
    nightAllowance: number;
    outstationAllowance: number;
    foodAllowance: number;
    overtimeEarnings: number;
    bonusAmount: number;
    manualIncentive: number;
  };
  grossSalary: number;

  // Deduction components
  deductions: {
    absenceDeduction: number;
    advanceRecovery: number;
    loanRecovery: number;
    penaltyDeduction: number;
    damageRecovery: number;
    challanRecovery: number;
    cashShortage: number;
    fuelExcessRecovery: number;
    otherDeductions: number;
  };
  totalDeductions: number;

  // Net salary
  netSalary: number;

  // Calculation notes (for audit trail)
  calculationNotes: {
    workingDaysUsed: number;
    absentDaysDeducted: number;
    advanceRecoveryAmount: number;
    totalRecoveryInstallments: number;
  };
}

export function calculateSalary(input: SalaryCalculationInput): SalaryBreakup {
  const {
    salaryMaster,
    month,
    year,
    attendance,
    tripIncentives,
    deductions,
    advances
  } = input;

  const breakup: SalaryBreakup = {
    month,
    year,
    driverId: salaryMaster.driverId.toString(),
    driverName: salaryMaster.name,
    salaryType: salaryMaster.salaryType,
    earnings: {
      baseSalary: 0,
      attendanceBonus: 0,
      tripIncentive: 0,
      kmIncentive: 0,
      nightAllowance: 0,
      outstationAllowance: 0,
      foodAllowance: 0,
      overtimeEarnings: 0,
      bonusAmount: 0,
      manualIncentive: 0
    },
    grossSalary: 0,
    deductions: {
      absenceDeduction: 0,
      advanceRecovery: 0,
      loanRecovery: 0,
      penaltyDeduction: 0,
      damageRecovery: 0,
      challanRecovery: 0,
      cashShortage: 0,
      fuelExcessRecovery: 0,
      otherDeductions: 0
    },
    totalDeductions: 0,
    netSalary: 0,
    calculationNotes: {
      workingDaysUsed: attendance?.totalWorkingDays || 0,
      absentDaysDeducted: attendance?.absentDays || 0,
      advanceRecoveryAmount: 0,
      totalRecoveryInstallments: advances?.length || 0
    }
  };

  // Calculate earnings
  calculateEarnings(breakup, salaryMaster, attendance, tripIncentives);

  // Calculate deductions
  calculateDeductions(breakup, salaryMaster, attendance, deductions, advances);

  // Net salary = Gross - Total Deductions (ensure non-negative)
  breakup.netSalary = Math.max(0, breakup.grossSalary - breakup.totalDeductions);

  return breakup;
}

function calculateEarnings(
  breakup: SalaryBreakup,
  salaryMaster: IDriverSalaryMaster,
  attendance?: AttendanceData,
  tripIncentives?: TripIncentiveData
) {
  const isPerTripSalary = salaryMaster.salaryType === 'per_trip';

  switch (salaryMaster.salaryType) {
    case 'fixed_monthly':
      breakup.earnings.baseSalary = salaryMaster.baseSalary;
      break;

    case 'daily':
      if (attendance) {
        const workingDays = Math.max(0, attendance.presentDays + attendance.halfDays * 0.5);
        breakup.earnings.baseSalary = (salaryMaster.perDaySalary || 0) * workingDays;
      }
      break;

    case 'per_trip':
      if (tripIncentives) {
        breakup.earnings.baseSalary = (salaryMaster.perTripSalary || 0) * tripIncentives.totalTrips;
      }
      break;

    case 'fixed_incentive':
    case 'custom':
      breakup.earnings.baseSalary = salaryMaster.baseSalary;
      break;
  }

  // Add trip incentives if applicable (but NOT for per_trip salary type, as it's already in base)
  if (tripIncentives && !isPerTripSalary) {
    breakup.earnings.tripIncentive = (salaryMaster.perTripSalary || 0) * tripIncentives.totalTrips;
    breakup.earnings.kmIncentive = (salaryMaster.kmIncentivePerKm || 0) * tripIncentives.totalKm;
    breakup.earnings.nightAllowance = (salaryMaster.nightAllowancePerNight || 0) * tripIncentives.nightDutyTrips;
    breakup.earnings.outstationAllowance = (salaryMaster.outstationAllowancePerDay || 0) * tripIncentives.outstationTrips;
  }

  // Add fixed allowances
  breakup.earnings.foodAllowance = salaryMaster.foodAllowance || 0;

  // Calculate gross salary (sum of all earnings)
  breakup.grossSalary = Object.values(breakup.earnings).reduce((sum, val) => sum + val, 0);
}

function calculateDeductions(
  breakup: SalaryBreakup,
  salaryMaster: IDriverSalaryMaster,
  attendance?: AttendanceData,
  deductions?: DeductionData,
  advances?: IDriverAdvance[]
) {
  // Absence deduction (absent days * per day salary)
  if (attendance && attendance.absentDays > 0) {
    const perDaySalary =
      salaryMaster.perDaySalary ||
      (salaryMaster.baseSalary / (attendance.totalWorkingDays || 26));

    breakup.deductions.absenceDeduction = attendance.absentDays * perDaySalary;
  }

  // Advance recovery
  if (advances && advances.length > 0) {
    for (const advance of advances) {
      if (advance.status === 'paid') {
        if (advance.deductionMode === 'full_next_salary') {
          breakup.deductions.advanceRecovery += advance.remaining;
          breakup.calculationNotes.advanceRecoveryAmount += advance.remaining;
        } else if (advance.deductionMode === 'emi' && advance.emiAmount) {
          breakup.deductions.advanceRecovery += advance.emiAmount;
          breakup.calculationNotes.advanceRecoveryAmount += advance.emiAmount;
        }
      }
    }
  }

  // Other deductions
  if (deductions) {
    breakup.deductions.penaltyDeduction = deductions.penalties || 0;
    breakup.deductions.damageRecovery = deductions.damageRecovery || 0;
    breakup.deductions.challanRecovery = deductions.challanRecovery || 0;
    breakup.deductions.cashShortage = deductions.cashShortage || 0;
    breakup.deductions.fuelExcessRecovery = deductions.fuelExcess || 0;
    breakup.deductions.otherDeductions = deductions.otherDeductions || 0;
  }

  // Calculate total deductions
  breakup.totalDeductions = Object.values(breakup.deductions).reduce((sum, val) => sum + val, 0);
}

// Integration hook: Fetch attendance data (placeholder for future integration)
export async function fetchAttendanceData(
  driverId: string,
  month: number,
  year: number
): Promise<AttendanceData | null> {
  // TODO: Integrate with FleetPro Attendance module when ready
  // For now: return null to indicate manual entry required
  return null;
}

// Integration hook: Fetch trip incentive data (placeholder for future integration)
export async function fetchTripIncentiveData(
  driverId: string,
  month: number,
  year: number
): Promise<TripIncentiveData | null> {
  // TODO: Integrate with FleetPro Trips/Bookings module when ready
  // For now: return null to indicate manual entry required
  return null;
}

export function validateCalculationInput(input: SalaryCalculationInput) {
  if (!input.salaryMaster) {
    throw new Error('Salary master configuration required');
  }

  if (input.month < 1 || input.month > 12) {
    throw new Error('Invalid month value');
  }

  if (input.year < 2020) {
    throw new Error('Invalid year value');
  }

  if (input.attendance) {
    const totalDays =
      (input.attendance.presentDays || 0) +
      (input.attendance.absentDays || 0) +
      (input.attendance.paidLeaves || 0) +
      (input.attendance.unpaidLeaves || 0) +
      (input.attendance.weeklyOffs || 0) +
      (input.attendance.halfDays || 0);

    // Calculate actual days in the month
    const daysInMonth = new Date(input.year, input.month, 0).getDate();

    if (totalDays > daysInMonth) {
      throw new Error(`Total attendance days (${totalDays}) exceed calendar days in ${input.month}/${input.year} (${daysInMonth})`);
    }
  }
}

export function formatSalaryBreakup(breakup: SalaryBreakup): string {
  const lines = [
    `Salary Breakdown for ${breakup.driverName} (${breakup.month}/${breakup.year})`,
    `Salary Type: ${breakup.salaryType}`,
    '',
    'EARNINGS:',
    ...Object.entries(breakup.earnings)
      .filter(([, val]) => val > 0)
      .map(([key, val]) => `  ${key}: ₹${val.toFixed(2)}`),
    `Gross Salary: ₹${breakup.grossSalary.toFixed(2)}`,
    '',
    'DEDUCTIONS:',
    ...Object.entries(breakup.deductions)
      .filter(([, val]) => val > 0)
      .map(([key, val]) => `  ${key}: ₹${val.toFixed(2)}`),
    `Total Deductions: ₹${breakup.totalDeductions.toFixed(2)}`,
    '',
    `NET SALARY: ₹${breakup.netSalary.toFixed(2)}`
  ];

  return lines.join('\n');
}
