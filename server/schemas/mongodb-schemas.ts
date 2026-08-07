import { z } from 'zod';

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
  tenantId: z.string(),
  make: z.string().min(1, 'Car name is required'),
  vehicleModel: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  licensePlate: z.string().optional(),
  registrationNumber: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  type: z.enum(['economy', 'standard', 'premium', 'luxury', 'suv', 'sedan', 'hatchback', 'coupe', 'convertible']).default('economy'),
  vehicleType: z.string().optional(),
  status: z.enum([
    'available', 'on_trip', 'maintenance',
    'RESERVED', 'ASSIGNED', 'RETURNING', 'CLEANING', 'MAINTENANCE_DUE',
    'IN_MAINTENANCE', 'BREAKDOWN', 'ACCIDENT_HOLD', 'INACTIVE', 'SOLD',
  ]).default('available'),
  features: z.array(z.string()).default([]),
  pricePerDay: z.number().min(0).default(0),
  pricePerHour: z.number().min(0).default(0),
  pricePerKm: z.number().min(0).default(0),
  ratePerDay: z.number().min(0).optional(),
  dailyRate: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  color: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  model: z.string().optional(),
  // --- Vehicle 360 additions (TASK-VEHICLE-DOMAIN-01) ---
  vehicleCategory: z.string().optional(),
  variant: z.string().optional(),
  ownershipType: z.enum(['owned', 'leased', 'financed', 'rented']).optional(),
  currentOdometer: z.number().min(0).optional(),
  branch: z.string().optional(),
  isDraft: z.boolean().optional(),
});

// MongoDB Driver Schema
export const mongoDriverSchema = z.object({
  tenantId: z.string(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(1).optional(),
  experience: z.number().int().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  status: z.enum(['available', 'on_duty', 'inactive']).default('available'),
  languages: z.array(z.string()).default([]),
  // Additional fields
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  aadharNumber: z.string().optional(),
  panNumber: z.string().optional(),
  dateOfJoining: z.string().optional()
});

// MongoDB Booking Schema
export const mongoBookingSchema = z.object({
  tenantId: z.string(),
  bookingId: z.string().optional(),
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
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  customerEmail: z.string().email().optional(),
  // Optional as of the flexible-fulfilment initiative — see
  // docs/BOOKING_RESOURCE_DEAD_END_AUDIT.md. server/routes.ts's
  // POST /api/bookings enforces the actual "own vehicle, vendor vehicle,
  // or explicit assignment-pending" business rule; this schema only
  // guards the field's type/shape when present.
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
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
  bookingType: z.enum(['self_drive', 'with_driver', 'one_way', 'round_trip', 'local', 'airport']),
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
  totalAmount: z.number().positive(),
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

export type MongoTenant = z.infer<typeof mongoTenantSchema>;
export type MongoUser = z.infer<typeof mongoUserSchema>;
export type MongoVehicle = z.infer<typeof mongoVehicleSchema>;
export type MongoDriver = z.infer<typeof mongoDriverSchema>;
export type MongoBooking = z.infer<typeof mongoBookingSchema>;