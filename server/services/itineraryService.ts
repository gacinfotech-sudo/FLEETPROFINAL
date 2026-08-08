import { Itinerary } from '../models/index';
import { IItinerary } from '../models/index';
import mongoose from 'mongoose';

// ============================================================================
// CANONICAL ITINERARY SERVICE (WAVE 1 - DATA FOUNDATIONS)
// ============================================================================
// Manages creation, updating, versioning, and approval of trip itineraries.
// Core principle: One itinerary per booking, never silently overwritten.
// Previous versions kept for audit trail.

export interface ItineraryDayPlan {
  day: number;
  date: Date;
  location?: string;
  places?: string[];
  hotel?: string;
  flightDetails?: string;
  trainDetails?: string;
  reportingTime?: string;
  approximateTimings?: string;
  description?: string;
}

export interface CreateItineraryInput {
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  title: string;
  tripStartDate: Date;
  tripEndDate: Date;
  reportingTime?: string;
  pickupLocation: string;
  pickupTime?: string;
  dropLocation?: string;
  dropTime?: string;
  dayWisePlan: ItineraryDayPlan[];
  passengerCount?: number;
  passengerNames?: string[];
  specialInstructions?: string;
  seniorCitizenNotes?: string;
  includedServices?: string[];
  excludedServices?: string[];
  extraKmPolicy?: string;
  extraHourPolicy?: string;
  tollResponsibility?: 'customer' | 'driver' | 'company';
  parkingResponsibility?: 'customer' | 'driver' | 'company';
  nightHaltResponsibility?: 'customer' | 'driver' | 'company';
  driverAllowance?: number;
  driverAllowanceDetails?: string;
  amountToCollect?: number;
  collectionMode?: 'cash' | 'upi' | 'card' | 'bank_transfer';
  internalNotes?: string;
  createdBy?: { userId: string; userName: string };
}

export interface UpdateItineraryInput extends Partial<CreateItineraryInput> {
  status?: 'draft' | 'discussed' | 'approved' | 'final' | 'archived';
  reason?: string;
  updatedBy?: { userId: string; userName: string };
}

/**
 * Create a new itinerary for a booking
 */
export async function createItinerary(input: CreateItineraryInput): Promise<IItinerary> {
  // Ensure only one itinerary per booking
  const existing = await Itinerary.findOne({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    status: { $ne: 'archived' },
  });

  if (existing) {
    throw new Error(
      `Itinerary already exists for booking ${input.bookingId}. Status: ${existing.status}. ` +
      'Archive the existing itinerary before creating a new one, or update the existing one.'
    );
  }

  const totalDays = calculateTotalDays(input.tripStartDate, input.tripEndDate);

  const itinerary = new Itinerary({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    title: input.title,
    tripStartDate: input.tripStartDate,
    tripEndDate: input.tripEndDate,
    reportingTime: input.reportingTime,
    totalDays,
    pickupLocation: input.pickupLocation,
    pickupTime: input.pickupTime,
    dropLocation: input.dropLocation,
    dropTime: input.dropTime,
    dayWisePlan: input.dayWisePlan,
    passengerCount: input.passengerCount,
    passengerNames: input.passengerNames,
    specialInstructions: input.specialInstructions,
    seniorCitizenNotes: input.seniorCitizenNotes,
    includedServices: input.includedServices,
    excludedServices: input.excludedServices,
    extraKmPolicy: input.extraKmPolicy,
    extraHourPolicy: input.extraHourPolicy,
    tollResponsibility: input.tollResponsibility,
    parkingResponsibility: input.parkingResponsibility,
    nightHaltResponsibility: input.nightHaltResponsibility,
    driverAllowance: input.driverAllowance,
    driverAllowanceDetails: input.driverAllowanceDetails,
    amountToCollect: input.amountToCollect,
    collectionMode: input.collectionMode,
    internalNotes: input.internalNotes,
    createdBy: input.createdBy,
    status: 'draft',
    approvalHistory: [
      {
        status: 'draft',
        approvedAt: new Date(),
        approvedBy: input.createdBy,
      },
    ],
  });

  return itinerary.save();
}

/**
 * Update an itinerary and keep version history
 * Prevents silent overwrites by maintaining previous versions
 */
export async function updateItinerary(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  updates: UpdateItineraryInput
): Promise<IItinerary> {
  const itinerary = await Itinerary.findOne({
    tenantId,
    bookingId,
    status: { $ne: 'archived' },
  });

  if (!itinerary) {
    throw new Error(`Itinerary not found for booking ${bookingId}`);
  }

  // Save previous version before updating
  if (itinerary.previousVersions === undefined) {
    itinerary.previousVersions = [];
  }

  itinerary.previousVersions.push({
    status: itinerary.status,
    data: {
      title: itinerary.title,
      tripStartDate: itinerary.tripStartDate,
      tripEndDate: itinerary.tripEndDate,
      dayWisePlan: itinerary.dayWisePlan,
      specialInstructions: itinerary.specialInstructions,
      seniorCitizenNotes: itinerary.seniorCitizenNotes,
      includedServices: itinerary.includedServices,
      excludedServices: itinerary.excludedServices,
    },
    changedAt: new Date(),
    changedBy: updates.updatedBy,
    reason: updates.reason,
  });

  // Apply updates
  const fieldsToUpdate = [
    'title',
    'tripStartDate',
    'tripEndDate',
    'reportingTime',
    'pickupLocation',
    'pickupTime',
    'dropLocation',
    'dropTime',
    'dayWisePlan',
    'passengerCount',
    'passengerNames',
    'specialInstructions',
    'seniorCitizenNotes',
    'includedServices',
    'excludedServices',
    'extraKmPolicy',
    'extraHourPolicy',
    'tollResponsibility',
    'parkingResponsibility',
    'nightHaltResponsibility',
    'driverAllowance',
    'driverAllowanceDetails',
    'amountToCollect',
    'collectionMode',
    'internalNotes',
  ];

  for (const field of fieldsToUpdate) {
    if (updates[field as keyof UpdateItineraryInput] !== undefined) {
      (itinerary as any)[field] = updates[field as keyof UpdateItineraryInput];
    }
  }

  // Recalculate total days if dates changed
  if (updates.tripStartDate || updates.tripEndDate) {
    itinerary.totalDays = calculateTotalDays(
      updates.tripStartDate || itinerary.tripStartDate,
      updates.tripEndDate || itinerary.tripEndDate
    );
  }

  itinerary.updatedBy = updates.updatedBy;

  return itinerary.save();
}

/**
 * Change itinerary status (Draft → Discussed → Approved → Final)
 * Record approval history
 */
export async function approveItinerary(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  newStatus: 'discussed' | 'approved' | 'final',
  approvedBy: { userId: string; userName: string }
): Promise<IItinerary> {
  const itinerary = await Itinerary.findOne({
    tenantId,
    bookingId,
    status: { $ne: 'archived' },
  });

  if (!itinerary) {
    throw new Error(`Itinerary not found for booking ${bookingId}`);
  }

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    draft: ['discussed', 'approved', 'final'],
    discussed: ['approved', 'final', 'draft'],
    approved: ['final', 'discussed'],
    final: [], // Final is locked (create new version if changes needed)
    archived: [],
  };

  if (!validTransitions[itinerary.status]?.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${itinerary.status} to ${newStatus}. ` +
      `Valid transitions from ${itinerary.status}: ${validTransitions[itinerary.status].join(', ')}`
    );
  }

  itinerary.status = newStatus;
  if (!itinerary.approvalHistory) {
    itinerary.approvalHistory = [];
  }

  itinerary.approvalHistory.push({
    status: newStatus,
    approvedAt: new Date(),
    approvedBy,
  });

  return itinerary.save();
}

/**
 * Get itinerary for a booking
 */
export async function getItinerary(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId
): Promise<IItinerary | null> {
  return Itinerary.findOne({
    tenantId,
    bookingId,
    status: { $ne: 'archived' },
  });
}

/**
 * Get all versions of an itinerary (for audit trail)
 */
export async function getItineraryVersions(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId
): Promise<any[]> {
  const itinerary = await Itinerary.findOne({ tenantId, bookingId });

  if (!itinerary) {
    return [];
  }

  const versions = [];

  // Add current version
  versions.push({
    status: itinerary.status,
    data: {
      title: itinerary.title,
      tripStartDate: itinerary.tripStartDate,
      tripEndDate: itinerary.tripEndDate,
      dayWisePlan: itinerary.dayWisePlan,
      specialInstructions: itinerary.specialInstructions,
    },
    changedAt: itinerary.updatedAt,
    changedBy: itinerary.updatedBy,
  });

  // Add previous versions in reverse chronological order
  if (itinerary.previousVersions) {
    versions.push(...itinerary.previousVersions.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()));
  }

  return versions;
}

/**
 * Archive an itinerary (soft delete)
 */
export async function archiveItinerary(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  reason?: string
): Promise<IItinerary> {
  const itinerary = await Itinerary.findOne({ tenantId, bookingId });

  if (!itinerary) {
    throw new Error(`Itinerary not found for booking ${bookingId}`);
  }

  if (itinerary.previousVersions === undefined) {
    itinerary.previousVersions = [];
  }

  itinerary.previousVersions.push({
    status: itinerary.status,
    data: {
      title: itinerary.title,
      tripStartDate: itinerary.tripStartDate,
      tripEndDate: itinerary.tripEndDate,
      dayWisePlan: itinerary.dayWisePlan,
      specialInstructions: itinerary.specialInstructions,
    },
    changedAt: new Date(),
    reason: reason || 'Archived',
  });

  itinerary.status = 'archived';

  return itinerary.save();
}

/**
 * Format itinerary for customer (hide internal notes)
 */
export function formatItineraryForCustomer(itinerary: IItinerary): any {
  return {
    title: itinerary.title,
    tripStartDate: itinerary.tripStartDate,
    tripEndDate: itinerary.tripEndDate,
    totalDays: itinerary.totalDays,
    pickupLocation: itinerary.pickupLocation,
    pickupTime: itinerary.pickupTime,
    dropLocation: itinerary.dropLocation,
    dropTime: itinerary.dropTime,
    reportingTime: itinerary.reportingTime,
    dayWisePlan: itinerary.dayWisePlan,
    includedServices: itinerary.includedServices,
    excludedServices: itinerary.excludedServices,
    extraKmPolicy: itinerary.extraKmPolicy,
    extraHourPolicy: itinerary.extraHourPolicy,
    specialInstructions: itinerary.specialInstructions,
    amountToCollect: itinerary.amountToCollect,
    collectionMode: itinerary.collectionMode,
    // Do NOT include internalNotes
  };
}

/**
 * Format itinerary for driver
 */
export function formatItineraryForDriver(itinerary: IItinerary, customerName: string, customerPhone: string): any {
  return {
    title: itinerary.title,
    tripStartDate: itinerary.tripStartDate,
    tripEndDate: itinerary.tripEndDate,
    totalDays: itinerary.totalDays,
    reportingTime: itinerary.reportingTime,
    pickupLocation: itinerary.pickupLocation,
    pickupTime: itinerary.pickupTime,
    dropLocation: itinerary.dropLocation,
    dropTime: itinerary.dropTime,
    dayWisePlan: itinerary.dayWisePlan,
    customerName,
    customerPhone,
    passengerCount: itinerary.passengerCount,
    specialInstructions: itinerary.specialInstructions,
    seniorCitizenNotes: itinerary.seniorCitizenNotes,
    includedServices: itinerary.includedServices,
    excludedServices: itinerary.excludedServices,
    driverAllowance: itinerary.driverAllowance,
    driverAllowanceDetails: itinerary.driverAllowanceDetails,
    amountToCollect: itinerary.amountToCollect,
    tollResponsibility: itinerary.tollResponsibility,
    parkingResponsibility: itinerary.parkingResponsibility,
    nightHaltResponsibility: itinerary.nightHaltResponsibility,
    // Do NOT include internalNotes
  };
}

/**
 * Format itinerary for vendor/partner
 */
export function formatItineraryForVendor(itinerary: IItinerary): any {
  return {
    title: itinerary.title,
    tripStartDate: itinerary.tripStartDate,
    tripEndDate: itinerary.tripEndDate,
    totalDays: itinerary.totalDays,
    reportingTime: itinerary.reportingTime,
    pickupLocation: itinerary.pickupLocation,
    pickupTime: itinerary.pickupTime,
    dropLocation: itinerary.dropLocation,
    dropTime: itinerary.dropTime,
    dayWisePlan: itinerary.dayWisePlan,
    passengerCount: itinerary.passengerCount,
    includedServices: itinerary.includedServices,
    excludedServices: itinerary.excludedServices,
    // Do NOT include internalNotes or customer/driver personal details
  };
}

/**
 * Calculate total days between two dates
 */
function calculateTotalDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
  return diffDays;
}

/**
 * Sync itinerary into booking timeline
 * Called whenever itinerary is created/updated/approved
 */
export async function syncItineraryToTimeline(
  tenantId: mongoose.Types.ObjectId,
  bookingId: mongoose.Types.ObjectId,
  itinerary: IItinerary,
  action: 'created' | 'updated' | 'approved'
): Promise<void> {
  // This will be wired into the timeline system in next phase
  // For now, just log that it should happen
  console.log(`[Timeline] Itinerary ${action}: booking ${bookingId}, status ${itinerary.status}`);
}
