// TASK-DRIVER-OPERATIONS-06 — incident tracking + the combined
// incident/complaint view.
//
// Per the task's audit finding, driver "incidents" today are ONLY visible
// indirectly, through customer-complaint records (CustomerComplaint,
// driver-linked, category in {driver_late, driver_behaviour, rash_driving,
// ...}). That mechanism (server/services/driverFeedbackService.ts) is
// customer-initiated and stays exactly as-is — read here, never modified,
// never duplicated into a second complaint store. DriverIncident below is
// the genuinely new, internally-reported channel (an accident report, a
// dispatcher's safety observation, a policy violation write-up, etc.) that
// had no representation at all before this task. getDriverIncidentView()
// merges both into one read model so a manager sees the whole compliance
// picture in one place, without ever conflating the two source-of-truth
// collections.
import mongoose from 'mongoose';
import { CustomerComplaint } from '../../models/index';
import { DriverChallan, DriverIncident, type IDriverIncident } from './models';
import { INCIDENT_STATUSES, type ActorRef, type IncidentSeverity, type IncidentStatus, type IncidentType } from './types';

export class DriverIncidentNotFoundError extends Error {
  constructor() {
    super('Driver incident not found.');
    this.name = 'DriverIncidentNotFoundError';
  }
}

export interface CreateIncidentInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  incidentType: IncidentType;
  severity?: IncidentSeverity;
  incidentDate: Date | string;
  description: string;
  location?: string;
  bookingId?: string;
  vehicleId?: string;
}

export async function createDriverIncident(input: CreateIncidentInput): Promise<IDriverIncident> {
  return DriverIncident.create({
    tenantId: input.tenantId,
    driverId: input.driverId,
    incidentType: input.incidentType,
    severity: input.severity || 'minor',
    incidentDate: new Date(input.incidentDate),
    description: input.description,
    location: input.location,
    bookingId: input.bookingId || undefined,
    vehicleId: input.vehicleId || undefined,
    reportedBy: { userId: input.actor.userId, role: input.actor.role },
    status: 'reported',
  });
}

export async function listDriverIncidents(tenantId: string, driverId: string): Promise<IDriverIncident[]> {
  return DriverIncident.find({ tenantId, driverId }).sort({ incidentDate: -1 }).lean() as any;
}

export interface UpdateIncidentStatusInput {
  tenantId: string;
  driverId: string;
  incidentId: string;
  actor: ActorRef;
  status: IncidentStatus;
  reviewNotes?: string;
  actionTaken?: string;
}

// Status transitions only — never a delete. "Closing" an incident means
// status='closed', the row (and its review trail) remains queryable
// forever, same no-hard-delete convention as TASK-DRIVER-DOMAIN-02's
// contact/employment-history soft-removal.
export async function updateDriverIncidentStatus(input: UpdateIncidentStatusInput): Promise<IDriverIncident | null> {
  if (!INCIDENT_STATUSES.includes(input.status)) {
    throw new Error(`Invalid incident status: '${input.status}'.`);
  }
  const incident = await DriverIncident.findOne({ _id: input.incidentId, tenantId: input.tenantId, driverId: input.driverId });
  if (!incident) return null;
  incident.status = input.status;
  if (input.reviewNotes !== undefined) incident.reviewNotes = input.reviewNotes;
  if (input.actionTaken !== undefined) incident.actionTaken = input.actionTaken;
  incident.reviewedBy = { userId: input.actor.userId, role: input.actor.role };
  incident.reviewedAt = new Date();
  await incident.save();
  return incident;
}

// ---------------------------------------------------------------------------
// Combined incident + challan + (read-only) customer-complaint view.
// ---------------------------------------------------------------------------
export interface DriverComplianceTimelineEntry {
  source: 'incident' | 'challan' | 'customer_complaint';
  id: string;
  date: Date;
  summary: string;
  severityOrCategory?: string;
  status?: string;
}

export async function getDriverIncidentView(tenantId: string, driverId: string) {
  if (!mongoose.isValidObjectId(driverId)) {
    throw new Error('Invalid driver ID.');
  }
  const [incidents, challans, complaints] = await Promise.all([
    DriverIncident.find({ tenantId, driverId }).sort({ incidentDate: -1 }).lean(),
    DriverChallan.find({ tenantId, driverId }).sort({ challanDate: -1 }).lean(),
    // Read-only reference to the EXISTING driver-linked complaint source
    // (server/models/index.ts's CustomerComplaint) — never modified, never
    // copied into a second store. Same collection
    // server/services/driverFeedbackService.ts already reads.
    CustomerComplaint.find({ tenantId, driverId }).sort({ createdAt: -1 }).lean(),
  ]);

  const timeline: DriverComplianceTimelineEntry[] = [
    ...incidents.map((row: any) => ({
      source: 'incident' as const,
      id: row._id.toString(),
      date: row.incidentDate,
      summary: row.description,
      severityOrCategory: row.severity,
      status: row.status,
    })),
    ...challans.map((row: any) => ({
      source: 'challan' as const,
      id: row._id.toString(),
      date: row.challanDate,
      summary: `${row.violationType}${row.fineAmount ? ` — ₹${row.fineAmount}` : ''}`,
      severityOrCategory: row.violationType,
      status: row.status,
    })),
    ...complaints.map((row: any) => ({
      source: 'customer_complaint' as const,
      id: row._id.toString(),
      date: row.createdAt,
      summary: row.description,
      severityOrCategory: row.category,
      status: row.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const driverFaultComplaints = complaints.filter((row: any) => row.responsibleParty === 'driver');

  return {
    driverId,
    incidents,
    challans,
    // Reused, not rebuilt — the exact rows driverFeedbackService.ts already
    // surfaces for this driver, included here for a single combined view.
    linkedCustomerComplaints: complaints,
    summary: {
      totalIncidents: incidents.length,
      openIncidents: incidents.filter((row: any) => !['closed', 'unsubstantiated'].includes(row.status)).length,
      criticalIncidents: incidents.filter((row: any) => row.severity === 'critical').length,
      totalChallans: challans.length,
      pendingChallans: challans.filter((row: any) => row.status === 'pending').length,
      unpaidChallanAmount: challans
        .filter((row: any) => row.status === 'pending' || row.status === 'disputed')
        .reduce((sum: number, row: any) => sum + (row.fineAmount || 0), 0),
      totalLinkedComplaints: complaints.length,
      driverFaultComplaints: driverFaultComplaints.length,
    },
    timeline,
  };
}
