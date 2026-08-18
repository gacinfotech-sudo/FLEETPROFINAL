import {
  Driver, Booking, CustomerFeedback,
  PaymentTransaction, DriverAttendance, DriverLeave
} from '../models/index';
import { DriverIncident } from '../driver/operations/models';
import mongoose from 'mongoose';
import { computeBookingTimeline } from './timelineService';

/**
 * WAVE 3: DRIVER 360 SERVICE
 * Complete driver operational command centre
 * Single view of all driver-related operations
 */

export interface Driver360Data {
  // Overview & Personal
  driver: any;
  availability: {
    status: 'available' | 'on_trip' | 'on_leave' | 'suspended';
    currentTrip: string | null;
    leaveStatus: string | null;
  };

  // Current & Upcoming
  currentBooking: any | null;
  upcomingBookings: any[];

  // Trip History
  completedTrips: number;
  totalKilometers: number;
  averageRating: number;
  tripHistory: any[];

  // Documents & Compliance
  documents: {
    license: any;
    licenseExpiry?: Date;
    licenseValid: boolean;
    aadhar: any;
    panCard: any;
    policeVerification: any;
    policeVerificationExpiry?: Date;
    insurance: any;
  };
  complianceStatus: {
    allDocumentsValid: boolean;
    expiringDocuments: string[];
    missingDocuments: string[];
  };

  // Leave & Attendance
  leaveHistory: any[];
  upcomingLeave: any[];
  attendanceCount: number;
  attendancePercentage: number;

  // Performance
  performance: {
    averageRating: number;
    totalFeedback: number;
    complaintCount: number;
    incidentCount: number;
    onTimePercentage: number;
  };

  // Incidents
  incidents: any[];
  activeIncidents: any[];

  // Salary & Payments
  salary: {
    monthlyBaseSalary: number;
    advances: number;
    deductions: number;
    totalEarnings: number;
  };

  // Timeline
  timeline: any[];

  // Alerts
  alerts: {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

/**
 * Get complete Driver 360 data
 */
export async function getDriver360(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId
): Promise<Driver360Data | null> {
  const driver = await Driver.findOne({
    _id: driverId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!driver) {
    return null;
  }

  // Fetch all related data in parallel
  const [bookings, compliance, incidents, feedback, payments, attendance, leave] = await Promise.all([
    Booking.find({ tenantId, driverId }).sort({ pickupDate: -1 }),
    // No separate DriverCompliance collection exists — empty list, never
    // invented records (compliance lives in the driver document registry).
    Promise.resolve([] as any[]),
    DriverIncident.find({ tenantId, driverId }).sort({ incidentDate: -1 }).limit(100),
    // Driver ratings come from CustomerFeedback rows linked to the driver.
    CustomerFeedback.find({ tenantId, driverId }).sort({ createdAt: -1 }).limit(100),
    PaymentTransaction.find({ tenantId, driverId }).sort({ receivedAt: -1 }),
    DriverAttendance.find({ tenantId, driverId }).sort({ date: -1 }),
    DriverLeave.find({ tenantId, driverId }).sort({ fromDate: -1 }),
  ]);

  // Categorize bookings
  const now = new Date();
  const currentBooking = bookings.find(b => ['trip_started', 'ongoing'].includes(b.status));
  const upcomingBookings = bookings.filter(
    b => b.pickupDate && new Date(b.pickupDate) > now && ['confirmed', 'ready_for_dispatch'].includes(b.status)
  ).slice(0, 5);
  const completedBookings = bookings.filter(b => b.status === 'completed');

  // Calculate trip statistics
  const totalKilometers = bookings.reduce((sum: number, b: any) => {
    if (b.endOdometer && b.startOdometer) {
      return sum + (b.endOdometer - b.startOdometer);
    }
    return sum;
  }, 0);

  // Get average rating
  const avgRating = feedback.length > 0
    ? feedback.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / feedback.length
    : 0;

  // Compliance documents check
  const licenses = compliance.filter((c: any) => c.documentType === 'license');
  const aadhar = compliance.find((c: any) => c.documentType === 'aadhar');
  const panCard = compliance.find((c: any) => c.documentType === 'pan');
  const pv = compliance.find((c: any) => c.documentType === 'police_verification');

  const licenseValid = licenses.length > 0 && licenses[0].expiryDate > now;
  const pvValid = pv && pv.expiryDate > now;

  const expiringDocuments: string[] = [];
  const daysUntilExpiry = 30;
  if (licenses.length > 0 && licenses[0].expiryDate) {
    const daysLeft = (licenses[0].expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft < daysUntilExpiry) expiringDocuments.push(`License (expires in ${Math.ceil(daysLeft)} days)`);
  }
  if (pv && pv.expiryDate) {
    const daysLeft = (pv.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft < daysUntilExpiry) expiringDocuments.push(`Police Verification (expires in ${Math.ceil(daysLeft)} days)`);
  }

  // Leave status
  const activeLeave = leave.find((l: any) => l.fromDate <= now && (!l.toDate || l.toDate >= now));
  const upcomingLeaveRecords = leave.filter((l: any) => l.fromDate > now).slice(0, 3);

  // Attendance percentage
  const attendanceRecords = attendance.filter((a: any) => a.status === 'present');
  const attendancePercentage = attendance.length > 0
    ? Math.round((attendanceRecords.length / attendance.length) * 100)
    : 0;

  // On-time percentage
  const completedOnTime = completedBookings.filter((b: any) =>
    b.actualStartDateTime && b.scheduledStartDateTime &&
    new Date(b.actualStartDateTime) <= new Date(b.scheduledStartDateTime)
  ).length;
  const onTimePercentage = completedBookings.length > 0
    ? Math.round((completedOnTime / completedBookings.length) * 100)
    : 0;

  // Active incidents
  const activeIncidents = incidents.filter((i: any) => i.status !== 'resolved').slice(0, 3);

  // Alerts
  const alerts: any[] = [];
  if (expiringDocuments.length > 0) {
    alerts.push({
      type: 'compliance',
      message: expiringDocuments.join(', '),
      severity: 'high' as const,
    });
  }
  if (activeIncidents.length > 0) {
    alerts.push({
      type: 'incident',
      message: `${activeIncidents.length} unresolved incident(s)`,
      severity: 'high' as const,
    });
  }
  if (driver.status === 'inactive') {
    alerts.push({
      type: 'suspension',
      message: 'Driver account suspended',
      severity: 'high' as const,
    });
  }

  return {
    driver: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      altPhone: (driver as any).alternatePhone ?? null,
      email: driver.email,
      address: driver.permanentAddress,
      status: driver.status,
      joinDate: driver.dateOfJoining,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: licenses.length > 0 ? licenses[0].expiryDate : null,
    },
    availability: {
      status: currentBooking ? 'on_trip' : activeLeave ? 'on_leave' : driver.status === 'inactive' ? 'suspended' : 'available',
      currentTrip: currentBooking?.bookingId || null,
      leaveStatus: activeLeave ? activeLeave.leaveType : null,
    },
    currentBooking: currentBooking ? {
      bookingId: currentBooking.bookingId,
      customer: currentBooking.customerName,
      pickup: currentBooking.pickupLocation,
      drop: currentBooking.dropoffLocation,
      startedAt: currentBooking.actualStartDateTime,
    } : null,
    upcomingBookings,
    completedTrips: completedBookings.length,
    totalKilometers,
    averageRating: avgRating,
    tripHistory: completedBookings.slice(0, 10),
    documents: {
      license: licenses.length > 0 ? licenses[0] : null,
      licenseExpiry: licenses.length > 0 ? licenses[0].expiryDate : null,
      licenseValid,
      aadhar: aadhar || null,
      panCard: panCard || null,
      policeVerification: pv || null,
      policeVerificationExpiry: pv?.expiryDate || null,
      insurance: compliance.find((c: any) => c.documentType === 'insurance') || null,
    },
    complianceStatus: {
      allDocumentsValid: licenseValid && pvValid,
      expiringDocuments,
      missingDocuments: [
        !aadhar ? 'Aadhar' : null,
        !panCard ? 'PAN Card' : null,
      ].filter(Boolean) as string[],
    },
    leaveHistory: leave.filter((l: any) => l.toDate && l.toDate < now).slice(0, 5),
    upcomingLeave: upcomingLeaveRecords,
    attendanceCount: attendanceRecords.length,
    attendancePercentage,
    performance: {
      averageRating: avgRating,
      totalFeedback: feedback.length,
      complaintCount: incidents.filter((i: any) => i.type === 'complaint').length,
      incidentCount: incidents.length,
      onTimePercentage,
    },
    incidents: incidents.slice(0, 5),
    activeIncidents,
    salary: {
      monthlyBaseSalary: ((driver as any).baseSalary ?? 0),
      advances: payments.filter((p: any) => p.paymentType === 'advance').reduce((s: number, p: any) => s + p.amount, 0),
      deductions: payments.filter((p: any) => p.paymentType === 'deduction').reduce((s: number, p: any) => s + p.amount, 0),
      totalEarnings: payments.reduce((s: number, p: any) => s + p.amount, 0),
    },
    timeline: [], // TODO: wire timeline events for driver
    alerts,
  };
}

/**
 * Get Driver 360 KPI summary
 */
export async function getDriver360KPISummary(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId
): Promise<any> {
  const data = await getDriver360(tenantId, driverId);

  if (!data) return null;

  return {
    driverId,
    status: data.availability.status,
    completedTrips: data.completedTrips,
    averageRating: data.averageRating,
    attendancePercentage: data.attendancePercentage,
    onTimePercentage: data.performance.onTimePercentage,
    activeAlerts: data.alerts.length,
    complianceStatus: data.complianceStatus.allDocumentsValid ? 'valid' : 'needs_attention',
  };
}

/**
 * Get Driver 360 with enhanced payroll data
 * Imports payroll aggregation service to include detailed salary info
 */
export async function getDriver360WithEnhancedPayroll(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId
): Promise<(Driver360Data & { enhancedSalary?: any }) | null> {
  const baseData = await getDriver360(tenantId, driverId);

  if (!baseData) {
    return null;
  }

  try {
    const { getDriverPayrollAggregation } = await import('./driverPayrollAggregationService');
    const enhancedSalary = await getDriverPayrollAggregation(tenantId, driverId);

    return {
      ...baseData,
      enhancedSalary,
      salaryLastUpdated: new Date()
    };
  } catch (error) {
    console.error('[Driver360] Error loading enhanced payroll data:', error);
    // Return base data if payroll aggregation fails
    return baseData;
  }
}

/**
 * Get Driver 360 quick actions
 */
export interface Driver360Action {
  id: string;
  label: string;
  icon: string;
  action: string;
  isAvailable: boolean;
  condition?: string;
}

export function getDriver360QuickActions(driver360: Driver360Data): Driver360Action[] {
  const canAssignTrip = driver360.availability.status === 'available';
  const canApproveLeave = driver360.upcomingLeave.length > 0;
  const hasComplianceIssues = driver360.alerts.some(a => a.type === 'compliance');

  return [
    {
      id: 'assign_trip',
      label: 'Assign Trip',
      icon: 'Calendar',
      action: 'assign_trip',
      isAvailable: canAssignTrip,
      condition: canAssignTrip ? undefined : `Driver ${driver360.availability.status}`,
    },
    {
      id: 'view_current_trip',
      label: 'View Current Trip',
      icon: 'MapPin',
      action: 'view_current_trip',
      isAvailable: driver360.currentBooking !== null,
      condition: driver360.currentBooking ? undefined : 'No active trip',
    },
    {
      id: 'record_attendance',
      label: 'Record Attendance',
      icon: 'CheckCircle',
      action: 'record_attendance',
      isAvailable: true,
    },
    {
      id: 'approve_leave',
      label: 'Approve Leave Request',
      icon: 'Calendar',
      action: 'approve_leave',
      isAvailable: canApproveLeave,
      condition: canApproveLeave ? undefined : 'No pending leave requests',
    },
    {
      id: 'view_compliance',
      label: 'View Compliance',
      icon: 'CheckSquare',
      action: 'view_compliance',
      isAvailable: true,
    },
    ...(hasComplianceIssues ? [{
      id: 'renew_documents',
      label: 'Renew Documents',
      icon: 'AlertCircle',
      action: 'renew_documents',
      isAvailable: true,
      condition: undefined,
    }] : []),
    {
      id: 'view_performance',
      label: 'View Performance',
      icon: 'TrendingUp',
      action: 'view_performance',
      isAvailable: true,
    },
    {
      id: 'record_incident',
      label: 'Record Incident',
      icon: 'AlertTriangle',
      action: 'record_incident',
      isAvailable: true,
    },
  ];
}
