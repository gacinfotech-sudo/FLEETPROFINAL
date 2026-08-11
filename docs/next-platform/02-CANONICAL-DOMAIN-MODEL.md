# Canonical Domain Model

**Status**: DOCUMENTED (WAVE 1 complete)  
**Date**: 2026-08-12  
**Source**: Audited from `/server/models/index.ts`  
**Scope**: ONE source of truth for all clients (Web, Business APK, Driver Lite)

---

## Overview

The FleetPro platform uses **one unified MongoDB database with clear domain boundaries**. All clients (Web CRM, Business APK, Driver Lite) operate against the same canonical models. This ensures:

- ✅ Single source of truth
- ✅ No data duplication
- ✅ Consistent business logic
- ✅ Atomic transactions within a tenant
- ✅ Backward compatibility with Web CRM

---

## Canonical Entities

### 1. Tenant

**Purpose**: Multi-tenant isolation  
**Collection**: `tenants`  
**Scope**: Global (all regions, all operators)

```typescript
interface ITenant {
  _id: ObjectId                           // MongoDB _id
  name: string                            // Operator name
  businessName: string                    // Legal business name
  email?: string
  phone?: string
  address?: string
  isActive: boolean                       // Default: true
  subscriptionPlan: 'starter' | 'pro' | 'custom'
  limits: {
    vehicles: number                      // Starter: 6
    drivers: number                       // Starter: 3
    managers: number                      // Starter: 1
  }
  
  // Service mode configuration (WAVE 1.5 addition)
  serviceModes?: {
    selfDrive: boolean                    // Self-drive bookings enabled
    withDriver: boolean                   // With-driver bookings enabled
  }
  
  // Operational settings
  timezone?: string                       // IANA timezone (default: Asia/Kolkata)
  operationsSettings?: {
    graceMinutes?: number                 // Past-end grace period (default: 15)
    turnaroundBufferMinutes?: number      // Self-drive turnaround (default: 60)
    notifyOwner?: boolean
    notifyAssignedUser?: boolean
    selfDriveStages?: [{
      minutesBefore: number
      enabled: boolean
      whatsappInternal?: boolean
      whatsappCustomer?: boolean
    }]
    withDriverStages?: [{...}]
    whatsappInternalPhone?: string        // Ops/staff number
    overdueRealertMinutes?: number
    googleReviewUrl?: string
    reviewTemplate?: string
    sdTemplates?: Record<string, string>  // WhatsApp templates
  }
  
  // Root Control Plane (WAVE 1.6 addition)
  tenantCode?: string                     // Unique tenant identifier
  trialStartsAt?: Date
  trialEndsAt?: Date
  usageCounters?: {
    bookingsThisMonth: number
    lastActivityAt?: Date
  }
  healthRiskFlag?: 'none' | 'watch' | 'at_risk'
  internalNotes?: [{
    note: string
    authorId: string
    authorName?: string
    createdAt: Date
  }]
  
  createdAt: Date
}
```

**Key Rules**:
- Every booking, customer, driver, vehicle MUST reference `tenantId`
- Tenant isolation enforced at database layer (indexes + queries)
- Multi-tenant scale: 1–1000+ operators per deployment
- Backward compatibility: field absence = defaults (e.g., serviceModes absent = both enabled)

---

### 2. Customer

**Purpose**: Booking party identity + contact + preferences  
**Collection**: `customers`  
**Key Identity**: `tenantId + primaryMobile` (canonicalized)

```typescript
interface ICustomer {
  _id: ObjectId
  tenantId: ObjectId                      // REQUIRED: tenant isolation
  customerCode?: string                   // Human-friendly code (auto-generated)
  
  // Identity (CRITICAL)
  name: string                            // Full name (immutable after first booking)
  primaryMobile: string                   // E.164-normalized, de-duplication key
  alternateMobile?: string                // E.164-normalized
  whatsappNumber?: string                 // E.164-normalized
  phoneAliases: string[]                  // All phone variants normalized
  email?: string
  emailAliases: string[]
  
  // Profile
  dateOfBirth?: Date
  anniversary?: Date
  address?: string
  city?: string
  state?: string
  pinCode?: string
  companyName?: string
  companyAliases: string[]
  customerType: 'individual' | 'family' | 'corporate' | 'travel_agent'
               | 'hotel_guest' | 'religious_traveller' | 'self_drive'
               | 'airport' | 'outstation' | 'vip' | 'credit' | 'other'
  
  // Billing (optional, for corporate)
  billing?: {
    billingName?: string
    panNumber?: string
    billingAddress?: string
    billingEmail?: string
    accountsContact?: string
    purchaseOrderRequired?: boolean
    creditPeriodDays?: number
    creditLimit?: number
    invoiceRequired?: boolean
    gstInvoiceRequired?: boolean
    tdsInformation?: string
    preferredInvoiceFormat?: string
    bankPaymentInstructions?: string
    internalBillingNotes?: string
  }
  
  // Preferences
  preferences?: {
    preferredVehicleCategory?: string
    preferredVehicleId?: ObjectId
    preferredDriverId?: ObjectId
    preferredRoute?: string
    preferredPickupLocation?: string
    preferredPaymentMode?: string
    noSmoking?: boolean
    wheelchairRequirement?: boolean
    specialInstructions?: string
    generalRequirements?: string
    // ... ~15 more preference fields
  }
  
  // Derived statistics (recomputed server-side)
  totalBookings: number
  completedBookings: number
  cancelledBookings: number
  totalSpending: number
  firstBookingDate?: Date
  lastBookingDate?: Date
  customerStatus: 'new' | 'repeat' | 'frequent' | 'high_value' | 'inactive' | 'at_risk'
  
  // Rewards & loyalty
  rewardPointsBalance: number
  loyaltyTier: string
  
  // Referral program
  referralCode?: string
  referralCodeActive?: boolean
  
  // Tags & categorization
  tags: string[]                          // Denormalized tags (source: CustomerTagEvent)
  
  // Consent & communications
  consent: {
    whatsapp: boolean                     // Default: true (transactional)
    promotional: boolean                  // Default: false (opt-in)
    email: boolean                        // Default: true (transactional)
    sms: boolean                          // Default: false (opt-in)
  }
  consentSource?: string
  consentDate?: Date
  optOutDate?: Date
  doNotContactReason?: string
  
  // CRITICAL: Blacklist status (WAVE 2)
  status: 'active' | 'inactive' | 'blacklisted' | 'do_not_contact'
  
  // Audit fields
  createdBy: { userId: string; role: string }
  updatedBy?: { userId: string; role: string }
  isDeleted?: boolean
  mergedIntoCustomerId?: ObjectId         // Merge target (if duplicate)
  mergedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

**Indexes Required**:
```javascript
db.customers.createIndex({ tenantId: 1, primaryMobile: 1 }, { unique: true })
db.customers.createIndex({ tenantId: 1, alternateMobile: 1 })
db.customers.createIndex({ tenantId: 1, whatsappNumber: 1 })
db.customers.createIndex({ tenantId: 1, status: 1 })
db.customers.createIndex({ tenantId: 1, email: 1 })
db.customers.createIndex({ tenantId: 1, createdAt: -1 })
```

**Critical Behaviors**:

1. **Phone Normalization**
   - Input: `9876543210 | 09876543210 | +919876543210 | 91 98765 43210`
   - Normalized: `919876543210` (E.164 without + prefix)
   - Stored in `primaryMobile`, `alternateMobile`, `whatsappNumber`, `phoneAliases`

2. **Duplicate Prevention**
   - Lookup: `db.customers.findOne({ tenantId, primaryMobile })`
   - If found & name matches: return existing
   - If found & name differs: CONFLICT (operator must verify)
   - If not found: create new

3. **Name Lock**
   - After first booking created: name becomes immutable
   - Reason: prevent operator typos creating duplicate customers
   - Change controlled: requires customer merge process

4. **Blacklist Enforcement** (WAVE 2)
   - Checked at every booking creation
   - Status `blacklisted` → may trigger HARD_BLOCK or MANAGER_APPROVAL
   - Audit trail: who blacklisted, when, why

---

### 3. Booking

**Purpose**: Unified booking (self-drive + with-driver)  
**Collection**: `bookings`  
**Key Identity**: `tenantId + bookingId` (short public code: `bookingCode`)

```typescript
interface IBooking {
  _id: ObjectId
  tenantId: ObjectId                      // REQUIRED: tenant isolation
  bookingId: string                       // Unique within tenant
  bookingCode?: string                    // Short, human-friendly code (TASK-BOOKING-CODE-02)
  idempotencyKey?: string                 // Client-generated, prevents duplicates on retry
  
  // Booking parties
  customerId?: ObjectId                   // Link to Customer (mobile requires this)
  customerName: string                    // Snapshot at booking time
  customerPhone: string                   // Snapshot at booking time
  customerEmail?: string
  
  // Vehicle assignment
  vehicleId?: ObjectId                    // Optional until trip start
  resourceFulfilmentStatus?: 'not_started' | 'own_fleet_assigned' | 'vendor_vehicle_selected'
                            | 'vendor_confirmation_pending' | 'vendor_confirmed' | 'outsourcing_requested'
                            | 'vendor_quotes_pending' | 'resource_sourcing_pending' | 'resource_secured'
                            | 'resource_rejected' | 'resource_failed'
  
  // Driver assignment
  driverId?: ObjectId                     // Optional for self-drive, required for with-driver
  dutyAcceptedAt?: Date                   // Driver portal acceptance timestamp
  
  // Booking type & shape
  bookingType: 'self_drive' | 'with_driver' | 'one_way' | 'round_trip' | 'local' | 'airport'
  tripType?: 'one_way' | 'round_trip' | 'local' | 'airport'  // Trip shape (distinct from who drives)
  
  // Location & itinerary
  pickupLocation: string                  // REQUIRED
  dropoffLocation?: string
  additionalStops?: string[]
  
  // Date & time (CRITICAL: WAVE 1.2 addition)
  pickupDate?: Date                       // Only if travelDateStatus === 'confirmed'
  returnDate?: Date                       // Self-drive only
  pickupTime?: string                     // HH:MM format
  returnTime?: string
  
  // Date certainty (TASK-BOOKING-DOMAIN-02)
  travelDateStatus?: 'confirmed' | 'range' | 'not_decided'  // Default: 'confirmed'
  tentativeStartDate?: Date               // Required if travelDateStatus === 'range'
  tentativeEndDate?: Date
  followUpAt?: Date                       // Next follow-up reminder
  lastActivityAt?: Date                   // Server-derived "last touched"
  
  // Computed timestamps
  scheduledStartDateTime?: Date           // pickupDate + pickupTime combined
  scheduledEndDateTime?: Date
  actualStartDateTime?: Date              // Only set when trip actually starts
  actualEndDateTime?: Date
  
  // Odometer
  startOdometer?: number
  endOdometer?: number
  totalKilometers?: number
  
  // Self-drive specific (Live Operations)
  securityDepositAmount?: number
  securityDepositStatus?: 'pending' | 'collected' | 'refund_pending'
                        | 'partially_refunded' | 'refunded' | 'forfeited'
  startFuelLevel?: string                 // e.g. "3/4", "82%"
  
  // Pricing & payment
  pricingType?: 'day' | 'km'
  totalAmount: number                     // In paise
  originalAmount?: number                 // Before reward discount
  advanceReceived?: number
  advanceRequested?: number
  driverCollectionAmount?: number
  collectionMode?: 'company' | 'driver' | 'vendor' | 'split'
  
  rewardPointsRedeemed?: number
  rewardDiscountApplied?: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  
  // Charges
  tollCharges?: number
  parkingCharges?: number
  petrolCharges?: number
  dieselCharges?: number
  cngCharges?: number
  miscellaneousAmount?: number
  miscellaneousDescription?: string
  
  // Communication
  customerDiscussionSummary?: string      // Phone call summary (WhatsApp-visible)
  notes?: string                          // Driver/office instructions
  
  // Status & lifecycle
  status: 'enquiry' | 'quotation_sent' | 'tentative' | 'on_hold' | 'confirmed'
         | 'vehicle_assigned' | 'driver_assigned' | 'ready_for_dispatch'
         | 'trip_started' | 'ongoing' | 'extended' | 'return_pending'
         | 'completed' | 'payment_pending' | 'closed' | 'cancelled' | 'no_show'
  statusHistory?: [{
    fromStatus: string
    toStatus: string
    changedBy: { userId: string; role: string }
    reason?: string
    override?: boolean
    changedAt: Date
  }]
  
  // Cancellation
  cancellationReason?: string
  cancellationType?: 'customer' | 'company' | 'vendor'
  
  // Extensions (multi-day trips)
  extensionHistory?: [{
    extensionNumber: number
    previousReturnDate?: Date
    newReturnDate: Date
    charges: { additionalDays?: number; ... }
    extensionTotal: number
    reason?: string
    requestedBy: { userId: string; role: string }
    createdAt: Date
  }]
  
  // Third-party driver
  useThirdPartyDriver?: boolean
  thirdPartyDriverName?: string
  thirdPartyDriverCharges?: number
  thirdPartyDriverPhone?: string
  thirdPartyDriverAddress?: string
  
  // Audit
  createdBy?: { userId: string; role: string }
  createdAt: Date
  updatedAt?: Date
}
```

**Key Indexes**:
```javascript
db.bookings.createIndex({ tenantId: 1, bookingId: 1 }, { unique: true })
db.bookings.createIndex({ tenantId: 1, customerId: 1 })
db.bookings.createIndex({ tenantId: 1, driverId: 1 })
db.bookings.createIndex({ tenantId: 1, vehicleId: 1 })
db.bookings.createIndex({ tenantId: 1, status: 1 })
db.bookings.createIndex({ tenantId: 1, scheduledStartDateTime: 1 })
db.bookings.createIndex({ tenantId: 1, createdAt: -1 })
```

**Critical Behaviors**:

1. **Unified Model**
   - One Booking entity for self-drive + with-driver
   - `bookingType` distinguishes who drives
   - `driverId` required only for `with_driver`

2. **Date Certainty** (WAVE 1.2)
   - `travelDateStatus: 'confirmed'` → `pickupDate` required
   - `travelDateStatus: 'range'` → `tentativeStartDate` + `tentativeEndDate` required
   - `travelDateStatus: 'not_decided'` → neither required (for tentative leads)

3. **Idempotency** (WAVE 2–3)
   - `idempotencyKey` prevents duplicate bookings on form resubmit
   - Mobile API requires `operationId` per booking creation

4. **Customer Lookup** (WAVE 2)
   - Booking creation must call `PhoneNormalizer.lookup(customerId OR phone)`
   - Blacklist check before confirmation

---

### 4. DriverAssignment (NEW — WAVE 5)

**Purpose**: State machine for driver duty assignment + acceptance  
**Collection**: `driverassignments`  
**Scope**: One per booking requiring driver

```typescript
interface IDriverAssignment {
  _id: ObjectId
  tenantId: ObjectId                      // REQUIRED
  bookingId: ObjectId                     // REQUIRED: which booking
  driverId: ObjectId                      // REQUIRED: assigned driver
  
  // State machine (6 states)
  status: 'ASSIGNED' | 'NOTIFICATION_SENT' | 'SEEN'
         | 'ACCEPTED' | 'REJECTED' | 'TIMED_OUT' | 'CANCELLED'
  
  // Timestamps per state
  assignedAt: Date                        // When created
  notificationSentAt?: Date
  seenAt?: Date                           // Observed from mobile
  acceptedAt?: Date
  rejectedAt?: Date
  timedOutAt?: Date
  cancelledAt?: Date
  
  // Acceptance window
  acceptanceDeadline?: Date               // Must accept by this time
  acceptanceDeadlineMinutes?: number      // e.g. 15 minutes from assignment
  
  // Rejection reason (if applicable)
  rejectionReason?: string
  
  // Audit
  createdAt: Date
  updatedAt: Date
}
```

**State Transitions**:
```
ASSIGNED
  ├─→ NOTIFICATION_SENT (notification delivery confirmed)
  │     ├─→ SEEN (driver opened notification)
  │     │     ├─→ ACCEPTED (driver accepts duty)
  │     │     ├─→ REJECTED (driver rejects with reason)
  │     │     └─→ TIMED_OUT (deadline passed without response)
  │     └─→ TIMED_OUT (notification delivery timeout)
  └─→ CANCELLED (ops cancels before driver sees)
```

**Key Behaviors**:

1. **Notification Integration**
   - ASSIGNED → trigger high-priority driver notification
   - Include: booking details, pickup time, address, accept/reject buttons
   - Deadline shown to driver

2. **Timeout Handling**
   - 15-minute default acceptance window (configurable per tenant)
   - After timeout: ops may reassign to different driver
   - Driver sees "expired assignment" if they check app after deadline

3. **Realtime Sync**
   - Driver acceptance → immediately visible in Web/Business APK
   - Ops can see: DRIVER ACCEPTED in assignment list

---

### 5. SyncOperation (NEW — WAVE 3 Mobile)

**Purpose**: Offline-first sync, idempotent operation tracking  
**Collection**: `syncoperations`  
**Scope**: Mobile operations that must work offline

```typescript
interface ISyncOperation {
  _id: ObjectId
  tenantId: ObjectId
  userId: ObjectId
  
  // Deduplication key (critical for offline)
  operationId: string                     // UUID, unique per user + device
  deviceId: string                        // Device fingerprint
  
  // What was changed
  entityType: 'BOOKING' | 'PAYMENT' | 'EXPENSE'
             | 'COLLECTION' | 'DUTY_START' | 'DUTY_END' | 'PHOTO'
  entityId: ObjectId
  payload: Record<string, any>            // The mutation data
  
  // Conflict detection
  baseVersion: number                     // Entity version at time of mutation
  
  // Sync status
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED'
  
  // Timestamps
  deviceTimestamp: Date                   // When created locally
  serverTimestamp?: Date                  // When processed server-side
  
  // Retry tracking
  attemptCount: number
  lastAttemptAt?: Date
  nextRetryAt?: Date
  
  // Error tracking
  errorMessage?: string
  conflictDetails?: Record<string, any>
  
  createdAt: Date
  updatedAt: Date
}
```

**Critical Behavior**: Server processes `operationId` idempotently
- First call: execute operation, return result
- Duplicate call: return cached result (no second expense/payment/etc.)

---

### 6. DeviceRegistration (NEW — WAVE 3 Mobile)

**Purpose**: Mobile device fingerprinting, multi-device session tracking  
**Collection**: `deviceregistrations`

```typescript
interface IDeviceRegistration {
  _id: ObjectId
  tenantId: ObjectId
  userId: ObjectId
  deviceId: string                        // Unique per user + device (fingerprint)
  deviceType: 'ANDROID' | 'IOS'
  appVersion: string                      // Semantic version (1.0.0)
  isActive: boolean
  createdAt: Date
  lastSeenAt: Date
  updatedAt: Date
}
```

---

### 7. Driver

**Purpose**: Driver identity + lifecycle + login  
**Collection**: `drivers`

```typescript
interface IDriver {
  _id: ObjectId
  tenantId: ObjectId
  name: string                            // Required
  phone: string                           // E.164-normalized, same as Customer
  email?: string
  licenseNumber?: string
  experience?: number                     // Years
  rating?: number
  status: 'available' | 'on_duty' | 'inactive'
  
  // Lifecycle (distinct from operational status)
  lifecycleStage?: 'candidate' | 'application' | 'document_collection'
                 | 'identity_verification' | 'police_verification' | 'medical_fitness'
                 | 'reference_verification' | 'employment_verification' | 'training'
                 | 'approved' | 'active' | 'suspended' | 'on_leave' | 'offboarding' | 'offboarded'
  
  // Address
  permanentAddress?: string
  currentAddress?: string
  
  // Documents
  aadharNumber?: string
  panNumber?: string
  
  // Dates
  dateOfJoining?: Date
  createdAt: Date
  
  // Driver Portal (separate from staff User login)
  loginPin?: string                       // bcrypt hash
  loginPinSetAt?: Date
  sessionId?: string
}
```

---

### 8. Vehicle

**Purpose**: Fleet asset management  
**Collection**: `vehicles`

```typescript
interface IVehicle {
  _id: ObjectId
  tenantId: ObjectId
  make: string                            // Required: vehicle name
  vehicleModel?: string
  year?: number
  licensePlate?: string
  normalizedLicensePlate?: string         // Lookup key
  capacity?: number
  type: 'economy' | 'standard' | 'premium' | 'luxury' | 'suv' | 'sedan' | 'hatchback' | 'coupe' | 'convertible'
  status: 'available' | 'on_trip' | 'maintenance'
         | 'RESERVED' | 'ASSIGNED' | 'RETURNING' | 'CLEANING'
         | 'MAINTENANCE_DUE' | 'IN_MAINTENANCE' | 'BREAKDOWN'
         | 'ACCIDENT_HOLD' | 'INACTIVE' | 'SOLD'
  
  // Pricing
  pricePerDay?: number
  pricePerHour?: number
  pricePerKm?: number
  
  // Details
  color?: string
  fuelType?: string
  transmission?: string
  
  // Vehicle 360 additions
  vehicleCategory?: string
  variant?: string
  ownershipType?: 'owned' | 'leased' | 'financed' | 'rented'
  currentOdometer?: number
  branch?: string
  isDraft?: boolean                       // Quick-add draft state
  
  createdAt: Date
}
```

---

### 9. Payment

**Purpose**: Financial transaction tracking  
**Collection**: `payments`

```typescript
interface IPayment {
  _id: ObjectId
  tenantId: ObjectId
  bookingId: ObjectId
  amount: number                          // In paise
  status: 'PENDING' | 'COLLECTED' | 'FAILED'
  method: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'
  
  // Idempotency (WAVE 2–3)
  operationId: string                     // UUID, prevents duplicate charges
  
  transactionId?: string                  // External provider reference
  createdAt: Date
  updatedAt: Date
}
```

**Critical Behavior**: `operationId` must be unique per payment attempt

---

## Database Indexes (Required for Performance)

### Critical Indexes (MUST exist)

```javascript
// Tenant isolation (CRITICAL for multi-tenant)
db.customers.createIndex({ tenantId: 1, primaryMobile: 1 }, { unique: true })
db.bookings.createIndex({ tenantId: 1, bookingId: 1 }, { unique: true })
db.drivers.createIndex({ tenantId: 1, phone: 1 })
db.vehicles.createIndex({ tenantId: 1, licensePlate: 1 })
db.payments.createIndex({ tenantId: 1, bookingId: 1 })

// Status lookups
db.bookings.createIndex({ tenantId: 1, status: 1 })
db.vehicles.createIndex({ tenantId: 1, status: 1 })

// Time-based queries
db.bookings.createIndex({ tenantId: 1, scheduledStartDateTime: 1 })
db.bookings.createIndex({ tenantId: 1, createdAt: -1 })

// Mobile lookups (new)
db.driverassignments.createIndex({ tenantId: 1, driverId: 1, status: 1 })
db.syncoperations.createIndex({ tenantId: 1, userId: 1, operationId: 1 }, { unique: true })
```

---

## Shared Canonical Services

### CustomerService

**Responsibilities**:
- `lookup(tenantId, phone)` → normalize + find or create
- `checkDuplicates(tenantId, phone)` → detect duplicates
- `updateName(customerId, newName)` → verify immutability rule
- `blacklist(customerId, reason)` → enforce blacklist

### BookingService

**Responsibilities**:
- `create(tenantId, customerId, itinerary)` → validate + create
- `validateCustomer(customerId)` → check blacklist
- `assign(bookingId, driverId)` → driver assignment
- `updateStatus(bookingId, newStatus)` → state machine

### DriverAssignmentService

**Responsibilities**:
- `assign(bookingId, driverId)` → create assignment
- `accept(assignmentId)` → driver accepts
- `reject(assignmentId, reason)` → driver rejects
- `timeout(assignmentId)` → acceptance window expired

### SyncService

**Responsibilities**:
- `push(tenantId, userId, operations)` → process idempotently
- `pull(tenantId, userId, lastEventId)` → canonical state
- `resolveConflict(operation, serverState)` → conflict detection

---

## Backward Compatibility Guarantees

### Existing Web CRM

- ✅ All existing Booking, Customer, Driver, Vehicle fields preserved
- ✅ New fields added as optional (absence = defaults)
- ✅ Existing API routes continue unchanged
- ✅ No field renames or removals
- ✅ Indexes not dropped

### Existing Mobile Apps

- ✅ New `/mobile/v1/` routes do not interfere with `/api/` routes
- ✅ Old APK continues to work (with feature flags)
- ✅ Versioning: each API version maintained for 2 releases

### Database Migrations

- ✅ Additive only (no destructive changes)
- ✅ All existing data remains readable
- ✅ Rollback procedure documented
- ✅ Migration scripts reversible

---

## Summary

| Entity | Purpose | Indexed | Mobile | Notes |
|--------|---------|---------|--------|-------|
| Tenant | Isolation | ✅ | Yes | serviceModes config |
| Customer | Identity | ✅ | Yes | Phone normalized, blacklist |
| Booking | Unified booking | ✅ | Yes | One model for all types |
| DriverAssignment | Duty lifecycle | ✅ | Yes | NEW for mobile |
| SyncOperation | Offline sync | ✅ | Yes | NEW for offline |
| DeviceRegistration | Device tracking | ✅ | Yes | NEW for multi-device |
| Driver | Fleet asset | ✅ | Yes | Phone normalized |
| Vehicle | Fleet asset | ✅ | Partial | Status for queries |
| Payment | Transactions | ✅ | Yes | operationId for idempotency |

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-12  
**Source**: `/server/models/index.ts` (Mongoose schemas)  
**Next**: WAVE 2 (PhoneNormalizer + Blacklist implementation)
