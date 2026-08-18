import { z } from 'zod';
import { optionalString } from './validation-helpers';

// MongoDB Tenant Schema
export const mongoTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().min(1, 'Business name is required'),
  email: z.preprocess((val) => val === "" ? undefined : val, z.string().email().optional()),
  phone: z.string().optional().transform(val => val === "" ? undefined : val),
  address: z.string().optional().transform(val => val === "" ? undefined : val),
  isActive: z.boolean().default(true),
  subscriptionPlan: z.enum(['starter', 'pro', 'custom']).default('starter'),
  limits: z.object({
    vehicles: z.number().min(1).default(6),
    drivers: z.number().min(1).default(3),
    managers: z.number().min(1).default(1)
  }).default({ vehicles: 6, drivers: 3, managers: 1 })
});

// MongoDB User Schema
export const mongoUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().optional(),
  phone: z.string().min(10, 'Phone number is required').optional(), // Optional for backward compatibility
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // P0 FIX: the Mongoose model allows role 'manager' (server/models/index.ts),
  // but this Zod schema previously only allowed 'admin' | 'client', so
  // requests to create/update a manager user were silently rejected by
  // validation before ever reaching the database — schema and model must
  // agree on the same set of roles.
  role: z.enum(['admin', 'client', 'manager']).default('client'),
  tenantId: z.string().optional(),
  isActive: z.boolean().default(true),
  mustResetPassword: z.boolean().default(false),
  // Security fields
  lastLogin: z.date().optional(),
  lastLoginIP: z.string().optional(),
  lastLoginUserAgent: z.string().optional(),
  is2FAEnabled: z.boolean().default(false),
  passwordLastChanged: z.date().optional(),
  loginAttempts: z.number().default(0),
  lockedUntil: z.date().optional()
});

// MongoDB Vehicle Schema
export const mongoVehicleSchema = z.object({
  tenantId: z.union([z.string(), z.any()]).transform(val => typeof val === 'object' && val?._id ? val._id.toString() : String(val)),
  // ULTRA FAST: ALL vehicle fields optional - no blocking validation
  // Users can add vehicle with minimum info, fill details later
  make: z.string().optional().or(z.undefined()),
  vehicleModel: z.string().optional().or(z.undefined()),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().or(z.undefined()),
  licensePlate: z.string().optional().or(z.undefined()),
  registrationNumber: z.string().optional().or(z.undefined()),
  capacity: z.number().int().positive().optional().or(z.undefined()),
  type: z.enum(['economy', 'standard', 'premium', 'luxury', 'suv', 'sedan', 'hatchback', 'coupe', 'convertible']).default('economy'),
  vehicleType: z.string().optional().or(z.undefined()),
  status: z.enum([
    'available', 'on_trip', 'maintenance',
    'RESERVED', 'ASSIGNED', 'RETURNING', 'CLEANING', 'MAINTENANCE_DUE',
    'IN_MAINTENANCE', 'BREAKDOWN', 'ACCIDENT_HOLD', 'INACTIVE', 'SOLD',
  ]).default('available'),
  features: z.array(z.string()).default([]),
  pricePerDay: z.number().min(0).default(0),
  pricePerHour: z.number().min(0).default(0),
  pricePerKm: z.number().min(0).default(0),
  ratePerDay: z.number().min(0).optional().or(z.undefined()),
  dailyRate: z.number().min(0).optional().or(z.undefined()),
  hourlyRate: z.number().min(0).optional().or(z.undefined()),
  color: z.string().optional().or(z.undefined()),
  fuelType: z.string().optional().or(z.undefined()),
  transmission: z.string().optional().or(z.undefined()),
  model: z.string().optional().or(z.undefined()),
  vehicleCategory: z.string().optional().or(z.undefined()),
  variant: z.string().optional().or(z.undefined()),
  ownershipType: z.enum(['owned', 'leased', 'financed', 'rented']).optional().or(z.undefined()),
  currentOdometer: z.number().min(0).optional().or(z.undefined()),
  branch: z.string().optional().or(z.undefined()),
  isDraft: z.boolean().optional().or(z.undefined()),
}).strip();

// MongoDB Driver Schema
export const mongoDriverSchema = z.object({
  tenantId: z.union([z.string(), z.any()]).transform(val => typeof val === 'object' && val?._id ? val._id.toString() : String(val)),
  // ULTRA FAST: ALL fields optional - no blocking validation
  // Users can add driver with minimum info, fill details later
  name: optionalString(z.string().min(1, 'Name is required')),
  phone: optionalString(z.string().min(1, 'Phone is required')),
  // TASK-DRIVER-ADD-400-FIX: both of these are product-optional fields but
  // previously ran their format check (`.email()` / `.min(1)`) against a
  // literal `""` sent by a blank form field, since `.optional()` alone
  // does not exempt "provided but blank" — only "absent". optionalString
  // normalizes blank/whitespace-only to `undefined` first so the format
  // check only ever runs against a genuinely-provided value. See
  // ./validation-helpers.ts for the full contract.
  email: optionalString(z.string().email('Please enter a valid email address.')),
  // Kept intentionally light: this only rejects obviously-malformed input
  // (too short / disallowed characters), not a specific national license
  // format — driver license formats vary too widely across
  // states/countries for this product to hard-code one.
  licenseNumber: optionalString(
    z.string()
      .min(4, 'Driving Licence Number must be at least 4 characters.')
      .regex(/^[A-Za-z0-9][A-Za-z0-9 \-\/]*$/, 'Driving Licence Number format is invalid.')
  ),
  // experience/rating: the current UI never sends "" for these (its
  // onChange handlers already convert a blank input to `undefined` before
  // the request is built), but optionalString is applied defensively so
  // any other caller (mobile app, API integration, future UI) that DOES
  // send "" for these gets the same "blank -> not provided" contract
  // instead of a type-mismatch 400 — optionalString's preprocess works
  // for any inner schema, not just strings.
  experience: optionalString(z.number().int().min(0)),
  rating: optionalString(z.number().min(1).max(5)),
  // status has a real default and the UI's Select never offers a blank
  // option, so this is left as-is — not part of the reported bug.
  status: z.enum(['available', 'on_duty', 'inactive']).default('available'),
  languages: z.array(z.string()).default([]),
  // Additional fields
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  // Same defensive reasoning as experience/rating above: the UI never
  // submits "" for an enum select today, but a blank string sent by any
  // other caller should mean "not provided", not an invalid-enum 400.
  maritalStatus: optionalString(z.enum(['single', 'married', 'divorced', 'widowed'])),
  aadharNumber: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional(),
  // Salary-related fields (Phase 4 Driver Salary Integration)
  activeSalaryMasterId: z.string().optional(),
  baseSalary: z.number().min(0).optional(),
  salarySetupCompleted: z.boolean().default(false),
  salaryStructureType: z.enum(['fixed', 'flexible', 'piece_rate', 'hourly', 'hybrid']).optional(),
  lastSalaryProcessedDate: z.string().optional(),
  nextSalaryDate: z.string().optional(),
  salaryFrequency: z.enum(['daily', 'weekly', 'bi_weekly', 'monthly']).optional(),
  ctcAmount: z.number().min(0).optional(),
  earningsBreakdown: z.object({
    baseSalary: z.number().min(0).optional(),
    bonus: z.number().min(0).optional(),
    incentives: z.number().min(0).optional(),
    allowances: z.number().min(0).optional(),
  }).optional(),
  deductionsBreakdown: z.object({
    taxDeduction: z.number().min(0).optional(),
    insurance: z.number().min(0).optional(),
    advances: z.number().min(0).optional(),
    otherDeductions: z.number().min(0).optional(),
  }).optional(),
  netSalaryAmount: z.number().min(0).optional(),
  lastModifiedBy: z.string().optional(),
  lastModifiedAt: z.string().optional()
});

// MongoDB Booking Schema
export const mongoBookingSchema = z.object({
  tenantId: z.string(),
  bookingId: z.string().optional(),
  // TASK-BOOKING-CODE-02: short public code, additive alongside bookingId.
  bookingCode: z.string().optional(),
  // Same "must be declared or Zod silently strips it" trap noted on
  // createdBy just below — declared explicitly so the duplicate-booking
  // idempotency check in server/routes.ts actually receives this field.
  idempotencyKey: z.string().optional(),
  // Was never declared here, so the default Zod object behavior (strip
  // unrecognized keys) silently dropped it from every booking ever created
  // through this schema — server/routes.ts has built this object correctly
  // since before this session, but it never survived .parse(). Found while
  // building the Availability Engine's own-draft self-exclusion check,
  // which depends on it to identify "the user creating this booking."
  createdBy: z.object({ userId: z.string(), role: z.string() }).optional(),
  // ULTRA FAST: ALL booking fields optional - maximum flexibility
  // Users can create booking with ANY info, complete details later
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  // TASK-BOOKING-DOMAIN-02: relaxed from unconditionally-required to
  // structurally optional here — the actual conditional-requirement rule
  // (required unless travelDateStatus is 'range'/'not_decided') is
  // enforced by mongoBookingSchemaWithCertainty in
  // server/booking/domain/bookingCertaintySchema.ts, which POST
  // /api/bookings uses in place of this bare schema (see the routes.ts
  // patch). This schema's own `.partial()` use in the PUT
  // /api/bookings/:id edit route is exactly why the relaxation happens
  // here directly rather than only in a `.superRefine()`-wrapped variant
  // — ZodEffects (what `.superRefine()` produces) has no `.partial()`
  // method.
  pickupDate: z.string().optional(),
  returnDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnTime: z.string().optional(),
  // Date-certainty axis (TASK-BOOKING-DOMAIN-02) — see
  // server/booking/domain/types.ts. Absent means 'confirmed' (see
  // legacy.ts's resolveTravelDateStatus). do not change this default.
  travelDateStatus: z.enum(['confirmed', 'range', 'not_decided']).optional(),
  tentativeStartDate: z.string().optional(),
  tentativeEndDate: z.string().optional(),
  followUpAt: z.string().optional(),
  bookingType: z.enum(['self_drive', 'with_driver']).optional(),
  // Trip shape (TASK-BOOKING-DOMAIN-02) — kept distinct from bookingType
  // above. Was declared on the client schema and submitted on every
  // create request but silently stripped here (this exact gap is audit
  // finding #3) — see server/booking/domain/tripType.ts.
  tripType: z.enum(['one_way', 'round_trip', 'local', 'airport']).optional(),
  pricingType: z.enum(['day', 'km']).optional(),
  totalKilometers: z.number().min(0).optional(),
  status: z.enum(['enquiry', 'quotation_sent', 'tentative', 'on_hold', 'confirmed', 'vehicle_assigned',
    'driver_assigned', 'ready_for_dispatch', 'trip_started', 'ongoing', 'extended', 'return_pending',
    'completed', 'payment_pending', 'closed', 'cancelled', 'no_show']).default('confirmed'),
  totalAmount: z.number().positive().optional(),
  // Accepted here only for the booking-creation convenience path (create
  // + record the first advance in one step) — server/routes.ts strips
  // this from every EDIT so the ledger stays the only way to change it
  // once a booking exists.
  advanceReceived: z.number().min(0).default(0),
  advanceRequested: z.number().min(0).optional(),
  driverCollectionAmount: z.number().min(0).optional(),
  collectionMode: z.enum(['company', 'driver', 'vendor', 'split']).optional(),
  customerDiscussionSummary: z.string().optional(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']).default('pending'),
  notes: z.string().optional(),
  tollCharges: z.number().min(0).default(0),
  parkingCharges: z.number().min(0).default(0),
  petrolCharges: z.number().min(0).default(0),
  dieselCharges: z.number().min(0).default(0),
  cngCharges: z.number().min(0).default(0),
  miscellaneousAmount: z.number().min(0).default(0),
  miscellaneousDescription: z.string().optional(),
  cancellationReason: z.string().optional(),
  cancellationType: z.enum(['customer', 'company', 'vendor']).optional(),
  actualStartDateTime: z.string().optional(),
  actualEndDateTime: z.string().optional(),
  startOdometer: z.number().min(0).optional(),
  endOdometer: z.number().min(0).optional(),
  // Self Drive operational fields (Live Operations) — deposit is held
  // money, tracked apart from totalAmount/advanceReceived by design.
  securityDepositAmount: z.number().min(0).optional(),
  securityDepositStatus: z.enum(['pending', 'collected', 'refund_pending', 'partially_refunded', 'refunded', 'forfeited']).optional(),
  startFuelLevel: z.string().max(20).optional(),
  bookingSource: z.enum(['direct_customer', 'walk_in', 'phone_call', 'whatsapp', 'website', 'google_business_profile',
    'google_ads', 'facebook', 'instagram', 'hotel', 'corporate_client', 'travel_agent', 'vendor_partner',
    'referral', 'online_travel_platform', 'repeat_customer', 'other']).default('direct_customer'),
  sourceName: z.string().optional(),
  sourceContact: z.string().optional(),
  sourceCommissionType: z.enum(['flat', 'percentage']).optional(),
  sourceCommissionAmount: z.number().min(0).optional(),
  sourceReferenceNumber: z.string().optional(),
  sourceNotes: z.string().optional(),
  // Optional link to a real Vendor Master record when the booking source
  // is a known vendor/agent — coexists with the free-text sourceName
  // above (which stays the display value either way; see routes.ts).
  sourceVendorId: z.string().optional(),
  fulfilmentType: z.enum(['own', 'vendor']).default('own'),
  vendorName: z.string().optional(),
  vendorContactPhone: z.string().optional(),
  vendorDriverName: z.string().optional(),
  vendorDriverPhone: z.string().optional(),
  vendorVehicleDetails: z.string().optional(),
  vendorAgreedRate: z.number().min(0).optional(),
  vendorAdvancePaid: z.number().min(0).optional(),
  // Optional links to real Vendor 360° records — set via
  // POST /api/bookings/:id/assign-vendor. The vendorName/vendorDriverName/
  // vendorVehicleDetails free-text fields above stay populated (derived
  // from these when set) so every existing display surface (duty slip,
  // live/upcoming bookings, dashboards) keeps working unchanged.
  fulfilmentVendorId: z.string().optional(),
  vendorDriverId: z.string().optional(),
  vendorVehicleId: z.string().optional(),
  resourceFulfilmentStatus: z.enum(['not_started', 'own_fleet_assigned', 'vendor_vehicle_selected',
    'vendor_confirmation_pending', 'vendor_confirmed', 'outsourcing_requested', 'vendor_quotes_pending',
    'resource_sourcing_pending', 'resource_secured', 'resource_rejected', 'resource_failed']).optional(),
  // Third-party driver fields
  useThirdPartyDriver: z.boolean().default(false),
  thirdPartyDriverName: z.string().optional(),
  thirdPartyDriverCharges: z.number().min(0).default(0),
  thirdPartyDriverPhone: z.string().optional(),
  thirdPartyDriverAddress: z.string().optional()
});

// Mirrors the TelephonyIdentity/CallSession Mongoose schemas in
// server/models/index.ts — required together per AUDIT.md #8
// (Mongoose/Zod drift). See TASK-02-report.md's "Proposed
// server/schemas/mongodb-schemas.ts patch".
export const mongoTelephonyIdentitySchema = z.object({
  tenantId: z.string(),
  userId: z.string().min(1),
  providerKey: z.string().trim().toLowerCase().max(64).default('mock'),
  providerAgentId: z.string().trim().max(200).optional(),
  registeredNumber: z.string().trim().max(32).optional(),
  virtualNumber: z.string().trim().max(32).optional(),
  extension: z.string().trim().max(16).optional(),
  incomingEnabled: z.boolean().default(true),
  outgoingEnabled: z.boolean().default(true),
  status: z.enum(['available', 'busy', 'wrap_up', 'offline', 'disabled']).default('offline'),
  // Plaintext credentials are accepted only at the API boundary and
  // encrypted before persistence — this schema validates the *input*
  // shape, never the stored (encrypted) shape.
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export const mongoCallSessionSchema = z.object({
  tenantId: z.string(),
  direction: z.enum(['outbound', 'inbound']),
  status: z.enum(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled']).default('initiated'),
  userId: z.string().min(1),
  assignedUserId: z.string().min(1),
  fromNumber: z.string().trim().min(3).max(32),
  toNumber: z.string().trim().min(3).max(32),
  virtualNumber: z.string().trim().max(32).optional(),
  providerKey: z.string().trim().toLowerCase().max(64).default('mock'),
  providerCallId: z.string().trim().max(200).optional(),
  providerAgentId: z.string().trim().max(200).optional(),
  customerId: z.string().optional(),
  inquiryId: z.string().optional(),
  leadId: z.string().optional(),
  createdBy: z.object({ userId: z.string(), role: z.string() }),
});

// FLEETPRO BOOKING DRAFT SCHEMA
// Auto-save intermediate booking state without final submission
// Recovery on browser close/restart or session loss
export const mongoBookingDraftSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
  draftId: z.string(), // DRAFT-XXXX
  status: z.enum(['in_progress', 'completed', 'finalized']).default('in_progress'),

  // Customer reference
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),

  // Booking data (partial - may be incomplete)
  bookingType: z.string().optional(),
  tripType: z.string().optional(),
  pickupLocation: z.string().optional(),
  dropoffLocation: z.string().optional(),
  pickupDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnDate: z.string().optional(),
  returnTime: z.string().optional(),

  // Vehicle & Driver
  vehicleId: z.string().optional(),
  vehicleCategory: z.string().optional(),
  driverId: z.string().optional(),

  // Pricing
  totalAmount: z.number().optional(),
  advanceAmount: z.number().optional(),
  tollCharges: z.number().optional(),
  parkingCharges: z.number().optional(),
  miscellaneousAmount: z.number().optional(),

  // Additional
  notes: z.string().optional(),
  source: z.string().optional(),
  progressStep: z.number().default(0), // 0=customer, 1=trip, 2=date, 3=vehicle, 4=payment, etc.

  // Audit
  createdByUserId: z.string(),
  createdByUserName: z.string(),
  createdByUserMobile: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSavedAt: z.date(),
  expiresAt: z.date().optional(), // TTL: 30 days if not finalized

  // Recovery
  formData: z.record(z.unknown()).optional(), // Raw form data backup
});

export type MongoTenant = z.infer<typeof mongoTenantSchema>;
export type MongoUser = z.infer<typeof mongoUserSchema>;
export type MongoVehicle = z.infer<typeof mongoVehicleSchema>;
export type MongoDriver = z.infer<typeof mongoDriverSchema>;
export type MongoBooking = z.infer<typeof mongoBookingSchema>;
export type MongoBookingDraft = z.infer<typeof mongoBookingDraftSchema>;
export type MongoTelephonyIdentity = z.infer<typeof mongoTelephonyIdentitySchema>;
export type MongoCallSession = z.infer<typeof mongoCallSessionSchema>;