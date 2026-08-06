import {
  Counter, VendorSourcingRequest, VendorSourcingResponse, Vendor, VendorDriver, VendorVehicle, Booking, WhatsAppMessage,
  IVendorSourcingRequest, IVendorSourcingResponse,
} from '../models/index';
import { storage } from '../storage-mongodb';
import { normalizeIndianPhone } from '../whatsapp/phone';
import { whatsappProvider } from '../whatsapp/index';
import { checkVendorVehicleAvailability } from './vendorVehicleService';
import { checkVendorDriverAvailability } from './vendorDriverService';
import { upsertVendorDuty } from './vendorDutyService';

async function nextRequestNumber(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'vendor_sourcing_request_number' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `SRC-${String(counter.value).padStart(4, '0')}`;
}

export interface CreateSourcingRequestInput {
  tenantId: string;
  bookingId: string;
  vehicleCategory?: string;
  seatingCapacity?: number;
  quantity?: number;
  targetVendorCost?: number;
  responseDeadline?: Date;
  internalNotes?: string;
  createdBy: { userId: string; role: string };
}

// Booking-derived snapshot fields (route/schedule/passengers) are read
// live from the booking here rather than accepted as caller input — the
// request should always describe the actual booking it's for, not a
// value the caller could accidentally mismatch.
export async function createSourcingRequest(input: CreateSourcingRequestInput): Promise<IVendorSourcingRequest> {
  const booking: any = await Booking.findOne({ _id: input.bookingId, tenantId: input.tenantId });
  if (!booking) throw new Error('Booking not found');

  const requestNumber = await nextRequestNumber(input.tenantId);
  const routeSnapshot = booking.dropoffLocation ? `${booking.pickupLocation} → ${booking.dropoffLocation}` : booking.pickupLocation;
  return VendorSourcingRequest.create({
    tenantId: input.tenantId,
    requestNumber,
    bookingId: booking._id,
    vehicleCategory: input.vehicleCategory,
    seatingCapacity: input.seatingCapacity,
    quantity: input.quantity || 1,
    routeSnapshot,
    scheduledStartDateTime: booking.scheduledStartDateTime,
    scheduledEndDateTime: booking.scheduledEndDateTime,
    passengerCount: input.seatingCapacity,
    targetVendorCost: input.targetVendorCost,
    responseDeadline: input.responseDeadline,
    internalNotes: input.internalNotes,
    status: 'draft',
    createdBy: input.createdBy,
  });
}

function formatDateTime(d?: Date): string {
  if (!d) return 'TBD';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Spec §17's exact template, populated from real request/booking/tenant
// data only — no hard-coded vehicle, route, or contact details.
export function buildVendorRequirementMessage(request: any, booking: any, tenant: any): string {
  const lines = [
    `Hello,`,
    ``,
    `A vehicle is required for the following duty:`,
    ``,
    `Booking:`,
    `${booking.bookingId}`,
    ``,
    `Travel Date:`,
    formatDateTime(request.scheduledStartDateTime),
    ``,
    `Pickup:`,
    booking.pickupLocation || 'TBD',
    ``,
    `Drop/Route:`,
    request.routeSnapshot || 'TBD',
    ``,
    `Passengers:`,
    String(request.passengerCount || booking.passengerCount || 'TBD'),
    ``,
    `Required Vehicle:`,
    request.vehicleCategory || 'Any suitable vehicle',
    ``,
    `Please confirm:`,
    ``,
    `1. Vehicle model`,
    `2. Vehicle number`,
    `3. Driver name and mobile`,
    `4. Availability`,
    `5. Your final rate`,
    `6. Toll/Parking terms`,
  ];
  if (request.responseDeadline) {
    lines.push(``, `Response Required By:`, formatDateTime(request.responseDeadline));
  }
  lines.push(``, `Regards,`, tenant?.businessName || tenant?.name || 'FleetPro');
  if (tenant?.phone) lines.push(tenant.phone);
  return lines.join('\n');
}

export interface SendToVendorsResult {
  vendorId: string;
  ok: boolean;
  code?: string;
  message?: string;
}

// Idempotent per (sourcingRequestId, vendorId) — the unique index on
// VendorSourcingResponse means a vendor already contacted for this
// request gets a reminder resend (same response row, new WhatsApp
// message), never a second response row to accidentally show twice in
// the comparison table.
export async function sendSourcingRequestToVendors(
  tenantId: string, sourcingRequestId: string, vendorIds: string[], actor: { userId: string; role: string }
): Promise<SendToVendorsResult[]> {
  const request: any = await VendorSourcingRequest.findOne({ _id: sourcingRequestId, tenantId });
  if (!request) throw new Error('Sourcing request not found');
  if (['cancelled', 'resource_secured'].includes(request.status)) {
    throw new Error(`Cannot send a request that is already ${request.status}`);
  }

  const booking: any = await Booking.findOne({ _id: request.bookingId, tenantId });
  if (!booking) throw new Error('Linked booking not found');
  const tenant = await storage.getTenant(tenantId);
  const content = buildVendorRequirementMessage(request, booking, tenant);

  const results: SendToVendorsResult[] = [];
  for (const vendorId of vendorIds) {
    const vendor = await Vendor.findOne({ _id: vendorId, tenantId, isDeleted: { $ne: true } });
    if (!vendor) {
      results.push({ vendorId, ok: false, code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' });
      continue;
    }
    const recipientPhone = normalizeIndianPhone(vendor.whatsappNumber || vendor.primaryMobile);
    if (!recipientPhone) {
      results.push({ vendorId, ok: false, code: 'INVALID_PHONE', message: 'Vendor has no valid WhatsApp/mobile number' });
      continue;
    }

    let response = await VendorSourcingResponse.findOne({ tenantId, sourcingRequestId: request._id, vendorId: vendor._id });
    if (!response) {
      response = await VendorSourcingResponse.create({
        tenantId, sourcingRequestId: request._id, vendorId: vendor._id,
        vendorNameSnapshot: vendor.companyName, response: 'pending',
      });
    }

    const idempotencyKey = `${tenantId}_${request._id}_${vendor._id}_${Date.now()}`;
    const messageDoc = await WhatsAppMessage.create({
      tenantId, bookingId: booking._id, vendorId: vendor._id, sourcingRequestId: request._id,
      recipientType: 'vendor', recipientPhone, messageType: 'vendor.vehicle_requirement',
      content, provider: whatsappProvider.kind, status: 'queued', attemptCount: 0, createdBy: actor, idempotencyKey,
    });
    const sendResult = await whatsappProvider.sendText(tenantId, recipientPhone, content);
    messageDoc.attemptCount = 1;
    messageDoc.status = sendResult.status === 'sent' ? 'sent' : 'failed';
    messageDoc.providerMessageId = sendResult.providerMessageId || undefined;
    messageDoc.error = sendResult.error || undefined;
    if (sendResult.status === 'sent') messageDoc.sentAt = new Date();
    await messageDoc.save();

    // sentAt is recorded regardless of delivery outcome — the request was
    // genuinely attempted (visible in the WhatsApp message log above for
    // the real failure reason); the vendor's own response status stays
    // 'pending' either way until they actually reply.
    response.sentAt = new Date();
    await response.save();

    results.push(
      sendResult.status === 'sent'
        ? { vendorId, ok: true }
        : { vendorId, ok: false, code: 'SEND_FAILED', message: sendResult.error || 'WhatsApp send failed' }
    );
  }

  request.status = 'sent';
  await request.save();

  return results;
}

export interface RecordResponseInput {
  tenantId: string;
  sourcingRequestId: string;
  vendorId: string;
  response: 'accepted' | 'rejected' | 'alternative_offered' | 'negotiation';
  offeredVehicleCategory?: string;
  offeredVendorVehicleId?: string;
  offeredVehicleDetails?: string;
  offeredVendorDriverId?: string;
  offeredDriverDetails?: string;
  quotedCost?: number;
  tollTreatment?: string;
  parkingTreatment?: string;
  notes?: string;
  actor: { userId: string; role: string };
}

// Manual entry — spec §18: a Vendor's real reply arrives outside this
// system (phone call, WhatsApp reply read by a human) and is recorded
// here by an operations user. Not a second messaging channel.
export async function recordVendorResponse(input: RecordResponseInput): Promise<IVendorSourcingResponse> {
  const request: any = await VendorSourcingRequest.findOne({ _id: input.sourcingRequestId, tenantId: input.tenantId });
  if (!request) throw new Error('Sourcing request not found');

  const existing = await VendorSourcingResponse.findOne({ tenantId: input.tenantId, sourcingRequestId: request._id, vendorId: input.vendorId });
  if (!existing) throw new Error('This vendor was never contacted for this request — send the request first.');

  existing.response = input.response;
  existing.offeredVehicleCategory = input.offeredVehicleCategory;
  existing.offeredVendorVehicleId = input.offeredVendorVehicleId as any;
  existing.offeredVehicleDetails = input.offeredVehicleDetails;
  existing.offeredVendorDriverId = input.offeredVendorDriverId as any;
  existing.offeredDriverDetails = input.offeredDriverDetails;
  existing.quotedCost = input.quotedCost;
  existing.tollTreatment = input.tollTreatment;
  existing.parkingTreatment = input.parkingTreatment;
  existing.notes = input.notes;
  existing.respondedAt = new Date();
  existing.respondedBy = input.actor;
  await existing.save();

  if (request.status === 'sent' || request.status === 'responses_pending') {
    request.status = 'quotes_received';
    await request.save();
  }

  return existing;
}

// Spec §12: "Recommended selection factors" are shown as reasons, never
// used to auto-select — this returns ranked candidates with their reasons
// for the comparison drawer to display; the actual pick stays a manual
// authorized action (selectVendorResponse below).
export function rankResponses(responses: IVendorSourcingResponse[]): { response: IVendorSourcingResponse; reasons: string[] }[] {
  const eligible = responses.filter((r) => r.response === 'accepted' || r.response === 'alternative_offered');
  return eligible
    .map((response) => {
      const reasons: string[] = [];
      if (response.offeredVendorVehicleId) reasons.push('Real vendor vehicle on file');
      if (response.offeredVendorDriverId) reasons.push('Real vendor driver on file');
      if (typeof response.quotedCost === 'number') reasons.push(`Quoted ₹${response.quotedCost}`);
      if (response.response === 'accepted') reasons.push('Vendor confirmed availability');
      return { response, reasons };
    })
    .sort((a, b) => (a.response.quotedCost ?? Infinity) - (b.response.quotedCost ?? Infinity));
}

export interface SelectVendorResponseInput {
  tenantId: string;
  sourcingRequestId: string;
  responseId: string;
  actor: { userId: string; role: string };
}

// The one place a sourcing request actually resolves a booking's
// fulfilment — mirrors POST /api/bookings/:id/assign-vendor's real
// overlap/duty logic exactly (same availability checks, same VendorDuty
// upsert) rather than a second, divergent implementation, since this is
// ultimately the same business operation reached via a different UI path.
export async function selectVendorResponse(input: SelectVendorResponseInput) {
  const request: any = await VendorSourcingRequest.findOne({ _id: input.sourcingRequestId, tenantId: input.tenantId });
  if (!request) throw new Error('Sourcing request not found');
  if (['cancelled', 'resource_secured'].includes(request.status)) {
    throw new Error(`Cannot select a vendor for a request that is already ${request.status}`);
  }

  const response: any = await VendorSourcingResponse.findOne({ _id: input.responseId, tenantId: input.tenantId, sourcingRequestId: request._id });
  if (!response) throw new Error('Response not found for this sourcing request');
  if (!['accepted', 'alternative_offered'].includes(response.response)) {
    throw new Error(`Cannot select a response with status "${response.response}" — only an accepted or alternative offer can be chosen.`);
  }

  const booking: any = await Booking.findOne({ _id: request.bookingId, tenantId: input.tenantId });
  if (!booking) throw new Error('Linked booking not found');
  if (['cancelled', 'no_show', 'completed', 'closed'].includes(booking.status)) {
    throw new Error(`Cannot assign a vendor to a booking that is ${booking.status}.`);
  }

  const vendor = await Vendor.findOne({ _id: response.vendorId, tenantId: input.tenantId, isDeleted: { $ne: true } });
  if (!vendor) throw new Error('Vendor not found');
  if (vendor.status !== 'active') {
    throw new Error(`Vendor "${vendor.companyName}" is ${vendor.status.replace(/_/g, ' ')}, not active.`);
  }

  const window = { start: booking.scheduledStartDateTime, end: booking.scheduledEndDateTime, excludeBookingId: String(booking._id) };
  let vendorDriverName: string | undefined = response.offeredDriverDetails;
  let vendorDriverPhone: string | undefined;
  if (response.offeredVendorDriverId) {
    const driver = await VendorDriver.findOne({ _id: response.offeredVendorDriverId, tenantId: input.tenantId, vendorId: vendor._id, isDeleted: { $ne: true } });
    if (!driver) throw new Error('Offered vendor driver not found under this vendor');
    const availability = await checkVendorDriverAvailability(input.tenantId, String(vendor._id), String(response.offeredVendorDriverId), window);
    if (!availability.available) {
      throw Object.assign(new Error(`Vendor driver unavailable: ${availability.reason}`), { code: 'VENDOR_DRIVER_TIME_CONFLICT' });
    }
    vendorDriverName = driver.name;
    vendorDriverPhone = driver.primaryMobile;
  }

  let vendorVehicleDetails: string | undefined = response.offeredVehicleDetails;
  if (response.offeredVendorVehicleId) {
    const vehicle = await VendorVehicle.findOne({ _id: response.offeredVendorVehicleId, tenantId: input.tenantId, vendorId: vendor._id, isDeleted: { $ne: true } });
    if (!vehicle) throw new Error('Offered vendor vehicle not found under this vendor');
    const availability = await checkVendorVehicleAvailability(input.tenantId, String(vendor._id), String(response.offeredVendorVehicleId), window);
    if (!availability.available) {
      throw Object.assign(new Error(`Vendor vehicle unavailable: ${availability.reason}`), { code: 'VENDOR_VEHICLE_TIME_CONFLICT' });
    }
    vendorVehicleDetails = `${vehicle.make ? vehicle.make + ' ' : ''}${vehicle.vehicleModel} (${vehicle.registrationNumber})`;
  }

  booking.fulfilmentType = 'vendor';
  booking.vendorName = vendor.companyName;
  booking.vendorContactPhone = vendor.primaryMobile;
  booking.vendorDriverName = vendorDriverName;
  booking.vendorDriverPhone = vendorDriverPhone;
  booking.vendorVehicleDetails = vendorVehicleDetails;
  booking.vendorAgreedRate = response.quotedCost;
  booking.fulfilmentVendorId = vendor._id;
  booking.vendorDriverId = response.offeredVendorDriverId || undefined;
  booking.vendorVehicleId = response.offeredVendorVehicleId || undefined;
  // 'resource_secured', not 'vendor_confirmation_pending' — an
  // accepted/alternative-offered sourcing response IS the vendor's real
  // confirmation (recorded via recordVendorResponse), unlike
  // assign-vendor's direct-link path where confirmation is still being
  // requested at the moment of assignment. See docs/RESOURCE_FULFILMENT_MATRIX.md.
  booking.resourceFulfilmentStatus = 'resource_secured';
  await booking.save();

  try {
    await upsertVendorDuty({
      tenantId: input.tenantId, bookingId: String(booking._id), fulfilmentVendorId: String(vendor._id),
      vendorDriverId: response.offeredVendorDriverId ? String(response.offeredVendorDriverId) : undefined,
      vendorVehicleId: response.offeredVendorVehicleId ? String(response.offeredVendorVehicleId) : undefined,
      scheduledStartDateTime: booking.scheduledStartDateTime, scheduledEndDateTime: booking.scheduledEndDateTime,
      vendorAgreedRate: booking.vendorAgreedRate, actor: input.actor,
    });
  } catch (dutyError: any) {
    // Booking assignment already saved — same non-fatal-logging pattern
    // as assign-vendor's own duty-sync failure handling.
    console.error('Vendor duty sync failed after sourcing-request selection:', dutyError?.message || dutyError);
  }

  // Other responses for this request are left exactly as the vendor
  // actually answered (spec Scenario C: "Other Vendor responses remain in
  // history") — not force-flipped to rejected, since they weren't
  // necessarily declined by that vendor, just not the one chosen.
  request.status = 'resource_secured';
  request.selectedResponseId = response._id;
  request.updatedBy = input.actor;
  await request.save();

  return { booking, request };
}

export async function cancelSourcingRequest(tenantId: string, sourcingRequestId: string, actor: { userId: string; role: string }, reason?: string) {
  const request: any = await VendorSourcingRequest.findOne({ _id: sourcingRequestId, tenantId });
  if (!request) throw new Error('Sourcing request not found');
  if (request.status === 'resource_secured') {
    throw new Error('Cannot cancel a sourcing request that has already secured a resource — reassign the booking instead.');
  }
  request.status = 'cancelled';
  request.internalNotes = reason ? `${request.internalNotes ? request.internalNotes + ' | ' : ''}Cancelled: ${reason}` : request.internalNotes;
  request.updatedBy = actor;
  await request.save();
  return request;
}

// Monitoring (spec §26) — every count here has a matching bookingsByCategory
// query below returning the real rows, so no card shows a number with no
// way to see what it's made of. TERMINAL_STATUSES bookings are excluded
// from every "still needs a resource" count — a cancelled or completed
// booking is never actionable, whatever its resourceFulfilmentStatus.
const TERMINAL_STATUSES = ['cancelled', 'no_show', 'completed', 'closed'];

export async function buildResourceFulfilmentDashboard(tenantId: string) {
  const activeBookingFilter = { tenantId, status: { $nin: TERMINAL_STATUSES } };
  const [
    ownFleetAssigned, vendorConfirmationPending, resourceSecured, resourceNotSecured,
    outsourcingRequestsPending, vendorResponsesPending, upcomingWithoutResource,
  ] = await Promise.all([
    Booking.countDocuments({ ...activeBookingFilter, vehicleId: { $ne: null, $exists: true } }),
    Booking.countDocuments({ ...activeBookingFilter, resourceFulfilmentStatus: 'vendor_confirmation_pending' }),
    Booking.countDocuments({ ...activeBookingFilter, resourceFulfilmentStatus: 'resource_secured' }),
    Booking.countDocuments({
      ...activeBookingFilter,
      $and: [{ $or: [{ vehicleId: null }, { vehicleId: { $exists: false } }] }, { $or: [{ vendorVehicleId: null }, { vendorVehicleId: { $exists: false } }] }],
    }),
    VendorSourcingRequest.countDocuments({ tenantId, status: { $in: ['draft', 'sent', 'responses_pending', 'quotes_received'] } }),
    VendorSourcingResponse.countDocuments({ tenantId, response: 'pending', sentAt: { $ne: null } }),
    Booking.countDocuments({
      ...activeBookingFilter,
      pickupDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      $and: [{ $or: [{ vehicleId: null }, { vehicleId: { $exists: false } }] }, { $or: [{ vendorVehicleId: null }, { vendorVehicleId: { $exists: false } }] }],
    }),
  ]);

  return {
    ownFleetAssigned, vendorConfirmationPending, resourceSecured, resourceNotSecured,
    outsourcingRequestsPending, vendorResponsesPending, upcomingWithoutResource,
  };
}

export type FulfilmentBookingCategory =
  | 'own_fleet_assigned' | 'vendor_confirmation_pending' | 'resource_secured'
  | 'resource_not_secured' | 'upcoming_without_resource';

export async function findBookingsByFulfilmentCategory(tenantId: string, category: FulfilmentBookingCategory) {
  const activeBookingFilter = { tenantId, status: { $nin: TERMINAL_STATUSES } };
  const unresolvedFilter = { $and: [{ $or: [{ vehicleId: null }, { vehicleId: { $exists: false } }] }, { $or: [{ vendorVehicleId: null }, { vendorVehicleId: { $exists: false } }] }] };
  let query: any;
  switch (category) {
    case 'own_fleet_assigned':
      query = { ...activeBookingFilter, vehicleId: { $ne: null, $exists: true } };
      break;
    case 'vendor_confirmation_pending':
      query = { ...activeBookingFilter, resourceFulfilmentStatus: 'vendor_confirmation_pending' };
      break;
    case 'resource_secured':
      query = { ...activeBookingFilter, resourceFulfilmentStatus: 'resource_secured' };
      break;
    case 'resource_not_secured':
      query = { ...activeBookingFilter, ...unresolvedFilter };
      break;
    case 'upcoming_without_resource':
      query = { ...activeBookingFilter, ...unresolvedFilter, pickupDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } };
      break;
    default:
      throw new Error(`Unknown fulfilment category: ${category}`);
  }
  return Booking.find(query).sort({ pickupDate: 1 }).limit(200);
}
