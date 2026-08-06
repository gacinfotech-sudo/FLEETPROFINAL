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
  status: z.enum(['available', 'on_trip', 'maintenance']).default('available'),
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
  model: z.string().optional()
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
  vehicleId: z.string(),
  driverId: z.string().optional(),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  dropoffLocation: z.string().optional(),
  pickupDate: z.string(),
  returnDate: z.string().optional(),
  pickupTime: z.string().optional(),
  returnTime: z.string().optional(),
  bookingType: z.enum(['self_drive', 'with_driver', 'one_way', 'round_trip', 'local', 'airport']),
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
  fulfilmentType: z.enum(['own', 'vendor']).default('own'),
  vendorName: z.string().optional(),
  vendorContactPhone: z.string().optional(),
  vendorDriverName: z.string().optional(),
  vendorDriverPhone: z.string().optional(),
  vendorVehicleDetails: z.string().optional(),
  vendorAgreedRate: z.number().min(0).optional(),
  vendorAdvancePaid: z.number().min(0).optional(),
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