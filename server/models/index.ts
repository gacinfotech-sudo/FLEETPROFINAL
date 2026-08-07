import mongoose, { Schema, Document } from 'mongoose';
// TASK-BOOKING-DOMAIN-02: date-certainty enums + conditional-required
// predicates. vehicleId/resourceFulfilmentStatus are NOT part of this —
// that shipped separately (see the IBooking comments below). See
// server/booking/domain/ for the full design rationale.
import {
  TRAVEL_DATE_STATUSES, TRIP_TYPES,
  isPickupDateRequired, isTentativeRangeRequired,
} from '../booking/domain';

// Interfaces for TypeScript
export interface ITenant extends Document {
  name: string;
  businessName: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  maxManagers: number; // Maximum allowed managers per client (default: 5)
  subscriptionPlan: 'starter' | 'pro' | 'custom';
  limits: {
    vehicles: number;
    drivers: number;
    managers: number;
  };
  createdAt: Date;
}

export interface IUser extends Document {
  userId: string;
  name?: string;
  password: string;
  role: 'admin' | 'client' | 'manager';
  tenantId?: mongoose.Types.ObjectId;
  sessionId?: string;
  // P1 FIX: this field is used throughout storage-mongodb.ts /
  // admin-recovery.ts (session device tracking, session-hijacking
  // fingerprint checks) and is defined on the Mongoose schema below, but
  // was missing from this TS interface — silently breaking type-checking
  // and IDE support for a security-relevant field.
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    loginTime?: Date;
  };
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginUserAgent?: string;
  loginAttempts: number;
  failedLoginAttempts: number;
  accountLocked: boolean;
  lockoutTime?: Date;
  isActive: boolean;
  mustResetPassword: boolean;
  hasCompletedOnboarding: boolean; // Track onboarding completion for new users
  createdBy?: string; // userId of who created this user
  permissions: string[]; // Array of permission strings
  businessDetails?: {
    businessName: string;
    ownerName: string;
    businessAddress: string;
    gstNumber?: string;
    businessEmail: string;
    businessPhone: string;
    logoUrl?: string;
    signatureUrl?: string;
  };
  createdAt: Date;
}

export interface IVehicle extends Document {
  tenantId: mongoose.Types.ObjectId;
  make: string; // Only car name is required
  vehicleModel?: string; // Optional
  year?: number; // Optional
  licensePlate?: string; // Optional
  capacity?: number; // Optional
  type: 'economy' | 'standard' | 'premium' | 'luxury' | 'suv' | 'sedan' | 'hatchback' | 'coupe' | 'convertible';
  status: 'available' | 'on_trip' | 'maintenance';
  features: string[];
  pricePerDay: number;
  pricePerHour: number;
  pricePerKm: number;
  color?: string;
  fuelType?: string;
  transmission?: string;
  createdAt: Date;
}

export interface IDriver extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  licenseNumber?: string;
  experience?: number;
  rating?: number;
  status: 'available' | 'on_duty' | 'inactive';
  languages?: string[];
  // Additional fields
  permanentAddress?: string;
  currentAddress?: string;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  aadharNumber?: string;
  panNumber?: string;
  dateOfJoining?: Date;
  createdAt: Date;
  // Driver portal login (additive) — a deliberately separate, minimal auth
  // surface from the staff User/role system, not a new User.role value.
  // Reasoning: this codebase has 100+ routes gated only by
  // `authenticateUser, requireTenant` with no further per-route permission
  // check, all written assuming only admin/client/manager roles exist —
  // adding a 'driver' role to User would silently pass those, a much
  // larger and riskier surface than intended. A driver session can only
  // ever authenticate against the small, explicit set of /api/driver-*
  // routes built for it.
  loginPin?: string; // bcrypt hash, never the raw PIN
  loginPinSetAt?: Date;
  sessionId?: string;
}

export interface IBooking extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: string;
  // Client-generated, one per booking-form submission session (not
  // persisted/reused across a genuinely new booking) — lets a double
  // form-submit or a retried request after a dropped response resolve to
  // the SAME booking instead of creating a duplicate. Optional so every
  // booking created before this field existed, and every non-UI caller
  // (imports, migrations, tests) that doesn't send one, is unaffected.
  idempotencyKey?: string;
  // customerName/customerPhone stay exactly as they were — the booking-time
  // snapshot, preserved for audit/history even if the Customer record is
  // edited later. customerId links to the actual Customer Database record
  // (see findOrCreateCustomer in services/customerService.ts); optional so
  // every booking created before the CRM module existed keeps working
  // unmigrated until the backfill script links it.
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  // Optional as of the flexible-fulfilment initiative: a booking may be
  // confirmed with the physical company vehicle still unresolved (vendor
  // path, or sourcing still in progress) — see resourceFulfilmentStatus.
  // A real vehicleId (company OR vendor) remains mandatory before Trip
  // Start; see bookingStateMachine.ts's REQUIRES_ASSIGNMENT gate.
  vehicleId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  // Set once, by the assigned driver themselves via the driver portal
  // (POST /api/driver-portal/bookings/:id/accept-duty) — trip start is
  // unaffected by this either way (spec: don't block on it), it's
  // visibility for ops, not a gate.
  dutyAcceptedAt?: Date;
  pickupLocation: string;
  dropoffLocation?: string;
  // Optional as of TASK-BOOKING-DOMAIN-02: required only when
  // travelDateStatus is 'confirmed' (the default — see
  // requiredRules.isPickupDateRequired and legacy.ts's
  // resolveTravelDateStatus for why an ABSENT travelDateStatus on a
  // pre-existing document must still mean 'confirmed', never
  // 'not_decided').
  pickupDate?: Date;
  returnDate?: Date;
  pickupTime?: string;
  returnTime?: string;
  // Date-certainty axis (TASK-BOOKING-DOMAIN-02) — orthogonal to
  // resourceFulfilmentStatus below (vehicle-certainty, already shipped).
  // MUST default to 'confirmed': every document that predates this field
  // was created back when pickupDate was unconditionally required, so
  // its absence always means a real date was supplied, never
  // uncertainty. See server/booking/domain/legacy.ts.
  travelDateStatus?: 'confirmed' | 'range' | 'not_decided';
  // Required (via requiredRules.isTentativeRangeRequired) only when
  // travelDateStatus === 'range' — a customer-given window ("sometime in
  // the first two weeks of next month") rather than a single confirmed date.
  tentativeStartDate?: Date;
  tentativeEndDate?: Date;
  // When to next follow up on an undecided/tentative booking — genuinely
  // new, no prior concept existed. No legacy-default meaning (see
  // legacy.ts's resolveFollowUpAt): absence just means "no follow-up set".
  followUpAt?: Date;
  // Server-derived "last touched" signal — NOT accepted from client
  // payloads (see bookingCertaintySchema.ts's comment on why). Falls back
  // to updatedAt, then createdAt, for any document that predates it; see
  // legacy.ts's resolveLastActivityAt. Not backfilled.
  lastActivityAt?: Date;
  // Booking had no updatedAt field at all before this task (verified:
  // grep for `booking.updatedAt`/`Booking...updatedAt` across
  // server/routes.ts, server/services/*.ts, server/storage-mongodb.ts
  // returns nothing) — added here as a plain, pre('save')-maintained
  // field (matching the existing CustomerSchema/ReferralSchema/etc.
  // convention already used elsewhere in this file) rather than turning
  // on Mongoose's `timestamps: true` schema option, which would also
  // start managing createdAt and risk conflicting with its existing
  // `default: Date.now` behavior.
  updatedAt?: Date;
  // Auto-computed (pre-save hook) from pickupDate+pickupTime and
  // returnDate+returnTime — pickupDate/returnDate alone are ALWAYS
  // midnight, with the real clock time living only in the separate
  // pickupTime/returnTime strings. Driver/vehicle overlap queries must
  // compare against these combined instants, never the raw date fields,
  // or two same-day bookings at different times can never be detected as
  // conflicting (a stored midnight returnDate can never be "after" a
  // same-day afternoon start time once the query itself uses real times).
  scheduledStartDateTime?: Date;
  scheduledEndDateTime?: Date;
  // Scheduled = what was booked. Actual = what really happened. These
  // must never be conflated — a booking's pickup time arriving does NOT
  // mean the trip started; only an explicit Start Trip action (or a
  // verified automation event) sets actualStartDateTime.
  actualStartDateTime?: Date;
  actualEndDateTime?: Date;
  startOdometer?: number;
  endOdometer?: number;
  rescheduleHistory?: {
    oldPickupDate: Date;
    oldPickupTime?: string;
    oldReturnDate?: Date;
    oldReturnTime?: string;
    newPickupDate: Date;
    newPickupTime?: string;
    newReturnDate?: Date;
    newReturnTime?: string;
    reason?: string;
    changedBy: { userId: string; role: string };
    changedAt: Date;
  }[];
  // Backdated authorized corrections (TASK-BOOKING-DOMAIN-02) — distinct
  // from rescheduleHistory above (which records a FORWARD schedule change
  // made through the normal reschedule flow). This is staff correcting
  // the record of something already entered, on any field, always with a
  // reason — see server/booking/domain/revisionHistory.ts, the only code
  // path that can construct an entry (it throws without a non-empty
  // reason). Never populated directly from a raw booking edit payload.
  revisionHistory?: {
    fieldsChanged: string[];
    previousValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
    reason: string;
    authorizedBy: { userId: string; role: string };
    correctedAt: Date;
  }[];
  // Booking Source: where the booking came from. Deliberately separate
  // from fulfilmentType below (who's providing the vehicle) — a booking
  // can arrive from a Travel Agent and still be fulfilled by our own
  // vehicle, or arrive direct and be outsourced to a vendor. Conflating
  // these two was explicitly called out as a real-world accounting bug.
  bookingSource?: 'direct_customer' | 'walk_in' | 'phone_call' | 'whatsapp' | 'website' | 'google_business_profile' |
    'google_ads' | 'facebook' | 'instagram' | 'hotel' | 'corporate_client' | 'travel_agent' | 'vendor_partner' |
    'referral' | 'online_travel_platform' | 'repeat_customer' | 'other';
  sourceName?: string;
  sourceContact?: string;
  sourceCommissionType?: 'flat' | 'percentage';
  sourceCommissionAmount?: number;
  sourceReferenceNumber?: string;
  sourceNotes?: string;
  // Optional link to a real Vendor Master record (Vendor 360°). The
  // free-text sourceName/sourceContact above remain the display fields
  // either way — set from the linked vendor when this is present.
  sourceVendorId?: mongoose.Types.ObjectId;
  // Kept distinct from sourceVendorId/sourceName above — a customer
  // Referral (spec §28: "keep separate: customer referral reward vs
  // hotel commission vs travel agent commission vs vendor commission")
  // is a rewarded relationship between two Customer records, not a
  // source-category attribution tag.
  referralId?: mongoose.Types.ObjectId;
  // Fulfilment: who is actually providing the vehicle/driver for this
  // booking. fulfilmentVendorId/vendorDriverId/vendorVehicleId are
  // optional links to real Vendor 360° records (set via
  // POST /api/bookings/:id/assign-vendor); the free-text fields below
  // stay populated either way (derived from the linked records when
  // present) so every existing reader of them keeps working unchanged.
  fulfilmentType?: 'own' | 'vendor';
  vendorName?: string;
  vendorContactPhone?: string;
  vendorDriverName?: string;
  vendorDriverPhone?: string;
  vendorVehicleDetails?: string;
  vendorAgreedRate?: number;
  vendorAdvancePaid?: number;
  fulfilmentVendorId?: mongoose.Types.ObjectId;
  vendorDriverId?: mongoose.Types.ObjectId;
  vendorVehicleId?: mongoose.Types.ObjectId;
  // Summary status for dashboards/filters/the Resource Fulfilment panel —
  // set from own-fleet assignment, vendor confirmation, or sourcing-request
  // events. Never the source of truth for outsourcing detail (a linked
  // VendorSourcingRequest is), just the current best-known state at the
  // booking level. Absent on bookings created before this field existed
  // (and on any booking whose vehicleId was already resolved at creation,
  // where it's simply never set) — treat missing as equivalent to
  // 'own_fleet_assigned' when vehicleId is set, 'not_started' otherwise.
  resourceFulfilmentStatus?: 'not_started' | 'own_fleet_assigned' | 'vendor_vehicle_selected' |
    'vendor_confirmation_pending' | 'vendor_confirmed' | 'outsourcing_requested' | 'vendor_quotes_pending' |
    'resource_sourcing_pending' | 'resource_secured' | 'resource_rejected' | 'resource_failed';
  bookingType: 'self_drive' | 'with_driver' | 'one_way' | 'round_trip' | 'local' | 'airport';
  // Trip shape (TASK-BOOKING-DOMAIN-02) — kept strictly distinct from
  // bookingType above (who drives). Was declared and required on the
  // client Zod schema and submitted on every create request, but silently
  // stripped by the server Zod schema and never declared here — see
  // server/booking/domain/tripType.ts and
  // server/services/invoiceService.ts, which already reads this field
  // expecting it to exist.
  tripType?: 'one_way' | 'round_trip' | 'local' | 'airport';
  pricingType?: 'day' | 'km';
  totalKilometers?: number;
  status: 'enquiry' | 'quotation_sent' | 'tentative' | 'on_hold' | 'confirmed' | 'vehicle_assigned' |
    'driver_assigned' | 'ready_for_dispatch' | 'trip_started' | 'ongoing' | 'extended' | 'return_pending' |
    'completed' | 'payment_pending' | 'closed' | 'cancelled' | 'no_show';
  statusHistory?: {
    fromStatus: string;
    toStatus: string;
    changedBy: { userId: string; role: string };
    reason?: string;
    override?: boolean;
    changedAt: Date;
  }[];
  totalAmount: number;
  // If reward points were redeemed on this booking, totalAmount is the
  // price AFTER the discount — originalAmount preserves what it would
  // have been without redemption, and rewardDiscountApplied is the ₹
  // value of the discount, kept as its own field rather than folded
  // silently into totalAmount so the pricing snapshot stays auditable.
  originalAmount?: number;
  rewardPointsRedeemed?: number;
  rewardDiscountApplied?: number;
  advanceReceived?: number;
  advanceRequested?: number;
  driverCollectionAmount?: number;
  collectionMode?: 'company' | 'driver' | 'vendor' | 'split';
  // Free-text summary of what was agreed with the customer on the phone —
  // visible to customer and driver in WhatsApp messages. Distinct from
  // `notes`, which is treated as driver/office-facing instructions.
  customerDiscussionSummary?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  notes?: string;
  tollCharges?: number;
  parkingCharges?: number;
  petrolCharges?: number;
  dieselCharges?: number;
  cngCharges?: number;
  miscellaneousAmount?: number;
  miscellaneousDescription?: string;
  cancellationReason?: string;
  cancellationType?: 'customer' | 'company' | 'vendor';
  additionalStops?: string[];
  extensionHistory?: {
    extensionNumber: number;
    previousReturnDate?: Date;
    previousReturnTime?: string;
    newReturnDate: Date;
    newReturnTime?: string;
    addedDestinations?: string[];
    charges: {
      additionalDays?: number;
      additionalDaysCharge?: number;
      extraKmCharge?: number;
      driverAllowance?: number;
      nightHalt?: number;
      routeCharge?: number;
      discount?: number;
    };
    extensionTotal: number;
    previousTotal: number;
    revisedTotal: number;
    reason?: string;
    notes?: string;
    requestedBy: { userId: string; role: string };
    createdAt: Date;
  }[];
  // Third-party driver fields
  useThirdPartyDriver?: boolean;
  thirdPartyDriverName?: string;
  thirdPartyDriverCharges?: number;
  thirdPartyDriverPhone?: string;
  thirdPartyDriverAddress?: string;
  createdBy?: {
    userId: string;
    role: string;
  };
  createdAt: Date;
}

export interface IExpense extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  category: 'maintenance' | 'damage' | 'tires' | 'fuel' | 'other';
  amount: number;
  date: Date;
  description?: string;
  attachmentUrl?: string;
  createdBy?: {
    userId: string;
    role: string;
  };
  createdAt: Date;
  // Additive trip-linkage fields (docs/TRIP_COSTING_DATA_MAPPING.md). All
  // optional — an Expense with none of these set is exactly the original
  // "general vehicle cost, no trip attached" record (maintenance/damage/
  // tires/etc.), unchanged. Only expenses deliberately linked to a booking
  // via bookingId feed the Trip Cost Summary.
  bookingId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  customerChargeable?: boolean;
  reimbursable?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: {
    userId: string;
    role: string;
  };
  approvedAt?: Date;
}

// Tenant Schema
const TenantSchema = new Schema<ITenant>({
  name: { type: String, required: true },
  businessName: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  isActive: { type: Boolean, default: true },
  maxManagers: { type: Number, default: 5 }, // Kept for backward compatibility
  subscriptionPlan: { 
    type: String, 
    enum: ['starter', 'pro', 'custom'], 
    default: 'starter' 
  },
  limits: {
    vehicles: { type: Number, default: 6 }, // Starter plan default
    drivers: { type: Number, default: 3 },  // Starter plan default
    managers: { type: Number, default: 1 }  // Starter plan default
  },
  createdAt: { type: Date, default: Date.now }
});

// User Schema
const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true },
  name: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'client', 'manager'], default: 'client' },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  sessionId: { type: String },
  deviceInfo: {
    userAgent: { type: String },
    ip: { type: String },
    loginTime: { type: Date }
  },
  lastLogin: { type: Date },
  lastLoginIP: { type: String },
  lastLoginUserAgent: { type: String },
  loginAttempts: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0 },
  accountLocked: { type: Boolean, default: false },
  lockoutTime: { type: Date },
  isActive: { type: Boolean, default: true },
  mustResetPassword: { type: Boolean, default: false },
  hasCompletedOnboarding: { type: Boolean, default: false }, // Track onboarding completion
  createdBy: { type: String }, // userId of who created this user
  permissions: { type: [String], default: [] }, // Array of permission strings
  businessDetails: {
    businessName: { type: String },
    ownerName: { type: String },
    businessAddress: { type: String },
    gstNumber: { type: String },
    businessEmail: { type: String },
    businessPhone: { type: String },
    logoUrl: { type: String },
    signatureUrl: { type: String }
  },
  createdAt: { type: Date, default: Date.now }
});

// Vehicle Schema
const VehicleSchema = new Schema<IVehicle>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  make: { type: String, required: true }, // Only car name is required
  vehicleModel: { type: String }, // Optional
  year: { type: Number }, // Optional
  licensePlate: { type: String }, // Optional
  capacity: { type: Number }, // Optional
  type: { 
    type: String, 
    enum: ['economy', 'standard', 'premium', 'luxury', 'suv', 'sedan', 'hatchback', 'coupe', 'convertible'], 
    default: 'economy' 
  },
  status: {
    type: String,
    enum: ['available', 'on_trip', 'maintenance'],
    default: 'available'
  },
  features: [{ type: String }],
  pricePerDay: { type: Number, default: 0 }, // Optional with default
  pricePerHour: { type: Number, default: 0 }, // Optional with default
  pricePerKm: { type: Number, default: 0 }, // Optional with default
  color: { type: String },
  fuelType: { type: String },
  transmission: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Driver Schema
const DriverSchema = new Schema<IDriver>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  licenseNumber: { type: String },
  experience: { type: Number },
  rating: { type: Number, min: 1, max: 5 },
  status: {
    type: String,
    enum: ['available', 'on_duty', 'inactive'],
    default: 'available'
  },
  languages: [{ type: String }],
  // Additional fields
  permanentAddress: { type: String },
  currentAddress: { type: String },
  maritalStatus: { 
    type: String, 
    enum: ['single', 'married', 'divorced', 'widowed'] 
  },
  aadharNumber: { type: String },
  panNumber: { type: String },
  dateOfJoining: { type: Date },
  createdAt: { type: Date, default: Date.now },
  loginPin: { type: String },
  loginPinSetAt: { type: Date },
  sessionId: { type: String },
});
// Backs authenticateDriver's per-request session lookup.
DriverSchema.index({ sessionId: 1 });

// Booking Schema
const BookingSchema = new Schema<IBooking>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  bookingId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  dutyAcceptedAt: { type: Date },
  pickupLocation: { type: String, required: true },
  dropoffLocation: { type: String },
  pickupDate: {
    type: Date,
    // Conditionally required (TASK-BOOKING-DOMAIN-02) — required exactly
    // when travelDateStatus is 'confirmed' (the default). See
    // requiredRules.isPickupDateRequired.
    required: function (this: any) { return isPickupDateRequired(this); },
  },
  returnDate: { type: Date },
  pickupTime: { type: String },
  returnTime: { type: String },
  // Date-certainty axis (TASK-BOOKING-DOMAIN-02). default: 'confirmed' is
  // the single most important line in this whole patch — see
  // server/booking/domain/legacy.ts's resolveTravelDateStatus comment.
  travelDateStatus: { type: String, enum: TRAVEL_DATE_STATUSES, default: 'confirmed' },
  tentativeStartDate: {
    type: Date,
    required: function (this: any) { return isTentativeRangeRequired(this); },
  },
  tentativeEndDate: {
    type: Date,
    required: function (this: any) { return isTentativeRangeRequired(this); },
  },
  followUpAt: { type: Date },
  lastActivityAt: { type: Date },
  updatedAt: { type: Date },
  scheduledStartDateTime: { type: Date },
  scheduledEndDateTime: { type: Date },
  actualStartDateTime: { type: Date },
  actualEndDateTime: { type: Date },
  startOdometer: { type: Number },
  endOdometer: { type: Number },
  rescheduleHistory: [{
    oldPickupDate: { type: Date },
    oldPickupTime: { type: String },
    oldReturnDate: { type: Date },
    oldReturnTime: { type: String },
    newPickupDate: { type: Date },
    newPickupTime: { type: String },
    newReturnDate: { type: Date },
    newReturnTime: { type: String },
    reason: { type: String },
    changedBy: {
      userId: { type: String },
      role: { type: String }
    },
    changedAt: { type: Date, default: Date.now }
  }],
  // Backdated authorized corrections (TASK-BOOKING-DOMAIN-02) — see the
  // IBooking interface comment above and
  // server/booking/domain/revisionHistory.ts. `reason` is `required: true`
  // at the schema layer too (not just at the builder-function layer) so a
  // direct/scripted write attempting to skip it fails loudly.
  revisionHistory: [{
    fieldsChanged: [{ type: String }],
    previousValues: { type: Schema.Types.Mixed },
    newValues: { type: Schema.Types.Mixed },
    reason: { type: String, required: true },
    authorizedBy: {
      userId: { type: String },
      role: { type: String }
    },
    correctedAt: { type: Date, default: Date.now }
  }],
  bookingSource: {
    type: String,
    enum: ['direct_customer', 'walk_in', 'phone_call', 'whatsapp', 'website', 'google_business_profile',
      'google_ads', 'facebook', 'instagram', 'hotel', 'corporate_client', 'travel_agent', 'vendor_partner',
      'referral', 'online_travel_platform', 'repeat_customer', 'other'],
    default: 'direct_customer'
  },
  sourceName: { type: String },
  sourceContact: { type: String },
  sourceCommissionType: { type: String, enum: ['flat', 'percentage'] },
  sourceCommissionAmount: { type: Number },
  sourceReferenceNumber: { type: String },
  sourceNotes: { type: String },
  sourceVendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  referralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
  fulfilmentType: { type: String, enum: ['own', 'vendor'], default: 'own' },
  vendorName: { type: String },
  vendorContactPhone: { type: String },
  vendorDriverName: { type: String },
  vendorDriverPhone: { type: String },
  vendorVehicleDetails: { type: String },
  vendorAgreedRate: { type: Number },
  vendorAdvancePaid: { type: Number },
  fulfilmentVendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  vendorDriverId: { type: Schema.Types.ObjectId, ref: 'VendorDriver' },
  vendorVehicleId: { type: Schema.Types.ObjectId, ref: 'VendorVehicle' },
  resourceFulfilmentStatus: {
    type: String,
    enum: ['not_started', 'own_fleet_assigned', 'vendor_vehicle_selected', 'vendor_confirmation_pending',
      'vendor_confirmed', 'outsourcing_requested', 'vendor_quotes_pending', 'resource_sourcing_pending',
      'resource_secured', 'resource_rejected', 'resource_failed'],
  },
  // Trip shape (TASK-BOOKING-DOMAIN-02) — see the IBooking interface
  // comment above for why this was previously dead code.
  tripType: {
    type: String,
    enum: TRIP_TYPES,
  },
  bookingType: {
    type: String,
    enum: ['self_drive', 'with_driver', 'one_way', 'round_trip', 'local', 'airport'],
    required: true
  },
  pricingType: {
    type: String,
    enum: ['day', 'km'],
    default: 'day'
  },
  totalKilometers: { type: Number, min: 0 },
  status: {
    type: String,
    enum: ['enquiry', 'quotation_sent', 'tentative', 'on_hold', 'confirmed', 'vehicle_assigned',
      'driver_assigned', 'ready_for_dispatch', 'trip_started', 'ongoing', 'extended', 'return_pending',
      'completed', 'payment_pending', 'closed', 'cancelled', 'no_show'],
    default: 'confirmed'
  },
  statusHistory: [{
    fromStatus: { type: String },
    toStatus: { type: String },
    changedBy: {
      userId: { type: String },
      role: { type: String }
    },
    reason: { type: String },
    override: { type: Boolean, default: false },
    changedAt: { type: Date, default: Date.now }
  }],
  totalAmount: { type: Number, required: true },
  originalAmount: { type: Number },
  rewardPointsRedeemed: { type: Number, default: 0 },
  rewardDiscountApplied: { type: Number, default: 0 },
  // Cached summary, derived server-side from PaymentTransaction (see
  // recomputeBookingPaymentSummary in routes.ts) — never written to
  // directly from a booking edit. Kept as a real field (not computed on
  // every read) because WhatsApp messages, dashboards, and duty slips all
  // need to read it cheaply and synchronously.
  advanceReceived: { type: Number, default: 0 },
  // What staff asked the customer for — a target/reminder number, not a
  // ledger entry. advanceReceived (above) is what was actually recorded.
  advanceRequested: { type: Number, default: 0 },
  // Planned/expected amount for the driver (or vendor) to collect from
  // the customer directly — distinct from actual driver_collection
  // ledger transactions, which record what was ACTUALLY collected. This
  // is the number shown on the duty slip / driver WhatsApp message before
  // the trip happens.
  driverCollectionAmount: { type: Number, default: 0 },
  collectionMode: {
    type: String,
    enum: ['company', 'driver', 'vendor', 'split'],
    default: 'company',
  },
  customerDiscussionSummary: { type: String },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'refunded'], 
    default: 'pending' 
  },
  notes: { type: String },
  tollCharges: { type: Number, default: 0 },
  parkingCharges: { type: Number, default: 0 },
  petrolCharges: { type: Number, default: 0 },
  dieselCharges: { type: Number, default: 0 },
  cngCharges: { type: Number, default: 0 },
  miscellaneousAmount: { type: Number, default: 0 },
  miscellaneousDescription: { type: String },
  cancellationReason: { type: String },
  cancellationType: { type: String, enum: ['customer', 'company', 'vendor'] },
  additionalStops: [{ type: String }],
  extensionHistory: [{
    extensionNumber: { type: Number },
    previousReturnDate: { type: Date },
    previousReturnTime: { type: String },
    newReturnDate: { type: Date },
    newReturnTime: { type: String },
    addedDestinations: [{ type: String }],
    charges: {
      additionalDays: { type: Number },
      additionalDaysCharge: { type: Number },
      extraKmCharge: { type: Number },
      driverAllowance: { type: Number },
      nightHalt: { type: Number },
      routeCharge: { type: Number },
      discount: { type: Number }
    },
    extensionTotal: { type: Number },
    previousTotal: { type: Number },
    revisedTotal: { type: Number },
    reason: { type: String },
    notes: { type: String },
    requestedBy: {
      userId: { type: String },
      role: { type: String }
    },
    createdAt: { type: Date, default: Date.now }
  }],
  // Third-party driver fields
  useThirdPartyDriver: { type: Boolean, default: false },
  thirdPartyDriverName: { type: String },
  thirdPartyDriverCharges: { type: Number, default: 0 },
  thirdPartyDriverPhone: { type: String },
  thirdPartyDriverAddress: { type: String },
  createdBy: {
    userId: { type: String, required: false },
    role: { type: String, required: false }
  },
  createdAt: { type: Date, default: Date.now }
} as const);

function combineDateAndTime(date: any, time?: string): Date | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

// Keeps scheduledStartDateTime/scheduledEndDateTime in sync with
// pickupDate/pickupTime/returnDate/returnTime on every save, so overlap
// queries always have a real, comparable instant to check against instead
// of the raw date fields (which never carry a time-of-day). Runs on any
// save — direct field assignment + .save() (routes.ts) as well as
// Mongoose document creation — so there's exactly one place this
// computation happens, not one per call site.
BookingSchema.pre('save', function (next) {
  if (this.isModified('pickupDate') || this.isModified('pickupTime') || this.isNew) {
    this.scheduledStartDateTime = combineDateAndTime(this.pickupDate, this.pickupTime);
  }
  if (this.isModified('returnDate') || this.isModified('returnTime') || this.isModified('pickupDate') || this.isModified('pickupTime') || this.isNew) {
    this.scheduledEndDateTime = combineDateAndTime(this.returnDate || this.pickupDate, this.returnTime || this.pickupTime) || this.scheduledStartDateTime;
  }
  // TASK-BOOKING-DOMAIN-02: Booking had no updatedAt at all before this —
  // maintained here the same way CustomerSchema/ReferralSchema/etc.
  // already do elsewhere in this file. lastActivityAt mirrors it for
  // every document saved from this point forward; a document that
  // predates this hook and is never re-saved keeps falling back through
  // legacy.ts's resolveLastActivityAt (updatedAt, then createdAt) — no
  // backfill happens here.
  (this as any).updatedAt = new Date();
  (this as any).lastActivityAt = (this as any).updatedAt;
  next();
});

// storage.updateBooking() goes through findOneAndUpdate, which does NOT
// run pre('save') hooks — without this, a driver/date change made via the
// PUT /api/bookings/:id route would silently leave scheduledStartDateTime
// / scheduledEndDateTime stale, and every subsequent overlap check against
// this booking would use the wrong window.
BookingSchema.pre('findOneAndUpdate', async function (next) {
  const update: any = this.getUpdate();
  const set = update?.$set || update || {};
  const touchesSchedule = 'pickupDate' in set || 'pickupTime' in set || 'returnDate' in set || 'returnTime' in set;
  if (!touchesSchedule) return next();

  const existing: any = await this.model.findOne(this.getQuery()).select('pickupDate pickupTime returnDate returnTime');
  const pickupDate = set.pickupDate ?? existing?.pickupDate;
  const pickupTime = set.pickupTime ?? existing?.pickupTime;
  const returnDate = set.returnDate ?? existing?.returnDate ?? pickupDate;
  const returnTime = set.returnTime ?? existing?.returnTime ?? pickupTime;

  const scheduledStartDateTime = combineDateAndTime(pickupDate, pickupTime);
  const scheduledEndDateTime = combineDateAndTime(returnDate, returnTime) || scheduledStartDateTime;

  if (update.$set) {
    update.$set.scheduledStartDateTime = scheduledStartDateTime;
    update.$set.scheduledEndDateTime = scheduledEndDateTime;
  } else {
    update.scheduledStartDateTime = scheduledStartDateTime;
    update.scheduledEndDateTime = scheduledEndDateTime;
  }
  this.setUpdate(update);
  next();
});

// TASK-BOOKING-DOMAIN-02: same updatedAt/lastActivityAt maintenance as the
// pre('save') hook above, for the findOneAndUpdate path (PUT
// /api/bookings/:id goes through storage.updateBooking(), which — like
// the scheduledStartDateTime sync above — does NOT run pre('save') hooks.
// Runs on every update unconditionally (not just schedule-touching ones)
// since "was this booking touched at all" is the actual signal
// lastActivityAt exists to carry.
BookingSchema.pre('findOneAndUpdate', function (next) {
  const update: any = this.getUpdate();
  const now = new Date();
  if (update.$set) {
    update.$set.updatedAt = now;
    update.$set.lastActivityAt = now;
  } else {
    update.updatedAt = now;
    update.lastActivityAt = now;
  }
  this.setUpdate(update);
  next();
});

// Expense Schema
const ExpenseSchema = new Schema<IExpense>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  category: { 
    type: String, 
    enum: ['maintenance', 'damage', 'tires', 'fuel', 'other'], 
    required: true 
  },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  attachmentUrl: { type: String },
  createdBy: {
    userId: { type: String, required: false },
    role: { type: String, required: false }
  },
  createdAt: { type: Date, default: Date.now },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  customerChargeable: { type: Boolean, default: false },
  reimbursable: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: {
    userId: { type: String, required: false },
    role: { type: String, required: false }
  },
  approvedAt: { type: Date },
});

export interface IWhatsAppMessage extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  quotationId?: mongoose.Types.ObjectId;
  // Vendor Sourcing (spec §17) — additive, mirrors the existing optional
  // link fields above so the outsourcing workflow reuses this same
  // ledger/audit trail rather than a second WhatsApp log.
  vendorId?: mongoose.Types.ObjectId;
  sourcingRequestId?: mongoose.Types.ObjectId;
  recipientType: 'customer' | 'driver' | 'vendor';
  recipientPhone: string;
  messageType: string;
  content: string;
  provider: string;
  status: 'queued' | 'sent' | 'failed';
  attemptCount: number;
  providerMessageId?: string;
  error?: string;
  createdBy?: { userId: string; role: string };
  idempotencyKey: string;
  sentAt?: Date;
  createdAt: Date;
}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessage>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  quotationId: { type: Schema.Types.ObjectId, ref: 'Quotation' },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  sourcingRequestId: { type: Schema.Types.ObjectId, ref: 'VendorSourcingRequest' },
  recipientType: { type: String, enum: ['customer', 'driver', 'vendor'], required: true },
  recipientPhone: { type: String, required: true },
  messageType: { type: String, required: true },
  content: { type: String, required: true },
  provider: { type: String, required: true },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
  attemptCount: { type: Number, default: 0 },
  providerMessageId: { type: String },
  error: { type: String },
  createdBy: {
    userId: { type: String },
    role: { type: String }
  },
  idempotencyKey: { type: String, required: true },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});
WhatsAppMessageSchema.index({ tenantId: 1, bookingId: 1 });
WhatsAppMessageSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
// One non-failed send per idempotency key — the actual duplicate-send
// guard. Failed attempts are excluded so a real send failure can be
// retried under the same key without hitting a unique-index conflict.
WhatsAppMessageSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['queued', 'sent'] } } }
);

// Ledger-based payments — the source of truth for what a customer has
// actually paid. booking.advanceReceived stays as a fast-read cached
// summary (existing code already displays it), but it is only ever
// derived by summing these transactions server-side; nothing writes to it
// directly. Every payment recorded, corrected, or refunded is its own
// row here, so editing a booking or fixing a mistake never destroys the
// history of what actually happened.
export interface IPaymentTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  amount: number;
  paymentType: 'advance' | 'partial_payment' | 'final_payment' | 'refund' | 'adjustment' | 'driver_collection' | 'vendor_collection';
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'card' | 'payment_gateway' | 'driver_collection' | 'vendor_collection' | 'credit';
  status: 'completed' | 'reversed';
  transactionReference?: string;
  receivedBy?: string;
  receivedAt: Date;
  notes?: string;
  createdBy: { userId: string; role: string };
  reversalOf?: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  createdAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  amount: { type: Number, required: true },
  paymentType: {
    type: String,
    enum: ['advance', 'partial_payment', 'final_payment', 'refund', 'adjustment', 'driver_collection', 'vendor_collection'],
    required: true,
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'card', 'payment_gateway', 'driver_collection', 'vendor_collection', 'credit'],
    required: true,
  },
  // 'reversed' — a completed payment is never deleted or edited in place
  // (spec: "Completed payments must not be silently overwritten"); a
  // correction creates a NEW reversal transaction pointing back at the
  // original via reversalOf, and the original's status flips to
  // 'reversed' so it stops counting toward the balance while staying in
  // the history for audit purposes.
  status: { type: String, enum: ['completed', 'reversed'], default: 'completed' },
  transactionReference: { type: String },
  receivedBy: { type: String },
  receivedAt: { type: Date, required: true, default: Date.now },
  notes: { type: String },
  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  reversalOf: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction' },
  idempotencyKey: { type: String },
  createdAt: { type: Date, default: Date.now },
});
PaymentTransactionSchema.index({ tenantId: 1, bookingId: 1, status: 1 });
PaymentTransactionSchema.index(
  { tenantId: 1, reversalOf: 1 },
  { unique: true, partialFilterExpression: { reversalOf: { $exists: true } } }
);
PaymentTransactionSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export interface IDriverLeave extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  leaveType: 'paid' | 'unpaid' | 'medical' | 'emergency' | 'weekly_off' | 'comp_off' | 'other';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: { userId: string; role: string };
  approvedBy?: { userId: string; role: string };
  approvalNote?: string;
  conflictingBookings?: string[]; // bookingIds flagged at approval time, for audit
  createdAt: Date;
}

const DriverLeaveSchema = new Schema<IDriverLeave>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  leaveType: {
    type: String,
    enum: ['paid', 'unpaid', 'medical', 'emergency', 'weekly_off', 'comp_off', 'other'],
    default: 'unpaid'
  },
  reason: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  requestedBy: {
    userId: { type: String },
    role: { type: String }
  },
  approvedBy: {
    userId: { type: String },
    role: { type: String }
  },
  approvalNote: { type: String },
  conflictingBookings: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});
DriverLeaveSchema.index({ tenantId: 1, driverId: 1, status: 1 });

export interface IDriverAttendance extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  date: Date; // normalized to local midnight — one record per driver per day
  status: 'present' | 'absent' | 'on_duty' | 'weekly_off' | 'paid_leave' | 'unpaid_leave' |
    'half_day' | 'late' | 'not_scheduled';
  reportingTime?: string;
  actualCheckIn?: Date;
  actualCheckOut?: Date;
  workingHours?: number;
  dutyBookingId?: mongoose.Types.ObjectId;
  lateDurationMinutes?: number;
  source: 'duty_based' | 'manual';
  markedBy?: { userId: string; role: string };
  notes?: string;
  createdAt: Date;
}

const DriverAttendanceSchema = new Schema<IDriverAttendance>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['present', 'absent', 'on_duty', 'weekly_off', 'paid_leave', 'unpaid_leave',
      'half_day', 'late', 'not_scheduled'],
    default: 'not_scheduled'
  },
  reportingTime: { type: String },
  actualCheckIn: { type: Date },
  actualCheckOut: { type: Date },
  workingHours: { type: Number },
  dutyBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  lateDurationMinutes: { type: Number },
  source: { type: String, enum: ['duty_based', 'manual'], default: 'manual' },
  markedBy: {
    userId: { type: String },
    role: { type: String }
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});
// One attendance record per driver per day — duty-based marking upserts
// into this instead of creating duplicates when multiple trips start on
// the same day for the same driver.
DriverAttendanceSchema.index({ tenantId: 1, driverId: 1, date: 1 }, { unique: true });

// Customer Database — Phase 1 of the CRM module. Deliberately scoped to
// what repeat-customer tracking and a working Customer Dashboard need
// right now; reward ledgers, campaigns, tags, and after-sales tasks are
// separate collections added in later phases, not bolted onto this one.
export interface ICustomer extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerCode?: string;
  name: string;
  // Canonical normalizeIndianPhone() form ("919876543210") — the actual
  // de-duplication key. alternateMobile/whatsappNumber are stored in the
  // same normalized form so a duplicate check can compare any of the
  // three against any of the three.
  primaryMobile: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  phoneAliases: string[];
  email?: string;
  emailAliases: string[];
  dateOfBirth?: Date;
  anniversary?: Date;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  companyName?: string;
  companyAliases: string[];
  customerType: 'individual' | 'family' | 'corporate' | 'travel_agent' | 'hotel_guest' | 'religious_traveller'
    | 'self_drive' | 'airport' | 'outstation' | 'vip' | 'credit' | 'other';
  gstNumber?: string;
  gstAliases: string[];
  emergencyContact?: string;
  preferredLanguage?: string;
  photoUrl?: string;
  billing?: {
    billingName?: string;
    panNumber?: string;
    billingAddress?: string;
    billingEmail?: string;
    accountsContact?: string;
    purchaseOrderRequired?: boolean;
    creditPeriodDays?: number;
    creditLimit?: number;
    invoiceRequired?: boolean;
    gstInvoiceRequired?: boolean;
    tdsInformation?: string;
    preferredInvoiceFormat?: string;
    bankPaymentInstructions?: string;
    internalBillingNotes?: string;
  };
  preferences?: {
    preferredVehicleCategory?: string;
    preferredVehicleId?: mongoose.Types.ObjectId;
    preferredDriverId?: mongoose.Types.ObjectId;
    preferredRoute?: string;
    preferredPickupLocation?: string;
    preferredPaymentMode?: string;
    acPreference?: boolean;
    luggageRequirements?: string;
    carrierRequirement?: boolean;
    seniorCitizen?: boolean;
    childTravelling?: boolean;
    wheelchairRequirement?: boolean;
    templeTourPreference?: boolean;
    airportPreference?: boolean;
    noSmoking?: boolean;
    driverBehaviourPreference?: string;
    hotelPreference?: string;
    foodStopPreference?: string;
    specialAssistance?: string;
    generalRequirements?: string;
    specialInstructions?: string;
  };
  // Cached summary — recomputed server-side from real bookings whenever a
  // booking is created/completed/cancelled for this customer (see
  // recomputeCustomerStats in services/customerService.ts). Never hand-
  // edited; the bookings themselves stay the source of truth.
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpending: number;
  firstBookingDate?: Date;
  lastBookingDate?: Date;
  preferredRoute?: string;
  preferredVehicleId?: mongoose.Types.ObjectId;
  // 'new' | 'repeat' | 'frequent' | 'high_value' | 'inactive' | 'at_risk' —
  // see classifyCustomer() for the exact rules. Frontend must never
  // hard-code this classification; it always reads this field.
  customerStatus: 'new' | 'repeat' | 'frequent' | 'high_value' | 'inactive' | 'at_risk';
  // Both cached/derived from the reward and tier services — never hand-
  // edited, same rule as totalSpending etc. above.
  rewardPointsBalance: number;
  loyaltyTier: string;
  // Optional, tenant-scoped, customer-facing code for the Referral program
  // (spec §17) — generated on demand (see referralService.ts), not for
  // every customer up front. `referralCodeActive` lets a code be disabled
  // without losing history of referrals already captured against it.
  referralCode?: string;
  referralCodeActive?: boolean;
  // Denormalized onto Customer for fast list/filter queries — the actual
  // audit trail of who added/removed each tag and when lives in
  // CustomerTagEvent, this array is just "what's currently applied".
  tags: string[];
  // Cached "current state" — CustomerConsent (below) is the append-only
  // history of every grant/revoke, same split as tags/tag-events. WhatsApp
  // and email/SMS default true (given at booking time for a real trip,
  // used for transactional messages like confirmations); promotional
  // defaults false — marketing contact requires an explicit opt-in, not
  // an assumed one.
  consent: {
    whatsapp: boolean;
    promotional: boolean;
    email: boolean;
    sms: boolean;
  };
  consentSource?: string;
  consentDate?: Date;
  optOutDate?: Date;
  doNotContactReason?: string;
  status: 'active' | 'inactive' | 'blacklisted' | 'do_not_contact';
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  isDeleted?: boolean;
  mergedIntoCustomerId?: mongoose.Types.ObjectId;
  mergedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerCode: {
    type: String,
    default: () => `CUS-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
  },
  name: { type: String, required: true },
  primaryMobile: { type: String, required: true },
  alternateMobile: { type: String },
  whatsappNumber: { type: String },
  phoneAliases: { type: [String], default: [] },
  email: { type: String },
  emailAliases: { type: [String], default: [] },
  dateOfBirth: { type: Date },
  anniversary: { type: Date },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pinCode: { type: String },
  companyName: { type: String },
  companyAliases: { type: [String], default: [] },
  customerType: {
    type: String,
    enum: ['individual', 'family', 'corporate', 'travel_agent', 'hotel_guest', 'religious_traveller',
      'self_drive', 'airport', 'outstation', 'vip', 'credit', 'other'],
    default: 'individual',
  },
  gstNumber: { type: String },
  gstAliases: { type: [String], default: [] },
  emergencyContact: { type: String },
  preferredLanguage: { type: String },
  photoUrl: { type: String },
  billing: {
    billingName: { type: String },
    panNumber: { type: String },
    billingAddress: { type: String },
    billingEmail: { type: String },
    accountsContact: { type: String },
    purchaseOrderRequired: { type: Boolean, default: false },
    creditPeriodDays: { type: Number, min: 0 },
    creditLimit: { type: Number, min: 0 },
    invoiceRequired: { type: Boolean, default: false },
    gstInvoiceRequired: { type: Boolean, default: false },
    tdsInformation: { type: String },
    preferredInvoiceFormat: { type: String },
    bankPaymentInstructions: { type: String },
    internalBillingNotes: { type: String },
  },
  preferences: {
    preferredVehicleCategory: { type: String },
    preferredVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    preferredDriverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    preferredRoute: { type: String },
    preferredPickupLocation: { type: String },
    preferredPaymentMode: { type: String },
    acPreference: { type: Boolean },
    luggageRequirements: { type: String },
    carrierRequirement: { type: Boolean },
    seniorCitizen: { type: Boolean },
    childTravelling: { type: Boolean },
    wheelchairRequirement: { type: Boolean },
    templeTourPreference: { type: Boolean },
    airportPreference: { type: Boolean },
    noSmoking: { type: Boolean },
    driverBehaviourPreference: { type: String },
    hotelPreference: { type: String },
    foodStopPreference: { type: String },
    specialAssistance: { type: String },
    generalRequirements: { type: String },
    specialInstructions: { type: String },
  },
  totalBookings: { type: Number, default: 0 },
  completedBookings: { type: Number, default: 0 },
  cancelledBookings: { type: Number, default: 0 },
  totalSpending: { type: Number, default: 0 },
  firstBookingDate: { type: Date },
  lastBookingDate: { type: Date },
  preferredRoute: { type: String },
  preferredVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  customerStatus: {
    type: String,
    enum: ['new', 'repeat', 'frequent', 'high_value', 'inactive', 'at_risk'],
    default: 'new',
  },
  rewardPointsBalance: { type: Number, default: 0 },
  referralCode: { type: String },
  referralCodeActive: { type: Boolean, default: true },
  loyaltyTier: { type: String, default: 'Regular' },
  tags: { type: [String], default: [] },
  consent: {
    whatsapp: { type: Boolean, default: true },
    promotional: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
  },
  consentSource: { type: String, default: 'booking_form' },
  consentDate: { type: Date, default: Date.now },
  optOutDate: { type: Date },
  doNotContactReason: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'blacklisted', 'do_not_contact'], default: 'active' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  isDeleted: { type: Boolean, default: false },
  mergedIntoCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  mergedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
CustomerSchema.index({ tenantId: 1, primaryMobile: 1 });
CustomerSchema.index({ tenantId: 1, phoneAliases: 1 });
CustomerSchema.index({ tenantId: 1, email: 1 });
CustomerSchema.index({ tenantId: 1, emailAliases: 1 });
CustomerSchema.index({ tenantId: 1, gstNumber: 1 });
CustomerSchema.index({ tenantId: 1, gstAliases: 1 });
CustomerSchema.index({ tenantId: 1, customerCode: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ tenantId: 1, customerStatus: 1 });
CustomerSchema.index(
  { tenantId: 1, referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: 'string' } } }
);
// TASK-03 (performance QA) — backs GET /api/customers' default
// find({tenantId, isDeleted}).sort({lastBookingDate:-1, createdAt:-1}) so
// Mongo can satisfy the sort from the index instead of a blocking
// in-memory SORT stage. See .claude/tasks/reports/TASK-03-report.md.
CustomerSchema.index({ tenantId: 1, isDeleted: 1, lastBookingDate: -1, createdAt: -1 });
CustomerSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

// Reward rules — tenant-configurable, not hard-coded (spec explicitly
// requires this). A tenant with no RewardRule document yet gets sensible
// defaults from services/rewardService.ts (1 point per ₹100) rather than
// being blocked from earning points until someone visits a settings page.
export interface IRewardRule extends Document {
  tenantId: mongoose.Types.ObjectId;
  earningRatePerAmount: number; // points earned...
  earningRateBaseAmount: number; // ...per this many ₹ spent
  minQualifyingAmount: number;
  maxPointsPerBooking?: number;
  expiryDays?: number; // undefined = points never expire
  redemptionValuePerPoint: number; // ₹ value of 1 point at redemption
  minPointsToRedeem: number;
  maxRedemptionPercentOfBooking?: number;
  repeatBookingBonusPoints?: number;
  repeatBookingBonusThreshold?: number; // completed-booking count that triggers the bonus
  referralBonusPoints?: number;
  reviewBonusPoints?: number;
  eligibleBookingStatuses: string[];
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const RewardRuleSchema = new Schema<IRewardRule>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  earningRatePerAmount: { type: Number, default: 1 },
  earningRateBaseAmount: { type: Number, default: 100 },
  minQualifyingAmount: { type: Number, default: 0 },
  maxPointsPerBooking: { type: Number },
  expiryDays: { type: Number },
  redemptionValuePerPoint: { type: Number, default: 1 },
  minPointsToRedeem: { type: Number, default: 100 },
  maxRedemptionPercentOfBooking: { type: Number, default: 50 },
  repeatBookingBonusPoints: { type: Number, default: 100 },
  repeatBookingBonusThreshold: { type: Number, default: 5 },
  referralBonusPoints: { type: Number, default: 50 },
  reviewBonusPoints: { type: Number, default: 25 },
  eligibleBookingStatuses: { type: [String], default: ['completed', 'closed'] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Reward ledger — balances are ALWAYS derived by summing these, never a
// single editable number on Customer (same rule as the payment ledger).
// `points` is signed: positive for credits, negative for debits
// (redemption/expiry/manual_debit/reversal), so balance-after is a
// running sum with no separate credit/debit bookkeeping needed.
export interface IRewardTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  transactionType: 'booking_reward' | 'repeat_booking_bonus' | 'referral_bonus' | 'review_bonus'
    | 'campaign_reward' | 'redemption' | 'expiry' | 'manual_credit' | 'manual_debit' | 'reversal';
  points: number;
  balanceAfter: number;
  reason?: string;
  expiryDate?: Date;
  // Set only for transaction types that must never double-fire for the
  // same booking (booking_reward, repeat_booking_bonus, redemption) — a
  // unique partial index on this is the actual duplicate-prevention
  // mechanism, not application-level "check then insert" logic.
  idempotencyKey?: string;
  reversalOf?: mongoose.Types.ObjectId;
  // Optional, finer-grained than transactionType — e.g. distinguishes
  // 'referral.registered' from 'referral.booking_completed', both of
  // which use transactionType 'referral_bonus'. Unset on rows created
  // before this field existed; per-event limit checks and reporting
  // treat a missing value as "unknown event", never as a false match.
  sourceEvent?: string;
  referralId?: mongoose.Types.ObjectId;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}

const RewardTransactionSchema = new Schema<IRewardTransaction>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  transactionType: {
    type: String,
    enum: ['booking_reward', 'repeat_booking_bonus', 'referral_bonus', 'review_bonus',
      'campaign_reward', 'redemption', 'expiry', 'manual_credit', 'manual_debit', 'reversal'],
    required: true,
  },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  reason: { type: String },
  expiryDate: { type: Date },
  idempotencyKey: { type: String },
  reversalOf: { type: Schema.Types.ObjectId, ref: 'RewardTransaction' },
  sourceEvent: { type: String },
  referralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
RewardTransactionSchema.index({ tenantId: 1, customerId: 1 });
RewardTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

// Loyalty tiers — tenant-configurable; a tenant with none configured
// falls back to a single implicit "Regular" tier (services/rewardService.ts).
export interface ILoyaltyTier extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  rank: number; // higher = better; used to pick the best tier a customer qualifies for
  minTotalBookings?: number;
  minLifetimeSpending?: number;
  minRewardPoints?: number;
  discountPercent?: number;
  benefits?: string[];
  createdBy: { userId: string; role: string };
  createdAt: Date;
}

const LoyaltyTierSchema = new Schema<ILoyaltyTier>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  rank: { type: Number, required: true },
  minTotalBookings: { type: Number },
  minLifetimeSpending: { type: Number },
  minRewardPoints: { type: Number },
  discountPercent: { type: Number },
  benefits: { type: [String], default: [] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
LoyaltyTierSchema.index({ tenantId: 1, rank: 1 });

// ---------------------------------------------------------------------
// Configurable Reward Event Rules (Referral / Review) — Booking-First UI
// + Referral/Rewards initiative, docs/REWARDS_REFERRAL_CURRENT_AUDIT.md.
// Deliberately separate from RewardRule above rather than a schema
// migration of it: RewardRule is one flat, heavily-tested document per
// tenant covering booking-completion earning rate + linear redemption
// terms; this covers the new, genuinely multi-rule, per-event-key surface
// the spec asks for (independent award timing, limits, validity window,
// enable/disable) without touching that already-working path. One rule
// per (tenantId, eventKey) — named-multiple-rules-per-event was in the
// spec's suggested shape but not something any of this project's actual
// events need yet; kept to what's real rather than speculative.
// ---------------------------------------------------------------------
export type RewardEventKey =
  | 'referral.registered' | 'referral.booking_confirmed' | 'referral.booking_completed' | 'review.verified';

export interface IRewardEventRule extends Document {
  tenantId: mongoose.Types.ObjectId;
  eventKey: RewardEventKey;
  name: string;
  points: number; // fractional allowed, e.g. 0.5 — see rewardService.createTransaction's rounding
  awardTiming: 'immediate' | 'after_booking_completed';
  maximumPerCustomer?: number; // lifetime cap on how many times this event can pay out for one customer
  maximumPerMonth?: number; // tenant-wide cap for this event per calendar month
  validFrom?: Date;
  validUntil?: Date;
  enabled: boolean;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const RewardEventRuleSchema = new Schema<IRewardEventRule>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  eventKey: {
    type: String,
    enum: ['referral.registered', 'referral.booking_confirmed', 'referral.booking_completed', 'review.verified'],
    required: true,
  },
  name: { type: String, required: true },
  points: { type: Number, required: true, default: 0.5 },
  awardTiming: { type: String, enum: ['immediate', 'after_booking_completed'], default: 'immediate' },
  maximumPerCustomer: { type: Number },
  maximumPerMonth: { type: Number },
  validFrom: { type: Date },
  validUntil: { type: Date },
  enabled: { type: Boolean, default: true },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
RewardEventRuleSchema.index({ tenantId: 1, eventKey: 1 }, { unique: true });
RewardEventRuleSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const RewardEventRule = mongoose.model<IRewardEventRule>('RewardEventRule', RewardEventRuleSchema);

// Referral — the one real structural gap the audit found: "referral" had
// previously only existed as a free-text source-category tag (Booking
// Source / Inquiry Source dropdowns, left completely untouched by this),
// never a tracked, rewardable relationship between two real Customer
// records. referredCustomerId is optional because a referral can be
// captured as early as Inquiry stage, before a Customer record exists
// yet — referredInquiryId/referredLeadId carry it until one does.
export type ReferralStatus =
  | 'captured' | 'booking_confirmed' | 'booking_completed'
  | 'invalid' | 'duplicate' | 'self_referral' | 'cancelled' | 'reversed' | 'fraud_review';

export interface IReferral extends Document {
  tenantId: mongoose.Types.ObjectId;
  referrerCustomerId: mongoose.Types.ObjectId;
  // Preserved at capture time so referral history still reads sensibly
  // even if the referrer's own name/mobile later changes or the record
  // is merged — same "display snapshot" pattern used for quotations.
  referrerDisplaySnapshot: { name: string; mobile: string };
  referredCustomerId?: mongoose.Types.ObjectId;
  referredInquiryId?: mongoose.Types.ObjectId;
  referredLeadId?: mongoose.Types.ObjectId;
  referredBookingId?: mongoose.Types.ObjectId;
  referralCodeUsed?: string;
  source: 'existing_customer_search' | 'referral_code' | 'external' | 'hotel_agent_vendor';
  status: ReferralStatus;
  statusHistory: { status: ReferralStatus; at: Date; actorId?: string }[];
  // Which reward events have actually paid out for this referral —
  // independent booleans, not mutually exclusive with `status`, because
  // spec §19's fractional example awards registered + booking_completed +
  // review.verified as three separate events on the SAME referral, not
  // as sequential exclusive states.
  rewardsIssued: { registered?: boolean; bookingCompleted?: boolean };
  rewardTransactionIds: mongoose.Types.ObjectId[];
  notes?: string;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  referrerCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  referrerDisplaySnapshot: {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
  },
  referredCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  referredInquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
  referredLeadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  referredBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  referralCodeUsed: { type: String },
  source: {
    type: String,
    enum: ['existing_customer_search', 'referral_code', 'external', 'hotel_agent_vendor'],
    required: true,
  },
  status: {
    type: String,
    enum: ['captured', 'booking_confirmed', 'booking_completed', 'invalid', 'duplicate', 'self_referral', 'cancelled', 'reversed', 'fraud_review'],
    default: 'captured',
  },
  statusHistory: [{
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: String },
  }],
  rewardsIssued: {
    registered: { type: Boolean, default: false },
    bookingCompleted: { type: Boolean, default: false },
  },
  rewardTransactionIds: [{ type: Schema.Types.ObjectId, ref: 'RewardTransaction' }],
  notes: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
ReferralSchema.index({ tenantId: 1, referrerCustomerId: 1 });
// One active (non-invalid/duplicate/self-referral) referral per referred
// customer — a second capture attempt for the same already-referred
// customer is flagged `duplicate` by referralService rather than
// inserted as a second live row, so this partial-unique index is a real
// duplicate-protection mechanism, not just an advisory lookup (same
// pattern as VendorDriver's normalizedMobile index).
ReferralSchema.index(
  { tenantId: 1, referredCustomerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referredCustomerId: { $type: 'objectId' },
      status: { $nin: ['invalid', 'duplicate', 'self_referral', 'cancelled', 'reversed'] },
    },
  }
);
ReferralSchema.index({ tenantId: 1, referredBookingId: 1 });
ReferralSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);

// Create indexes for better performance
UserSchema.index({ sessionId: 1 });
VehicleSchema.index({ tenantId: 1, status: 1 });
DriverSchema.index({ tenantId: 1, status: 1 });
BookingSchema.index({ tenantId: 1, status: 1 });
BookingSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
// Backs findDriverConflicts / findVehicleConflicts (services/availability.ts)
// — every driver- and vehicle-assignment mutation runs one of these
// queries, so an unindexed scan here would get slower as booking volume
// grows exactly where it matters most (assignment time).
BookingSchema.index({ tenantId: 1, driverId: 1, status: 1, scheduledStartDateTime: 1, scheduledEndDateTime: 1 });
BookingSchema.index({ tenantId: 1, vehicleId: 1, status: 1, scheduledStartDateTime: 1, scheduledEndDateTime: 1 });
// TASK-03 (performance QA) — backs getBookingsByTenant/getBookingsByTenantPaginated's
// sort, and getUpcomingBookings' {tenantId,status,pickupDate} filter+sort (previously
// only {tenantId,status} was indexed, forcing an in-memory sort on pickupDate). See
// .claude/tasks/reports/TASK-03-report.md.
BookingSchema.index({ tenantId: 1, createdAt: -1 });
BookingSchema.index({ tenantId: 1, status: 1, pickupDate: 1 });
ExpenseSchema.index({ tenantId: 1, date: 1 });
ExpenseSchema.index({ tenantId: 1, vehicleId: 1 });
// Backs the Trip Cost Summary's per-booking expense lookup.
ExpenseSchema.index({ tenantId: 1, bookingId: 1 });

// Export models
export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
export const RewardRule = mongoose.model<IRewardRule>('RewardRule', RewardRuleSchema);
export const RewardTransaction = mongoose.model<IRewardTransaction>('RewardTransaction', RewardTransactionSchema);
export const LoyaltyTier = mongoose.model<ILoyaltyTier>('LoyaltyTier', LoyaltyTierSchema);

// Tag history — who added/removed each tag and when. Customer.tags (the
// array) is the fast-read "current state"; this is the append-only audit
// trail behind it, same split as the reward/payment ledgers vs their
// cached summary fields.
export interface ICustomerTagEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  tag: string;
  action: 'added' | 'removed';
  actor: { userId: string; role: string };
  createdAt: Date;
}
const CustomerTagEventSchema = new Schema<ICustomerTagEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  tag: { type: String, required: true },
  action: { type: String, enum: ['added', 'removed'], required: true },
  actor: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
CustomerTagEventSchema.index({ tenantId: 1, customerId: 1 });
export const CustomerTagEvent = mongoose.model<ICustomerTagEvent>('CustomerTagEvent', CustomerTagEventSchema);

// Feedback — driver/vehicle/service ratings plus free-text, tied to the
// specific booking they're about. A customer can leave feedback more
// than once (different bookings), so this is a collection, not a single
// field on Customer.
export interface ICustomerFeedback extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  type: 'feedback' | 'appreciation';
  overallRating?: number;
  driverRating?: number; // 1-5
  vehicleRating?: number;
  serviceRating?: number;
  vehicleCleanlinessRating?: number;
  vehicleComfortRating?: number;
  vehicleAcRating?: number;
  vehicleConditionRating?: number;
  vehicleIssueReported?: boolean;
  breakdownOccurred?: boolean;
  vehicleIssueDescription?: string;
  bookingProcessRating?: number;
  officeCommunicationRating?: number;
  tripSatisfactionRating?: number;
  valueForMoneyRating?: number;
  driverPunctualityRating?: number;
  driverBehaviourRating?: number;
  driverSafetyRating?: number;
  driverRouteKnowledgeRating?: number;
  driverCommunicationRating?: number;
  driverAssistanceRating?: number;
  driverPaymentHandlingRating?: number;
  wouldBookAgain?: boolean;
  wouldRecommend?: boolean;
  responsibleParty?: 'company' | 'driver' | 'vehicle' | 'vendor' | 'customer' | 'unclear';
  comments?: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}
const CustomerFeedbackSchema = new Schema<ICustomerFeedback>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  type: { type: String, enum: ['feedback', 'appreciation'], default: 'feedback' },
  overallRating: { type: Number, min: 1, max: 5 },
  driverRating: { type: Number, min: 1, max: 5 },
  vehicleRating: { type: Number, min: 1, max: 5 },
  serviceRating: { type: Number, min: 1, max: 5 },
  vehicleCleanlinessRating: { type: Number, min: 1, max: 5 },
  vehicleComfortRating: { type: Number, min: 1, max: 5 },
  vehicleAcRating: { type: Number, min: 1, max: 5 },
  vehicleConditionRating: { type: Number, min: 1, max: 5 },
  vehicleIssueReported: { type: Boolean },
  breakdownOccurred: { type: Boolean },
  vehicleIssueDescription: { type: String },
  bookingProcessRating: { type: Number, min: 1, max: 5 },
  officeCommunicationRating: { type: Number, min: 1, max: 5 },
  tripSatisfactionRating: { type: Number, min: 1, max: 5 },
  valueForMoneyRating: { type: Number, min: 1, max: 5 },
  driverPunctualityRating: { type: Number, min: 1, max: 5 },
  driverBehaviourRating: { type: Number, min: 1, max: 5 },
  driverSafetyRating: { type: Number, min: 1, max: 5 },
  driverRouteKnowledgeRating: { type: Number, min: 1, max: 5 },
  driverCommunicationRating: { type: Number, min: 1, max: 5 },
  driverAssistanceRating: { type: Number, min: 1, max: 5 },
  driverPaymentHandlingRating: { type: Number, min: 1, max: 5 },
  wouldBookAgain: { type: Boolean },
  wouldRecommend: { type: Boolean },
  responsibleParty: { type: String, enum: ['company', 'driver', 'vehicle', 'vendor', 'customer', 'unclear'] },
  comments: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
CustomerFeedbackSchema.index({ tenantId: 1, customerId: 1 });
CustomerFeedbackSchema.index({ tenantId: 1, driverId: 1, createdAt: -1 });
CustomerFeedbackSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });
export const CustomerFeedback = mongoose.model<ICustomerFeedback>('CustomerFeedback', CustomerFeedbackSchema);

// Complaints and service recovery. Compensation (refund/reward points) is
// never a bare field here — resolving with compensation creates a real
// PaymentTransaction or RewardTransaction (see routes.ts), and this
// document just records WHICH transaction that was, for traceability.
export interface ICustomerComplaint extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  category: 'driver_late' | 'driver_behaviour' | 'rash_driving' | 'vehicle_problem' | 'vehicle_cleanliness' | 'vehicle_breakdown'
    | 'ac_problem' | 'wrong_vehicle' | 'booking_issue' | 'payment_dispute' | 'office_communication'
    | 'vendor_issue' | 'self_drive_issue' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  responsibleParty?: 'company' | 'driver' | 'vehicle' | 'vendor' | 'customer' | 'unclear';
  responsibilityReason?: string;
  responsibilityVerifiedBy?: { userId: string; role: string };
  responsibilityVerifiedAt?: Date;
  assignedTo?: string;
  resolutionDeadline?: Date;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  correctiveAction?: 'apology' | 'refund' | 'partial_refund' | 'discount_coupon' | 'reward_points' | 'free_upgrade' | 'manager_callback' | 'none';
  compensationAmount?: number; // ₹, for refund/partial_refund
  compensationPoints?: number; // for reward_points
  refundTransactionId?: mongoose.Types.ObjectId;
  rewardTransactionId?: mongoose.Types.ObjectId;
  resolution?: string;
  satisfactionAfterResolution?: 'satisfied' | 'neutral' | 'dissatisfied';
  createdBy: { userId: string; role: string };
  resolvedAt?: Date;
  createdAt: Date;
}
const CustomerComplaintSchema = new Schema<ICustomerComplaint>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  category: {
    type: String,
    enum: ['driver_late', 'driver_behaviour', 'rash_driving', 'vehicle_problem', 'vehicle_cleanliness', 'vehicle_breakdown',
      'ac_problem', 'wrong_vehicle', 'booking_issue', 'payment_dispute', 'office_communication',
      'vendor_issue', 'self_drive_issue', 'other'],
    required: true,
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  description: { type: String, required: true },
  responsibleParty: { type: String, enum: ['company', 'driver', 'vehicle', 'vendor', 'customer', 'unclear'] },
  responsibilityReason: { type: String },
  responsibilityVerifiedBy: { userId: { type: String }, role: { type: String } },
  responsibilityVerifiedAt: { type: Date },
  assignedTo: { type: String },
  resolutionDeadline: { type: Date },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  correctiveAction: { type: String, enum: ['apology', 'refund', 'partial_refund', 'discount_coupon', 'reward_points', 'free_upgrade', 'manager_callback', 'none'] },
  compensationAmount: { type: Number },
  compensationPoints: { type: Number },
  refundTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction' },
  rewardTransactionId: { type: Schema.Types.ObjectId, ref: 'RewardTransaction' },
  resolution: { type: String },
  satisfactionAfterResolution: { type: String, enum: ['satisfied', 'neutral', 'dissatisfied'] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
CustomerComplaintSchema.index({ tenantId: 1, customerId: 1, status: 1 });
CustomerComplaintSchema.index({ tenantId: 1, driverId: 1, status: 1 });
CustomerComplaintSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });
export const CustomerComplaint = mongoose.model<ICustomerComplaint>('CustomerComplaint', CustomerComplaintSchema);

// After-sales follow-up tasks — auto-created on booking completion
// (see routes.ts's status-change handler) with a sensible default task
// set, plus manually addable ones (raise a complaint's follow-up, a
// birthday offer reminder, etc).
export interface ICustomerFollowUp extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  taskType: string;
  assignedTo?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'contacted' | 'follow_up_required' | 'resolved' | 'closed' | 'no_response' | 'do_not_contact';
  notes?: string;
  communicationResult?: string;
  nextFollowUp?: Date;
  resolution?: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}
const CustomerFollowUpSchema = new Schema<ICustomerFollowUp>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  taskType: { type: String, required: true },
  assignedTo: { type: String },
  dueDate: { type: Date, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'follow_up_required', 'resolved', 'closed', 'no_response', 'do_not_contact'],
    default: 'pending',
  },
  notes: { type: String },
  communicationResult: { type: String },
  nextFollowUp: { type: Date },
  resolution: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
CustomerFollowUpSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
export const CustomerFollowUp = mongoose.model<ICustomerFollowUp>('CustomerFollowUp', CustomerFollowUpSchema);

// Google review tracking is an auditable linked record, not a loose flag
// on Customer. A customer may be asked after more than one completed trip,
// while every request/confirmation keeps its original Booking context.
export interface IGoogleReviewTracking extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  reviewPageUrl?: string;
  reviewRequested: boolean;
  requestDate?: Date;
  requestSentThrough?: 'whatsapp' | 'email' | 'sms' | 'phone' | 'in_person' | 'other';
  requestMessageId?: mongoose.Types.ObjectId;
  requestHistory: {
    sentAt: Date;
    channel: 'whatsapp' | 'email' | 'sms' | 'phone' | 'in_person' | 'other';
    messageId?: mongoose.Types.ObjectId;
    requestId?: string;
    sentBy: { userId: string; role: string };
  }[];
  reviewReceived: boolean;
  reviewDate?: Date;
  reviewRating?: number;
  reviewLink?: string;
  reviewReference?: string;
  rewardTransactionId?: mongoose.Types.ObjectId;
  followUpRequired: boolean;
  responseStatus: 'not_required' | 'pending' | 'responded';
  respondedAt?: Date;
  respondedBy?: { userId: string; role: string };
  notes?: string;
  reviewConfirmedBy?: { userId: string; role: string };
  reviewConfirmedAt?: Date;
  lastUpdatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const GoogleReviewTrackingSchema = new Schema<IGoogleReviewTracking>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  reviewPageUrl: { type: String },
  reviewRequested: { type: Boolean, default: false },
  requestDate: { type: Date },
  requestSentThrough: { type: String, enum: ['whatsapp', 'email', 'sms', 'phone', 'in_person', 'other'] },
  requestMessageId: { type: Schema.Types.ObjectId, ref: 'WhatsAppMessage' },
  requestHistory: [{
    sentAt: { type: Date, required: true },
    channel: { type: String, enum: ['whatsapp', 'email', 'sms', 'phone', 'in_person', 'other'], required: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'WhatsAppMessage' },
    requestId: { type: String },
    sentBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  }],
  reviewReceived: { type: Boolean, default: false },
  reviewDate: { type: Date },
  reviewRating: { type: Number, min: 1, max: 5 },
  reviewLink: { type: String },
  reviewReference: { type: String },
  rewardTransactionId: { type: Schema.Types.ObjectId, ref: 'RewardTransaction' },
  followUpRequired: { type: Boolean, default: false },
  responseStatus: { type: String, enum: ['not_required', 'pending', 'responded'], default: 'not_required' },
  respondedAt: { type: Date },
  respondedBy: { userId: { type: String }, role: { type: String } },
  notes: { type: String },
  reviewConfirmedBy: { userId: { type: String }, role: { type: String } },
  reviewConfirmedAt: { type: Date },
  lastUpdatedBy: { userId: { type: String }, role: { type: String } },
}, { timestamps: true });
GoogleReviewTrackingSchema.index({ tenantId: 1, customerId: 1, requestDate: -1 });
GoogleReviewTrackingSchema.index(
  { tenantId: 1, customerId: 1, bookingId: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } } },
);
GoogleReviewTrackingSchema.index({ tenantId: 1, reviewReceived: 1, followUpRequired: 1 });
export const GoogleReviewTracking = mongoose.model<IGoogleReviewTracking>('GoogleReviewTracking', GoogleReviewTrackingSchema);

// Append-only requirement snapshots. A new trip or changed request creates
// a new row instead of mutating an earlier booking's agreed requirements.
export interface ICustomerRequirement extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  tripRequirement?: string;
  pickupRequirements?: string;
  dropRequirements?: string;
  route?: string;
  multipleStops: string[];
  numberOfPassengers?: number;
  luggage?: string;
  hotelDetails?: string;
  trainFlightDetails?: string;
  seniorCitizenRequirement?: boolean;
  childRequirement?: boolean;
  wheelchair?: boolean;
  templeTiming?: string;
  darshanTiming?: string;
  vehicleCategory?: string;
  driverPreference?: string;
  languagePreference?: string;
  acRequirement?: boolean;
  paymentArrangement?: string;
  tollParkingAgreement?: string;
  includedServices: string[];
  excludedServices: string[];
  customerVisibleInstructions?: string;
  driverInstructions?: string;
  officeOnlyNotes?: string;
  billingInstructions?: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}

const CustomerRequirementSchema = new Schema<ICustomerRequirement>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  tripRequirement: { type: String },
  pickupRequirements: { type: String },
  dropRequirements: { type: String },
  route: { type: String },
  multipleStops: { type: [String], default: [] },
  numberOfPassengers: { type: Number, min: 1 },
  luggage: { type: String },
  hotelDetails: { type: String },
  trainFlightDetails: { type: String },
  seniorCitizenRequirement: { type: Boolean, default: false },
  childRequirement: { type: Boolean, default: false },
  wheelchair: { type: Boolean, default: false },
  templeTiming: { type: String },
  darshanTiming: { type: String },
  vehicleCategory: { type: String },
  driverPreference: { type: String },
  languagePreference: { type: String },
  acRequirement: { type: Boolean, default: false },
  paymentArrangement: { type: String },
  tollParkingAgreement: { type: String },
  includedServices: { type: [String], default: [] },
  excludedServices: { type: [String], default: [] },
  customerVisibleInstructions: { type: String },
  driverInstructions: { type: String },
  officeOnlyNotes: { type: String },
  billingInstructions: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
CustomerRequirementSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
CustomerRequirementSchema.index({ tenantId: 1, bookingId: 1 });
export const CustomerRequirement = mongoose.model<ICustomerRequirement>('CustomerRequirement', CustomerRequirementSchema);

// Inquiry — a real Customer/Sales pipeline entity distinct from Booking's
// early 'enquiry'/'quotation_sent' statuses (see docs/INQUIRY_LEAD_STATUS_MAPPING.md).
// Exists specifically so a phone call that may never become a trip doesn't
// force premature creation of a real Booking (which requires a vehicleId).
// Reuses CustomerRequirement's field vocabulary for requirement-capture
// fields (see docs/INQUIRY_BOOKING_FIELD_INVENTORY.md) rather than
// inventing a parallel shape.
export type InquiryStatus =
  | 'new' | 'unverified' | 'contact_attempted' | 'contacted'
  | 'requirement_pending' | 'requirement_completed' | 'qualified'
  | 'converted_to_lead' | 'future_follow_up' | 'duplicate' | 'invalid'
  | 'lost' | 'cancelled';

const INQUIRY_SOURCE_VALUES = [
  'direct_customer', 'walk_in', 'phone_call', 'whatsapp', 'website', 'google_business_profile',
  'google_ads', 'facebook', 'instagram', 'hotel', 'corporate_client', 'travel_agent', 'vendor_partner',
  'referral', 'online_travel_platform', 'repeat_customer', 'other',
] as const;

const INQUIRY_TRIP_TYPE_VALUES = [
  'local', 'airport_transfer', 'railway_transfer', 'one_way', 'round_trip', 'outstation',
  'multi_city', 'religious_tour', 'corporate_duty', 'wedding_event', 'group_tour',
  'self_drive', 'monthly_contract', 'employee_transport', 'custom',
] as const;

interface IInquiryVehicleRequirement {
  vehicleCategoryId?: mongoose.Types.ObjectId;
  requestedNameSnapshot: string;
  quantity: number;
  seatingCapacity?: number;
  luggageCapacity?: number;
  preferredModel?: string;
  serviceType: 'with_driver' | 'self_drive';
  alternativeAllowed: boolean;
  notes?: string;
}

interface IInquiryCustomVehicleRequest {
  customVehicleName: string;
  brand?: string;
  model?: string;
  vehicleType?: string;
  seatingCapacity?: number;
  luggageCapacity?: number;
  acNonAc?: string;
  transmission?: string;
  fuelType?: string;
  luxuryLevel?: string;
  quantity: number;
  customerDescription?: string;
  expectedBudget?: number;
  alternativeAllowed: boolean;
  notes?: string;
}

export interface IInquiry extends Document {
  tenantId: mongoose.Types.ObjectId;
  inquiryNumber: string;
  status: InquiryStatus;
  priority: 'low' | 'medium' | 'high';

  // Source attribution — deliberately separate from Booking.bookingSource
  // (spec: "Original Inquiry Source" must never be conflated with later
  // "Lead Conversion Source" / "Booking Source" / "Fulfilment Source").
  source: typeof INQUIRY_SOURCE_VALUES[number];
  sourceDetail?: string;
  campaign?: string;
  referrer?: string;

  assignedExecutive?: string;
  nextFollowUpAt?: Date;

  // Contact capture — an Inquiry may exist with no linked Customer at all.
  customerName: string;
  primaryMobile: string;
  whatsappNumber?: string;
  alternateMobile?: string;
  email?: string;
  linkedCustomerId?: mongoose.Types.ObjectId;

  tripType?: typeof INQUIRY_TRIP_TYPE_VALUES[number];
  pickupDate?: Date;
  pickupTime?: string;
  returnDate?: Date;
  returnTime?: string;
  flexibleDate?: boolean;

  pickupLocation?: string;
  dropLocation?: string;
  viaLocations?: string;
  placesToVisit?: string;

  numberOfPassengers?: number;
  seniorCitizens?: number;
  children?: number;
  infants?: number;
  luggageCount?: number;

  // Requirement-capture fields — same vocabulary as CustomerRequirement.
  route?: string;
  vehicleCategory?: string;
  driverPreference?: string;
  languagePreference?: string;
  acRequirement?: string;
  paymentArrangement?: string;
  tollParkingAgreement?: string;
  customerVisibleInstructions?: string;
  driverInstructions?: string;
  officeOnlyNotes?: string;
  billingInstructions?: string;

  vehicleRequirements?: IInquiryVehicleRequirement[];
  customVehicleRequests?: IInquiryCustomVehicleRequest[];

  notes?: string;

  convertedToLeadAt?: Date;
  linkedBookingId?: mongoose.Types.ObjectId;

  lostReason?: string;
  lostNotes?: string;
  futureReconnectDate?: Date;

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const InquiryVehicleRequirementSchema = new Schema<IInquiryVehicleRequirement>({
  vehicleCategoryId: { type: Schema.Types.ObjectId },
  requestedNameSnapshot: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  seatingCapacity: { type: Number },
  luggageCapacity: { type: Number },
  preferredModel: { type: String },
  serviceType: { type: String, enum: ['with_driver', 'self_drive'], default: 'with_driver' },
  alternativeAllowed: { type: Boolean, default: true },
  notes: { type: String },
}, { _id: true });

const InquiryCustomVehicleRequestSchema = new Schema<IInquiryCustomVehicleRequest>({
  customVehicleName: { type: String, required: true },
  brand: { type: String },
  model: { type: String },
  vehicleType: { type: String },
  seatingCapacity: { type: Number },
  luggageCapacity: { type: Number },
  acNonAc: { type: String },
  transmission: { type: String },
  fuelType: { type: String },
  luxuryLevel: { type: String },
  quantity: { type: Number, required: true, default: 1 },
  customerDescription: { type: String },
  expectedBudget: { type: Number },
  alternativeAllowed: { type: Boolean, default: true },
  notes: { type: String },
}, { _id: true });

const InquirySchema = new Schema<IInquiry>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  inquiryNumber: { type: String },
  status: {
    type: String,
    enum: ['new', 'unverified', 'contact_attempted', 'contacted', 'requirement_pending',
      'requirement_completed', 'qualified', 'converted_to_lead', 'future_follow_up',
      'duplicate', 'invalid', 'lost', 'cancelled'],
    default: 'new',
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

  source: { type: String, enum: INQUIRY_SOURCE_VALUES, default: 'phone_call' },
  sourceDetail: { type: String },
  campaign: { type: String },
  referrer: { type: String },

  assignedExecutive: { type: String },
  nextFollowUpAt: { type: Date },

  customerName: { type: String, required: true },
  primaryMobile: { type: String, required: true },
  whatsappNumber: { type: String },
  alternateMobile: { type: String },
  email: { type: String },
  linkedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },

  tripType: { type: String, enum: INQUIRY_TRIP_TYPE_VALUES },
  pickupDate: { type: Date },
  pickupTime: { type: String },
  returnDate: { type: Date },
  returnTime: { type: String },
  flexibleDate: { type: Boolean, default: false },

  pickupLocation: { type: String },
  dropLocation: { type: String },
  viaLocations: { type: String },
  placesToVisit: { type: String },

  numberOfPassengers: { type: Number },
  seniorCitizens: { type: Number },
  children: { type: Number },
  infants: { type: Number },
  luggageCount: { type: Number },

  route: { type: String },
  vehicleCategory: { type: String },
  driverPreference: { type: String },
  languagePreference: { type: String },
  acRequirement: { type: String },
  paymentArrangement: { type: String },
  tollParkingAgreement: { type: String },
  customerVisibleInstructions: { type: String },
  driverInstructions: { type: String },
  officeOnlyNotes: { type: String },
  billingInstructions: { type: String },

  vehicleRequirements: { type: [InquiryVehicleRequirementSchema], default: [] },
  customVehicleRequests: { type: [InquiryCustomVehicleRequestSchema], default: [] },

  notes: { type: String },

  convertedToLeadAt: { type: Date },
  linkedBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },

  lostReason: { type: String },
  lostNotes: { type: String },
  futureReconnectDate: { type: Date },

  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
InquirySchema.index({ tenantId: 1, status: 1, createdAt: -1 });
InquirySchema.index({ tenantId: 1, primaryMobile: 1 });
InquirySchema.index({ tenantId: 1, nextFollowUpAt: 1 });
InquirySchema.index(
  { tenantId: 1, inquiryNumber: 1 },
  { unique: true, partialFilterExpression: { inquiryNumber: { $type: 'string' } } },
);
export const Inquiry = mongoose.model<IInquiry>('Inquiry', InquirySchema);

// Lead — a thin sales-pipeline-state wrapper around exactly one qualified
// Inquiry (one-to-one, enforced by a unique index on inquiryId). Deliberately
// does NOT duplicate the Inquiry's contact/requirement fields (customer
// name, route, passengers, vehicle requirements, etc.) — those stay owned
// by the Inquiry record and are read via inquiryId so editing the
// requirement later (spec §28 "earlier steps remain editable") never
// creates two divergent copies of the same fact. Lead adds only what's
// genuinely new: pipeline status, executive assignment, and (later
// phases) quotation/customer/booking linkage.
export type LeadStatus =
  | 'new' | 'assigned' | 'requirement_completed' | 'quotation_draft'
  | 'quotation_under_review' | 'quotation_sent' | 'follow_up_due'
  | 'negotiation' | 'customer_confirmed' | 'converted_to_customer'
  | 'converted_to_booking' | 'future_requirement' | 'lost' | 'cancelled';

export interface ILead extends Document {
  tenantId: mongoose.Types.ObjectId;
  leadNumber: string;
  inquiryId: mongoose.Types.ObjectId;
  status: LeadStatus;
  priority: 'low' | 'medium' | 'high';
  assignedExecutive?: string;

  linkedCustomerId?: mongoose.Types.ObjectId;
  convertedToCustomerAt?: Date;
  linkedBookingId?: mongoose.Types.ObjectId;
  convertedToBookingAt?: Date;

  lostReason?: string;
  lostNotes?: string;

  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  leadNumber: { type: String },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true },
  status: {
    type: String,
    enum: ['new', 'assigned', 'requirement_completed', 'quotation_draft', 'quotation_under_review',
      'quotation_sent', 'follow_up_due', 'negotiation', 'customer_confirmed', 'converted_to_customer',
      'converted_to_booking', 'future_requirement', 'lost', 'cancelled'],
    default: 'new',
  },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assignedExecutive: { type: String },

  linkedCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  convertedToCustomerAt: { type: Date },
  linkedBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  convertedToBookingAt: { type: Date },

  lostReason: { type: String },
  lostNotes: { type: String },

  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
LeadSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
LeadSchema.index({ tenantId: 1, inquiryId: 1 }, { unique: true });
LeadSchema.index(
  { tenantId: 1, leadNumber: 1 },
  { unique: true, partialFilterExpression: { leadNumber: { $type: 'string' } } },
);
export const Lead = mongoose.model<ILead>('Lead', LeadSchema);

// ---------------------------------------------------------------------
// Telephony (TASK-02) — per-executive telephony identity + CallSession.
// Consolidated from server/telephony/models/telephonyIdentity.ts and
// server/telephony/models/callSession.ts (TASK-02) into the shared model
// file by the Integrator; see .claude/tasks/reports/TASK-02-report.md's
// "Proposed server/models/index.ts patch" and
// .claude/tasks/reports/INTEGRATION-report.md. server/telephony/models/*
// has been removed and every importer repointed at this file.
// ---------------------------------------------------------------------

export type TelephonyIdentityStatus = 'available' | 'busy' | 'wrap_up' | 'offline' | 'disabled';

export interface ITelephonyIdentity extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  providerKey: string;
  providerAgentId?: string;
  registeredNumber?: string;
  virtualNumber?: string;
  extension?: string;
  incomingEnabled: boolean;
  outgoingEnabled: boolean;
  status: TelephonyIdentityStatus;
  encryptedCredentials?: string;
  credentialFields: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TelephonyIdentitySchema = new Schema<ITelephonyIdentity>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true, lowercase: true, trim: true },
  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerAgentId: { type: String, trim: true, maxlength: 200 },
  registeredNumber: { type: String, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },
  extension: { type: String, trim: true, maxlength: 16 },
  incomingEnabled: { type: Boolean, default: true },
  outgoingEnabled: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'busy', 'wrap_up', 'offline', 'disabled'], default: 'offline' },
  encryptedCredentials: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
TelephonyIdentitySchema.index({ tenantId: 1, userId: 1 }, { unique: true });
export const TelephonyIdentity = mongoose.model<ITelephonyIdentity>('TelephonyIdentity', TelephonyIdentitySchema);

export type TelephonyCallDirection = 'outbound' | 'inbound';
export type TelephonyCallStatus =
  | 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'missed' | 'no_answer' | 'cancelled';

export interface ICallNote {
  text: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}
export interface ICallReassignmentEvent {
  fromUserId: string;
  toUserId: string;
  changedBy: { userId: string; role: string };
  changedAt: Date;
  reason?: string;
}

export interface ICallSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  direction: TelephonyCallDirection;
  status: TelephonyCallStatus;
  userId: string;
  assignedUserId: string;
  fromNumber: string;
  toNumber: string;
  virtualNumber?: string;
  providerKey: string;
  providerCallId?: string;
  providerAgentId?: string;
  customerId?: mongoose.Types.ObjectId;
  inquiryId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes: ICallNote[];
  reassignmentHistory: ICallReassignmentEvent[];
  createdBy: { userId: string; role: string };
  updatedBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const CallNoteSchema = new Schema<ICallNote>({
  text: { type: String, required: true, maxlength: 5000 },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CallReassignmentEventSchema = new Schema<ICallReassignmentEvent>({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  changedBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String, maxlength: 500 },
}, { _id: false });

const CallSessionSchema = new Schema<ICallSession>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  direction: { type: String, enum: ['outbound', 'inbound'], required: true },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled'],
    default: 'initiated',
  },
  userId: { type: String, required: true, lowercase: true, trim: true },
  assignedUserId: { type: String, required: true, lowercase: true, trim: true },
  fromNumber: { type: String, required: true, trim: true, maxlength: 32 },
  toNumber: { type: String, required: true, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },
  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerCallId: { type: String, trim: true, maxlength: 200 },
  providerAgentId: { type: String, trim: true, maxlength: 200 },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  durationSeconds: { type: Number, min: 0 },
  notes: { type: [CallNoteSchema], default: [] },
  reassignmentHistory: { type: [CallReassignmentEventSchema], default: [] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

CallSessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, assignedUserId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, providerCallId: 1 }, { unique: true, partialFilterExpression: { providerCallId: { $type: 'string' } } });
CallSessionSchema.index({ tenantId: 1, virtualNumber: 1 });

export const CallSession = mongoose.model<ICallSession>('CallSession', CallSessionSchema);

// Quotation — one or more priced vehicle/package options prepared against a
// Lead. Money is stored as integer paise throughout (spec §18) to avoid the
// float-drift class of bug already flagged for the older Booking/Payment
// money fields elsewhere in this codebase (see docs/SECURITY_AND_DATA_RISK_AUDIT.md).
// Options are embedded (not a separate collection) — same pattern already
// used for Booking.extensionHistory/rescheduleHistory — since they only
// ever exist in the context of their parent Quotation.
export type QuotationStatus =
  | 'draft' | 'under_review' | 'approved' | 'sent' | 'viewed' | 'customer_query'
  | 'negotiation' | 'accepted' | 'rejected' | 'expired' | 'superseded' | 'converted';

interface IQuotationOption {
  optionNumber: number;
  vehicleNameSnapshot: string;
  quantity: number;
  pricingType: 'fixed' | 'per_km' | 'per_day' | 'per_hour' | 'monthly' | 'custom';
  baseRatePaise?: number;
  includedKm?: number;
  extraKmRatePaise?: number;
  includedHours?: number;
  extraHourRatePaise?: number;
  minimumKmPerDay?: number;
  driverAllowancePaise?: number;
  nightHaltPaise?: number;
  tollTreatment?: 'included' | 'excluded' | 'actual';
  parkingTreatment?: 'included' | 'excluded' | 'actual';
  stateTaxTreatment?: 'included' | 'excluded' | 'actual';
  discountPaise?: number;
  taxableAmountPaise?: number;
  gstPaise?: number;
  totalPaise: number;
  notes?: string;
}

export interface IQuotation extends Document {
  tenantId: mongoose.Types.ObjectId;
  quotationNumber?: string;
  leadId: mongoose.Types.ObjectId;
  status: QuotationStatus;
  version: number;
  parentQuotationId?: mongoose.Types.ObjectId;
  options: IQuotationOption[];
  acceptedOptionNumber?: number;
  validTill?: Date;
  paymentTerms?: string;
  termsAndConditions?: string;
  cancellationTerms?: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  acceptedAt?: Date;
}

const QuotationOptionSchema = new Schema<IQuotationOption>({
  optionNumber: { type: Number, required: true },
  vehicleNameSnapshot: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  pricingType: { type: String, enum: ['fixed', 'per_km', 'per_day', 'per_hour', 'monthly', 'custom'], default: 'fixed' },
  baseRatePaise: { type: Number },
  includedKm: { type: Number },
  extraKmRatePaise: { type: Number },
  includedHours: { type: Number },
  extraHourRatePaise: { type: Number },
  minimumKmPerDay: { type: Number },
  driverAllowancePaise: { type: Number },
  nightHaltPaise: { type: Number },
  tollTreatment: { type: String, enum: ['included', 'excluded', 'actual'], default: 'excluded' },
  parkingTreatment: { type: String, enum: ['included', 'excluded', 'actual'], default: 'excluded' },
  stateTaxTreatment: { type: String, enum: ['included', 'excluded', 'actual'], default: 'excluded' },
  discountPaise: { type: Number, default: 0 },
  taxableAmountPaise: { type: Number },
  gstPaise: { type: Number, default: 0 },
  totalPaise: { type: Number, required: true },
  notes: { type: String },
}, { _id: false });

const QuotationSchema = new Schema<IQuotation>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  quotationNumber: { type: String },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  status: {
    type: String,
    enum: ['draft', 'under_review', 'approved', 'sent', 'viewed', 'customer_query', 'negotiation',
      'accepted', 'rejected', 'expired', 'superseded', 'converted'],
    default: 'draft',
  },
  version: { type: Number, default: 1 },
  parentQuotationId: { type: Schema.Types.ObjectId, ref: 'Quotation' },
  options: { type: [QuotationOptionSchema], default: [] },
  acceptedOptionNumber: { type: Number },
  validTill: { type: Date },
  paymentTerms: { type: String },
  termsAndConditions: { type: String },
  cancellationTerms: { type: String },
  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  sentAt: { type: Date },
  acceptedAt: { type: Date },
});
QuotationSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
QuotationSchema.index(
  { tenantId: 1, quotationNumber: 1 },
  { unique: true, partialFilterExpression: { quotationNumber: { $type: 'string' } } },
);
export const Quotation = mongoose.model<IQuotation>('Quotation', QuotationSchema);

// LeadFollowUp — structured sales-pipeline follow-up tasks against a Lead
// (spec §22). Deliberately a SEPARATE model from the existing
// CustomerFollowUp (models/index.ts, "After-sales follow-up tasks —
// auto-created on booking completion") — that one is post-trip customer
// care; this one is pre-sales lead nurturing. Conflating the two would
// mix "call this lead about their quotation" with "check if the
// completed trip went well" in one list, which is exactly the kind of
// mixed-purpose list the spec's Inquiry/Lead/Customer/Booking
// terminology section warns against.
export type LeadFollowUpOutcome =
  | 'pending' | 'connected' | 'no_answer' | 'callback_requested' | 'quotation_requested'
  | 'negotiation' | 'confirmed' | 'not_interested' | 'postponed' | 'lost';

export interface ILeadFollowUp extends Document {
  tenantId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  type: string;
  scheduledAt: Date;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high';
  purpose?: string;
  previousDiscussion?: string;
  customerResponse?: string;
  internalNote?: string;
  outcome: LeadFollowUpOutcome;
  nextFollowUpAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}

const LeadFollowUpSchema = new Schema<ILeadFollowUp>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  type: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  assignedTo: { type: String },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  purpose: { type: String },
  previousDiscussion: { type: String },
  customerResponse: { type: String },
  internalNote: { type: String },
  outcome: {
    type: String,
    enum: ['pending', 'connected', 'no_answer', 'callback_requested', 'quotation_requested',
      'negotiation', 'confirmed', 'not_interested', 'postponed', 'lost'],
    default: 'pending',
  },
  nextFollowUpAt: { type: Date },
  completedAt: { type: Date },
  completedBy: { type: String },
  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
});
LeadFollowUpSchema.index({ tenantId: 1, leadId: 1, scheduledAt: -1 });
LeadFollowUpSchema.index({ tenantId: 1, outcome: 1, scheduledAt: 1 });
export const LeadFollowUp = mongoose.model<ILeadFollowUp>('LeadFollowUp', LeadFollowUpSchema);

export interface ICustomerMerge extends Document {
  tenantId: mongoose.Types.ObjectId;
  sourceCustomerId: mongoose.Types.ObjectId;
  targetCustomerId: mongoose.Types.ObjectId;
  reason: string;
  status: 'in_progress' | 'completed' | 'failed';
  movedCounts: Record<string, number>;
  retainedSourceCampaignRecipients: number;
  error?: string;
  performedBy: { userId: string; role: string };
  startedAt: Date;
  completedAt?: Date;
}

const CustomerMergeSchema = new Schema<ICustomerMerge>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  sourceCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  targetCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['in_progress', 'completed', 'failed'], default: 'in_progress' },
  movedCounts: { type: Schema.Types.Mixed, default: {} },
  retainedSourceCampaignRecipients: { type: Number, default: 0 },
  error: { type: String },
  performedBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});
CustomerMergeSchema.index({ tenantId: 1, sourceCustomerId: 1 }, { unique: true });
CustomerMergeSchema.index({ tenantId: 1, targetCustomerId: 1, completedAt: -1 });
export const CustomerMerge = mongoose.model<ICustomerMerge>('CustomerMerge', CustomerMergeSchema);

export interface ICustomerBillingProfile extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  label: string;
  customerKind: 'individual' | 'company';
  billingName: string;
  companyName?: string;
  gstNumber?: string;
  panNumber?: string;
  billingAddress?: string;
  billingEmail?: string;
  accountsContact?: string;
  purchaseOrderNumber?: string;
  paymentTerms?: string;
  creditPeriodDays?: number;
  tdsInformation?: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const CustomerBillingProfileSchema = new Schema<ICustomerBillingProfile>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  label: { type: String, required: true },
  customerKind: { type: String, enum: ['individual', 'company'], default: 'individual' },
  billingName: { type: String, required: true },
  companyName: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  billingAddress: { type: String },
  billingEmail: { type: String },
  accountsContact: { type: String },
  purchaseOrderNumber: { type: String },
  paymentTerms: { type: String },
  creditPeriodDays: { type: Number, min: 0 },
  tdsInformation: { type: String },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
CustomerBillingProfileSchema.index({ tenantId: 1, customerId: 1, isActive: 1 });
export const CustomerBillingProfile = mongoose.model<ICustomerBillingProfile>('CustomerBillingProfile', CustomerBillingProfileSchema);

export interface IInvoice extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  billingProfileId?: mongoose.Types.ObjectId;
  // Undefined for a fresh draft — real numbering only happens at
  // finalization (see finalizeInvoice in invoiceService.ts), so a draft
  // that never gets finalized never burns a sequence number. Revisions
  // keep their existing immediate-suffix behavior (${parent}-R{n}),
  // unchanged from before this field became optional.
  invoiceNumber?: string;
  sourceKey?: string;
  documentType: 'tax_invoice' | 'non_gst_invoice' | 'proforma_invoice' | 'payment_receipt' | 'credit_note' | 'debit_note' | 'customer_statement';
  status: 'draft' | 'finalized' | 'void';
  revisionNumber: number;
  parentInvoiceId?: mongoose.Types.ObjectId;
  relatedInvoiceId?: mongoose.Types.ObjectId;
  invoiceDate: Date;
  customerSnapshot: Record<string, any>;
  billingSnapshot: Record<string, any>;
  businessSnapshot: Record<string, any>;
  bookingSnapshot?: Record<string, any>;
  serviceDescription: string;
  gstRate: number;
  discount: number;
  tollParkingTreatment: 'included' | 'separate_non_taxable';
  taxableAmount: number;
  gstAmount: number;
  tollAmount: number;
  parkingAmount: number;
  adjustmentAmount: number;
  totalAmount: number;
  amountReceived: number;
  balanceDue: number;
  paymentTerms?: string;
  bankDetails?: string;
  upiId?: string;
  termsAndConditions?: string;
  adjustmentReason?: string;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  finalizedBy?: { userId: string; role: string };
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  billingProfileId: { type: Schema.Types.ObjectId, ref: 'CustomerBillingProfile' },
  invoiceNumber: { type: String },
  sourceKey: { type: String },
  documentType: {
    type: String,
    enum: ['tax_invoice', 'non_gst_invoice', 'proforma_invoice', 'payment_receipt', 'credit_note', 'debit_note', 'customer_statement'],
    required: true,
  },
  status: { type: String, enum: ['draft', 'finalized', 'void'], default: 'draft' },
  revisionNumber: { type: Number, default: 1, min: 1 },
  parentInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  relatedInvoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  invoiceDate: { type: Date, required: true, default: Date.now },
  customerSnapshot: { type: Schema.Types.Mixed, required: true },
  billingSnapshot: { type: Schema.Types.Mixed, required: true },
  businessSnapshot: { type: Schema.Types.Mixed, required: true },
  bookingSnapshot: { type: Schema.Types.Mixed },
  serviceDescription: { type: String, required: true },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  discount: { type: Number, default: 0, min: 0 },
  tollParkingTreatment: { type: String, enum: ['included', 'separate_non_taxable'], default: 'included' },
  taxableAmount: { type: Number, required: true, min: 0 },
  gstAmount: { type: Number, required: true, min: 0 },
  tollAmount: { type: Number, default: 0, min: 0 },
  parkingAmount: { type: Number, default: 0, min: 0 },
  adjustmentAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  amountReceived: { type: Number, required: true, min: 0 },
  balanceDue: { type: Number, required: true, min: 0 },
  paymentTerms: { type: String },
  bankDetails: { type: String },
  upiId: { type: String },
  termsAndConditions: { type: String },
  adjustmentReason: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  finalizedBy: { userId: { type: String }, role: { type: String } },
  finalizedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
// A plain `sparse: true` does NOT work here: for a COMPOUND index, Mongo
// only skips a document from a sparse index if it's missing ALL of the
// indexed fields — since tenantId is always present, every draft (even
// with invoiceNumber absent) still gets indexed with an effective null
// key, so a second draft collides with the first "null" entry. A partial
// index with an explicit filter is the correct fix: only documents that
// actually HAVE a real invoiceNumber are indexed at all, so any number of
// unfinalized drafts can coexist.
InvoiceSchema.index(
  { tenantId: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } },
);
InvoiceSchema.index({ tenantId: 1, sourceKey: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
InvoiceSchema.index({ tenantId: 1, bookingId: 1, status: 1 });
export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);

// Generic atomic per-tenant sequence generator — `findOneAndUpdate` with
// `$inc` is a single atomic Mongo operation, so concurrent invoice
// creation can never hand out the same number twice (unlike
// `count() + 1`, which races under concurrent inserts). Used for
// financial-year-aware invoice numbering below.
export interface ICounter extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  value: number;
}
const CounterSchema = new Schema<ICounter>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
});
CounterSchema.index({ tenantId: 1, name: 1 }, { unique: true });
export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

// Tenant-specific invoice configuration — company/tax/bank details used to
// render the PDF header/footer and WhatsApp templates, plus the numbering
// scheme. Deliberately a SEPARATE document from User.businessDetails
// (which already exists and stays exactly as-is, still used as a
// fallback in invoiceService.ts's businessSnapshot) rather than folded
// into it, since invoice prefixes/bank details/T&C are invoice-specific
// configuration, not a generic company profile. Changing these settings
// only affects invoices generated AFTER the change — every existing
// finalized invoice already carries its own immutable businessSnapshot.
export interface IInvoiceSettings extends Document {
  tenantId: mongoose.Types.ObjectId;
  legalCompanyName?: string;
  brandName?: string;
  logoUrl?: string;
  gstNumber?: string;
  panNumber?: string;
  registeredAddress?: string;
  branchAddress?: string;
  mobile?: string;
  email?: string;
  website?: string;
  taxInvoicePrefix: string;
  nonGstInvoicePrefix: string;
  proformaPrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  receiptPrefix: string;
  statementPrefix: string;
  financialYearStartMonth: number; // 1-12, default 4 (April, Indian FY)
  defaultGstRate: number;
  defaultPaymentTerms?: string;
  defaultTermsAndConditions?: string;
  authorizedSignatoryName?: string;
  signatureUrl?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
  paymentQrUrl?: string;
  invoiceFooterMessage?: string;
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}
const InvoiceSettingsSchema = new Schema<IInvoiceSettings>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  legalCompanyName: { type: String },
  brandName: { type: String },
  logoUrl: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  registeredAddress: { type: String },
  branchAddress: { type: String },
  mobile: { type: String },
  email: { type: String },
  website: { type: String },
  taxInvoicePrefix: { type: String, default: 'INV' },
  nonGstInvoicePrefix: { type: String, default: 'INV' },
  proformaPrefix: { type: String, default: 'PI' },
  creditNotePrefix: { type: String, default: 'CN' },
  debitNotePrefix: { type: String, default: 'DN' },
  receiptPrefix: { type: String, default: 'RCT' },
  statementPrefix: { type: String, default: 'STMT' },
  financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
  defaultGstRate: { type: Number, default: 18, min: 0, max: 100 },
  defaultPaymentTerms: { type: String },
  defaultTermsAndConditions: { type: String },
  authorizedSignatoryName: { type: String },
  signatureUrl: { type: String },
  bankAccountName: { type: String },
  bankName: { type: String },
  bankAccountNumber: { type: String },
  bankIfsc: { type: String },
  bankBranch: { type: String },
  upiId: { type: String },
  paymentQrUrl: { type: String },
  invoiceFooterMessage: { type: String },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
InvoiceSettingsSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const InvoiceSettings = mongoose.model<IInvoiceSettings>('InvoiceSettings', InvoiceSettingsSchema);

// Consent history — append-only, same split as tags: Customer.consent is
// the fast-read current state, this is the audit trail of every grant/
// revoke behind it. Every campaign send (once campaigns exist) must
// check Customer.consent.promotional + status, never assume consent from
// the mere existence of a phone number.
export interface ICustomerConsentEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  channel: 'whatsapp' | 'promotional' | 'email' | 'sms';
  action: 'opted_in' | 'opted_out';
  source: string;
  reason?: string;
  actor: { userId: string; role: string };
  createdAt: Date;
}
const CustomerConsentEventSchema = new Schema<ICustomerConsentEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  channel: { type: String, enum: ['whatsapp', 'promotional', 'email', 'sms'], required: true },
  action: { type: String, enum: ['opted_in', 'opted_out'], required: true },
  source: { type: String, required: true },
  reason: { type: String },
  actor: { userId: { type: String, required: true }, role: { type: String, required: true } },
  createdAt: { type: Date, default: Date.now },
});
CustomerConsentEventSchema.index({ tenantId: 1, customerId: 1 });
export const CustomerConsentEvent = mongoose.model<ICustomerConsentEvent>('CustomerConsentEvent', CustomerConsentEventSchema);

// Campaigns/Offers — a saved outreach targeted at a customer segment or
// tag, sent over WhatsApp using the same provider as booking messages.
// `stats` is a cached summary written once by campaignService.sendCampaign
// from the real CampaignRecipient rows it created — never hand-edited.
export interface ICampaign extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  offerType: 'discount_percent' | 'discount_flat' | 'reward_bonus_points' | 'announcement';
  offerValue?: number;
  targetType: 'segment' | 'tag';
  targetKey: string;
  channel: 'whatsapp';
  messageTemplate: string;
  validFrom?: Date;
  validTo?: Date;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  stats?: {
    totalTargeted: number;
    sent: number;
    failed: number;
    excludedOptedOut: number;
    excludedInvalidPhone: number;
  };
  createdBy: { userId: string; role: string };
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const CampaignSchema = new Schema<ICampaign>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  description: { type: String },
  offerType: { type: String, enum: ['discount_percent', 'discount_flat', 'reward_bonus_points', 'announcement'], default: 'announcement' },
  offerValue: { type: Number },
  targetType: { type: String, enum: ['segment', 'tag'], required: true },
  targetKey: { type: String, required: true },
  channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  messageTemplate: { type: String, required: true },
  validFrom: { type: Date },
  validTo: { type: Date },
  status: { type: String, enum: ['draft', 'sending', 'completed', 'failed'], default: 'draft' },
  stats: {
    totalTargeted: { type: Number },
    sent: { type: Number },
    failed: { type: Number },
    excludedOptedOut: { type: Number },
    excludedInvalidPhone: { type: Number },
  },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
CampaignSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
CampaignSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});
export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);

// Per-customer send ledger for a campaign — the real record of what was
// actually attempted/delivered. campaign.stats is only ever a sum of
// these rows. Unique per (campaignId, customerId) so a send can never be
// double-recorded for the same customer even if triggered twice.
export interface ICampaignRecipient extends Document {
  tenantId: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  phone?: string;
  status: 'sent' | 'failed' | 'skipped_opted_out' | 'skipped_invalid_phone';
  providerMessageId?: string;
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}
const CampaignRecipientSchema = new Schema<ICampaignRecipient>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  phone: { type: String },
  status: { type: String, enum: ['sent', 'failed', 'skipped_opted_out', 'skipped_invalid_phone'], required: true },
  providerMessageId: { type: String },
  error: { type: String },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
CampaignRecipientSchema.index({ campaignId: 1, customerId: 1 }, { unique: true });
export const CampaignRecipient = mongoose.model<ICampaignRecipient>('CampaignRecipient', CampaignRecipientSchema);

// One in-progress "Add Booking" wizard draft per (tenant, user) — auto-saved
// as the user moves through the existing EnhancedBookingForm steps so a
// refresh or accidental navigation-away doesn't lose their progress. A
// single slot per user (not a list) is a deliberate scope decision: the
// spec asks not to lose in-progress work, not to build a drafts-management
// UI, and a single "resume your unfinished booking?" prompt covers that.
export interface IBookingDraft extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  step: number;
  formData: any;
  leadId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BookingDraftSchema = new Schema<IBookingDraft>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true },
  step: { type: Number, default: 1 },
  formData: { type: Schema.Types.Mixed, default: {} },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
BookingDraftSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
export const BookingDraft = mongoose.model<IBookingDraft>('BookingDraft', BookingDraftSchema);

// Cross-process mutex for Booking creation against a standalone (non-replica-set)
// MongoDB, where session.withTransaction() cannot run and createBooking() falls back
// to a non-atomic check-then-insert (see storage-mongodb.ts's withVehicleLock). The
// _id (tenantId:vehicleId) doubling as the unique index makes acquisition a single
// atomic insert; the TTL index is a safety net if a process crashes mid-lock.
export interface IVehicleBookingLock extends Document<string> {
  _id: string;
  createdAt: Date;
}

const VehicleBookingLockSchema = new Schema<IVehicleBookingLock>({
  _id: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 30 },
});
export const VehicleBookingLock = mongoose.model<IVehicleBookingLock>('VehicleBookingLock', VehicleBookingLockSchema);

// ---------------------------------------------------------------------
// Vendor 360°
// ---------------------------------------------------------------------
// Reuses the existing `Counter` model (defined above, alongside invoice
// numbering) as its atomic per-tenant sequence generator rather than
// declaring a second identical one.

export type VendorType =
  | 'taxi_vendor' | 'fleet_owner' | 'travel_agent' | 'booking_agent' | 'tour_operator'
  | 'vehicle_owner' | 'driver_cum_owner' | 'corporate_transport_vendor' | 'hotel_partner'
  | 'religious_tour_partner' | 'self_drive_vendor' | 'attached_vehicle_partner'
  | 'online_booking_partner' | 'other';
export type VendorRole = 'booking_source' | 'vehicle_provider' | 'driver_provider' | 'complete_duty_provider' | 'commission_partner';
export type VendorStatus = 'draft' | 'verification_pending' | 'active' | 'temporarily_blocked' | 'suspended' | 'inactive' | 'blacklisted' | 'agreement_expired';
export type VendorPaymentCycle = 'per_trip' | 'weekly' | 'fortnightly' | 'monthly' | 'on_demand';
export type CommissionType = 'fixed' | 'percentage' | 'per_booking' | 'per_km' | 'monthly' | 'none' | 'custom';

// Vendor Master — the root record everything else in Vendor 360° (drivers,
// vehicles, duties, ledger, settlements) hangs off of via vendorId. Money
// fields here follow this codebase's existing convention (plain rupee
// Numbers, same as Booking.totalAmount/advanceReceived) rather than the
// paise-integer convention sometimes used elsewhere, to avoid mixing two
// units across a single booking->vendor cost calculation.
export interface IVendor extends Document {
  tenantId: mongoose.Types.ObjectId;
  vendorCode: string;
  companyName: string;
  contactPerson: string;
  primaryMobile: string;
  normalizedMobile: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  email?: string;
  address?: { line1?: string; line2?: string; city?: string; state?: string; pinCode?: string };
  vendorTypes: VendorType[];
  roles: VendorRole[];
  serviceAreas: string[];
  businessDetails?: {
    gstNumber?: string; pan?: string; registrationNumber?: string;
    agreementNumber?: string; agreementStartDate?: Date; agreementEndDate?: Date;
    creditLimit?: number; creditPeriodDays?: number; paymentCycle?: VendorPaymentCycle;
    taxTreatment?: string; tdsApplicable?: boolean;
  };
  bankDetails?: {
    accountHolderName?: string; bankName?: string; accountNumberEncrypted?: string;
    ifsc?: string; branch?: string; upiId?: string; paymentInstructions?: string;
  };
  defaultCommercialTerms?: { commissionType?: CommissionType; commissionValue?: number; rateAgreementNotes?: string };
  status: VendorStatus;
  rating?: number;
  blacklistReason?: string;
  suspensionReason?: string;
  internalNotes?: string;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  version: number;
}
const VendorSchema = new Schema<IVendor>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vendorCode: { type: String, required: true },
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  primaryMobile: { type: String, required: true },
  normalizedMobile: { type: String, required: true },
  alternateMobile: { type: String },
  whatsappNumber: { type: String },
  email: { type: String },
  address: {
    line1: { type: String }, line2: { type: String }, city: { type: String },
    state: { type: String }, pinCode: { type: String },
  },
  vendorTypes: [{ type: String }],
  roles: [{ type: String }],
  serviceAreas: [{ type: String }],
  businessDetails: {
    gstNumber: { type: String }, pan: { type: String }, registrationNumber: { type: String },
    agreementNumber: { type: String }, agreementStartDate: { type: Date }, agreementEndDate: { type: Date },
    creditLimit: { type: Number }, creditPeriodDays: { type: Number }, paymentCycle: { type: String },
    taxTreatment: { type: String }, tdsApplicable: { type: Boolean },
  },
  bankDetails: {
    accountHolderName: { type: String }, bankName: { type: String }, accountNumberEncrypted: { type: String },
    ifsc: { type: String }, branch: { type: String }, upiId: { type: String }, paymentInstructions: { type: String },
  },
  defaultCommercialTerms: {
    commissionType: { type: String }, commissionValue: { type: Number }, rateAgreementNotes: { type: String },
  },
  status: {
    type: String,
    enum: ['draft', 'verification_pending', 'active', 'temporarily_blocked', 'suspended', 'inactive', 'blacklisted', 'agreement_expired'],
    default: 'active',
  },
  rating: { type: Number },
  blacklistReason: { type: String },
  suspensionReason: { type: String },
  internalNotes: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
});
VendorSchema.index({ tenantId: 1, vendorCode: 1 }, { unique: true });
VendorSchema.index({ tenantId: 1, normalizedMobile: 1 });
VendorSchema.index({ tenantId: 1, status: 1 });
VendorSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});
export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);

export type VendorDriverStatus = 'available' | 'tentatively_held' | 'assigned' | 'on_duty' | 'on_leave' | 'suspended' | 'inactive' | 'document_expired';

// A driver belonging to a Vendor (not a company driver — see `Driver`
// above). Scoped to (tenantId, vendorId); duplicate detection is by
// normalized mobile WITHIN the same vendor only — the same person
// legitimately drives for two different vendors in this domain.
export interface IVendorDriver extends Document {
  tenantId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  driverCode: string;
  name: string;
  primaryMobile: string;
  normalizedMobile: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  policeVerificationStatus?: string;
  address?: string;
  emergencyContact?: string;
  photoUrl?: string;
  status: VendorDriverStatus;
  assignedVehicleId?: mongoose.Types.ObjectId;
  serviceAreas: string[];
  rating?: number;
  complaintCount: number;
  completedDutyCount: number;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}
const VendorDriverSchema = new Schema<IVendorDriver>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  driverCode: { type: String, required: true },
  name: { type: String, required: true },
  primaryMobile: { type: String, required: true },
  normalizedMobile: { type: String, required: true },
  alternateMobile: { type: String },
  whatsappNumber: { type: String },
  licenseNumber: { type: String },
  licenseExpiry: { type: Date },
  policeVerificationStatus: { type: String },
  address: { type: String },
  emergencyContact: { type: String },
  photoUrl: { type: String },
  status: {
    type: String,
    enum: ['available', 'tentatively_held', 'assigned', 'on_duty', 'on_leave', 'suspended', 'inactive', 'document_expired'],
    default: 'available',
  },
  assignedVehicleId: { type: Schema.Types.ObjectId, ref: 'VendorVehicle' },
  serviceAreas: [{ type: String }],
  rating: { type: Number },
  complaintCount: { type: Number, default: 0 },
  completedDutyCount: { type: Number, default: 0 },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
});
VendorDriverSchema.index({ tenantId: 1, vendorId: 1, driverCode: 1 }, { unique: true });
// Real duplicate protection (spec §5) — the same mobile can't be created
// twice under the same vendor; not just an advisory lookup. Scoped to
// non-deleted rows so a soft-deleted driver doesn't block a legitimate
// re-add.
VendorDriverSchema.index(
  { tenantId: 1, vendorId: 1, normalizedMobile: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
VendorDriverSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const VendorDriver = mongoose.model<IVendorDriver>('VendorDriver', VendorDriverSchema);

export type VendorVehicleStatus = 'available' | 'tentatively_held' | 'assigned' | 'on_trip' | 'maintenance' | 'breakdown' | 'document_expired' | 'inactive';

// A vehicle belonging to a Vendor (not a company vehicle — see `Vehicle`
// above). Registration numbers are normalized (case/space/hyphen
// insensitive) before the duplicate check so "MP09 AB 1234", "MP09AB1234"
// and "mp-09-ab-1234" all resolve to the same vendor vehicle.
export interface IVendorVehicle extends Document {
  tenantId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  vehicleCode: string;
  registrationNumber: string;
  normalizedRegistrationNumber: string;
  make?: string;
  vehicleModel: string;
  variant?: string;
  category: string;
  seatingCapacity?: number;
  fuelType?: string;
  colour?: string;
  ownerName?: string;
  assignedDriverId?: mongoose.Types.ObjectId;
  rcNumber?: string;
  rcExpiry?: Date;
  insuranceExpiry?: Date;
  permitExpiry?: Date;
  fitnessExpiry?: Date;
  pucExpiry?: Date;
  taxExpiry?: Date;
  fastagDetails?: string;
  gpsDetails?: string;
  currentOdometer?: number;
  status: VendorVehicleStatus;
  completedDutyCount: number;
  totalRevenue: number;
  totalVendorCost: number;
  rating?: number;
  complaintCount: number;
  notes?: string;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}
const VendorVehicleSchema = new Schema<IVendorVehicle>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vehicleCode: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  normalizedRegistrationNumber: { type: String, required: true },
  make: { type: String },
  vehicleModel: { type: String, required: true },
  variant: { type: String },
  category: { type: String, required: true },
  seatingCapacity: { type: Number },
  fuelType: { type: String },
  colour: { type: String },
  ownerName: { type: String },
  assignedDriverId: { type: Schema.Types.ObjectId, ref: 'VendorDriver' },
  rcNumber: { type: String },
  rcExpiry: { type: Date },
  insuranceExpiry: { type: Date },
  permitExpiry: { type: Date },
  fitnessExpiry: { type: Date },
  pucExpiry: { type: Date },
  taxExpiry: { type: Date },
  fastagDetails: { type: String },
  gpsDetails: { type: String },
  currentOdometer: { type: Number },
  status: {
    type: String,
    enum: ['available', 'tentatively_held', 'assigned', 'on_trip', 'maintenance', 'breakdown', 'document_expired', 'inactive'],
    default: 'available',
  },
  completedDutyCount: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalVendorCost: { type: Number, default: 0 },
  rating: { type: Number },
  complaintCount: { type: Number, default: 0 },
  notes: { type: String },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
});
VendorVehicleSchema.index({ tenantId: 1, vendorId: 1, vehicleCode: 1 }, { unique: true });
// Real duplicate protection (spec §6) — same reasoning as VendorDriver's
// normalizedMobile index above.
VendorVehicleSchema.index(
  { tenantId: 1, vendorId: 1, normalizedRegistrationNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
VendorVehicleSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const VendorVehicle = mongoose.model<IVendorVehicle>('VendorVehicle', VendorVehicleSchema);

// The record that a booking's vendor assignment became a real duty with a
// time window — created/updated by POST /api/bookings/:id/assign-vendor,
// one active duty per booking (upserted by bookingId). scheduledStart/
// EndDateTime is a snapshot taken at assignment time for display/audit
// (duty slip) purposes; the actual overlap-check path in
// vendorDriverService/vendorVehicleService reads the LIVE booking's
// scheduledStartDateTime/scheduledEndDateTime instead of this snapshot,
// so a later reschedule/extend of the booking can't leave a stale
// duty window silently defeating conflict detection.
export type VendorDutyStatus = 'active' | 'completed' | 'cancelled';
export interface IVendorDuty extends Document {
  tenantId: mongoose.Types.ObjectId;
  dutyNumber: string;
  bookingId: mongoose.Types.ObjectId;
  fulfilmentVendorId: mongoose.Types.ObjectId;
  vendorDriverId?: mongoose.Types.ObjectId;
  vendorVehicleId?: mongoose.Types.ObjectId;
  scheduledStartDateTime: Date;
  scheduledEndDateTime: Date;
  vendorAgreedRate?: number;
  vendorAdvancePaid?: number;
  status: VendorDutyStatus;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}
const VendorDutySchema = new Schema<IVendorDuty>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  dutyNumber: { type: String, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  fulfilmentVendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vendorDriverId: { type: Schema.Types.ObjectId, ref: 'VendorDriver' },
  vendorVehicleId: { type: Schema.Types.ObjectId, ref: 'VendorVehicle' },
  scheduledStartDateTime: { type: Date, required: true },
  scheduledEndDateTime: { type: Date, required: true },
  vendorAgreedRate: { type: Number },
  vendorAdvancePaid: { type: Number },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
VendorDutySchema.index({ tenantId: 1, dutyNumber: 1 }, { unique: true });
// One active duty per booking — assign-vendor upserts against this rather
// than ever inserting a second live duty for the same booking.
VendorDutySchema.index(
  { tenantId: 1, bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
VendorDutySchema.index({ tenantId: 1, vendorDriverId: 1, status: 1 });
VendorDutySchema.index({ tenantId: 1, vendorVehicleId: 1, status: 1 });
VendorDutySchema.index({ tenantId: 1, fulfilmentVendorId: 1, status: 1 });
VendorDutySchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const VendorDuty = mongoose.model<IVendorDuty>('VendorDuty', VendorDutySchema);

// Outsource Vehicle workflow (spec §10-12) — a Booking's own request to
// source a vehicle from one or more Vendors when nothing was resolved at
// creation time. Deliberately separate from VendorDuty: a duty is a real,
// time-windowed commitment against a specific vendor driver/vehicle,
// created only once a quote is actually accepted; this request tracks the
// broader "who did we ask, who responded, what did they offer" history
// even for vendors who were never awarded the work.
export type VendorSourcingRequestStatus =
  | 'draft' | 'sent' | 'responses_pending' | 'quotes_received' | 'vendor_selected'
  | 'resource_secured' | 'cancelled' | 'expired';
export interface IVendorSourcingRequest extends Document {
  tenantId: mongoose.Types.ObjectId;
  requestNumber: string;
  bookingId: mongoose.Types.ObjectId;
  vehicleCategory?: string;
  seatingCapacity?: number;
  quantity: number;
  routeSnapshot?: string;
  scheduledStartDateTime?: Date;
  scheduledEndDateTime?: Date;
  passengerCount?: number;
  targetVendorCost?: number;
  responseDeadline?: Date;
  internalNotes?: string;
  status: VendorSourcingRequestStatus;
  selectedResponseId?: mongoose.Types.ObjectId;
  createdBy: { userId: string; role: string };
  updatedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}
const VendorSourcingRequestSchema = new Schema<IVendorSourcingRequest>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  requestNumber: { type: String, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  vehicleCategory: { type: String },
  seatingCapacity: { type: Number },
  quantity: { type: Number, default: 1 },
  routeSnapshot: { type: String },
  scheduledStartDateTime: { type: Date },
  scheduledEndDateTime: { type: Date },
  passengerCount: { type: Number },
  targetVendorCost: { type: Number },
  responseDeadline: { type: Date },
  internalNotes: { type: String },
  status: {
    type: String,
    enum: ['draft', 'sent', 'responses_pending', 'quotes_received', 'vendor_selected', 'resource_secured', 'cancelled', 'expired'],
    default: 'draft',
  },
  selectedResponseId: { type: Schema.Types.ObjectId },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
  updatedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
VendorSourcingRequestSchema.index({ tenantId: 1, requestNumber: 1 }, { unique: true });
VendorSourcingRequestSchema.index({ tenantId: 1, bookingId: 1 });
VendorSourcingRequestSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const VendorSourcingRequest = mongoose.model<IVendorSourcingRequest>('VendorSourcingRequest', VendorSourcingRequestSchema);

// One row per Vendor contacted for a given sourcing request — the
// comparison table (spec §12) reads directly off these. A Vendor can be
// contacted only once per request (unique index below); re-sending is a
// reminder (see vendorSourcingService), not a second row.
export type VendorSourcingResponseStatus = 'pending' | 'accepted' | 'rejected' | 'alternative_offered' | 'negotiation' | 'expired';
export interface IVendorSourcingResponse extends Document {
  tenantId: mongoose.Types.ObjectId;
  sourcingRequestId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  vendorNameSnapshot: string;
  response: VendorSourcingResponseStatus;
  offeredVehicleCategory?: string;
  offeredVendorVehicleId?: mongoose.Types.ObjectId;
  offeredVehicleDetails?: string;
  offeredVendorDriverId?: mongoose.Types.ObjectId;
  offeredDriverDetails?: string;
  quotedCost?: number;
  tollTreatment?: string;
  parkingTreatment?: string;
  notes?: string;
  sentAt?: Date;
  respondedAt?: Date;
  respondedBy?: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}
const VendorSourcingResponseSchema = new Schema<IVendorSourcingResponse>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  sourcingRequestId: { type: Schema.Types.ObjectId, ref: 'VendorSourcingRequest', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  vendorNameSnapshot: { type: String, required: true },
  response: { type: String, enum: ['pending', 'accepted', 'rejected', 'alternative_offered', 'negotiation', 'expired'], default: 'pending' },
  offeredVehicleCategory: { type: String },
  offeredVendorVehicleId: { type: Schema.Types.ObjectId, ref: 'VendorVehicle' },
  offeredVehicleDetails: { type: String },
  offeredVendorDriverId: { type: Schema.Types.ObjectId, ref: 'VendorDriver' },
  offeredDriverDetails: { type: String },
  quotedCost: { type: Number },
  tollTreatment: { type: String },
  parkingTreatment: { type: String },
  notes: { type: String },
  sentAt: { type: Date },
  respondedAt: { type: Date },
  respondedBy: { userId: { type: String }, role: { type: String } },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
VendorSourcingResponseSchema.index({ tenantId: 1, sourcingRequestId: 1, vendorId: 1 }, { unique: true });
VendorSourcingResponseSchema.index({ tenantId: 1, sourcingRequestId: 1 });
VendorSourcingResponseSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
export const VendorSourcingResponse = mongoose.model<IVendorSourcingResponse>('VendorSourcingResponse', VendorSourcingResponseSchema);

export const User = mongoose.model<IUser>('User', UserSchema);
export const Vehicle = mongoose.model<IVehicle>('Vehicle', VehicleSchema);
export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
export const WhatsAppMessage = mongoose.model<IWhatsAppMessage>('WhatsAppMessage', WhatsAppMessageSchema);
export const PaymentTransaction = mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);
export const DriverLeave = mongoose.model<IDriverLeave>('DriverLeave', DriverLeaveSchema);
export const DriverAttendance = mongoose.model<IDriverAttendance>('DriverAttendance', DriverAttendanceSchema);
