import { useQuery, UseQueryResult } from '@tanstack/react-query';

/**
 * Custom hook for fetching driver payroll data
 * Provides convenient access to salary, payment history, and YTD earnings
 */

export interface PayrollSummary {
  currentMonth: {
    base: number;
    incentives: number;
    deductions: number;
    net: number;
    paid: number;
    pending: number;
    paidPercentage: number;
  };
  lastPayment: {
    date: string | null;
    amount: number;
    status: 'paid' | 'pending' | 'none';
  };
  nextPayment: {
    date: string;
    estimatedAmount: number;
    daysUntil: number;
  };
  ytdEarnings: {
    total: number;
    previousYearTotal: number;
    changePercentage: number;
    trend: 'increasing' | 'decreasing' | 'flat';
  };
  status: {
    color: 'green' | 'yellow' | 'red';
    label: 'on_track' | 'pending' | 'overdue';
    message: string;
  };
}

export interface PayrollDetails extends PayrollSummary {
  details: {
    baseSalary: number;
    allowances: {
      nightDuty: number;
      outstation: number;
      food: number;
      other: number;
    };
    advancesDeduction: number;
    penaltyDeduction: number;
    attendanceBonus: number;
    incentives: number;
  };
  paymentHistory: {
    date: string;
    amount: number;
    mode: string;
    reference: string;
  }[];
}

export interface Driver360WithPayroll {
  driver360: any;
  payroll: PayrollDetails;
  metadata: {
    lastUpdated: string;
    realtime: boolean;
    dataSource: string;
  };
}

/**
 * Fetch payroll summary for a driver
 * Lightweight query for dashboard cards and quick views
 */
export function useDriverPayrollSummary(
  driverId: string,
  enabled?: boolean
): UseQueryResult<{ data: PayrollSummary }, Error> {
  return useQuery({
    queryKey: [`/api/drivers/${driverId}/payroll-summary`],
    enabled: enabled !== false && !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Fetch detailed payroll information
 * Full breakdown including payment history and deductions
 */
export function useDriverPayrollDetails(
  driverId: string,
  enabled?: boolean
): UseQueryResult<{ data: PayrollDetails }, Error> {
  return useQuery({
    queryKey: [`/api/drivers/${driverId}/payroll-details`],
    enabled: enabled !== false && !!driverId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });
}

/**
 * Fetch Driver 360 with integrated payroll data
 * Comprehensive view combining driver profile and payroll
 */
export function useDriver360WithPayroll(
  driverId: string,
  enabled?: boolean
): UseQueryResult<{ data: Driver360WithPayroll }, Error> {
  return useQuery({
    queryKey: [`/api/drivers/${driverId}/360-with-payroll`],
    enabled: enabled !== false && !!driverId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Get status color for badge
 */
export function getStatusColor(
  status: 'on_track' | 'pending' | 'overdue' | 'green' | 'yellow' | 'red'
): string {
  const colorMap = {
    on_track: 'green',
    pending: 'yellow',
    overdue: 'red',
    green: 'green',
    yellow: 'yellow',
    red: 'red'
  };
  return colorMap[status] || 'gray';
}

/**
 * Calculate salary trend
 */
export function calculateSalaryTrend(
  currentNet: number,
  lastMonthNet: number
): {
  percentage: number;
  trend: 'up' | 'down' | 'flat';
  label: string;
} {
  if (lastMonthNet === 0) {
    return { percentage: 0, trend: 'flat', label: 'No previous data' };
  }

  const percentage = ((currentNet - lastMonthNet) / lastMonthNet) * 100;

  if (percentage > 5) {
    return {
      percentage: Math.round(percentage),
      trend: 'up',
      label: `Up ${Math.round(percentage)}%`
    };
  } else if (percentage < -5) {
    return {
      percentage: Math.round(Math.abs(percentage)),
      trend: 'down',
      label: `Down ${Math.round(Math.abs(percentage))}%`
    };
  } else {
    return { percentage: 0, trend: 'flat', label: 'Stable' };
  }
}

/**
 * Determine if payment is overdue
 */
export function isPaymentOverdue(nextPaymentDate: string): boolean {
  const nextDate = new Date(nextPaymentDate);
  const today = new Date();
  return nextDate < today;
}

/**
 * Get days until payment
 */
export function getDaysUntilPayment(nextPaymentDate: string): number {
  const nextDate = new Date(nextPaymentDate);
  const today = new Date();
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Format date for display
 */
export function formatPaymentDate(date: string | Date | null): string {
  if (!date) return 'Not yet paid';

  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get tooltip message for payment status
 */
export function getPaymentStatusTooltip(
  status: string,
  pending: number,
  daysUntil: number
): string {
  switch (status) {
    case 'on_track':
      return 'All payments are current';
    case 'pending':
      return `${formatCurrency(pending)} pending - Due in ${daysUntil} days`;
    case 'overdue':
      return `${formatCurrency(pending)} overdue - Payment action required`;
    default:
      return 'Check payment status';
  }
}
