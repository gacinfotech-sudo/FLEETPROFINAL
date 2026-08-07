import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import mongoose from 'mongoose';
import { Tenant, User, Vehicle, Driver, Booking, Expense, VehicleBookingLock, ITenant, IUser, IVehicle, IDriver, IBooking, IExpense } from './models';
import { findVehicleConflicts, findDriverConflicts, findTentativeDraftConflicts, combineDateTime } from './services/availability';
import { resolveOwnFleetEligibility } from './vehicle/core/ownFleetEligibility';

export interface IStorage {
  // Auth methods
  getUserByCredentials(userId: string, password: string): Promise<IUser | undefined>;
  updateUserSession(id: string, sessionId: string | null, deviceInfo?: any): Promise<void>;
  getUserBySessionId(sessionId: string): Promise<IUser | undefined>;
  getUserSession(id: string): Promise<{ sessionId: string; deviceInfo?: any } | undefined>;
  resetUserPassword(id: string, newPassword: string): Promise<void>;
  adminResetUserPassword(userId: string, tempPassword: string): Promise<void>;
  updateUserLoginInfo(id: string, ip: string, userAgent: string): Promise<void>;

  // Tenant methods
  createTenant(tenant: Partial<ITenant>): Promise<ITenant>;
  getTenants(): Promise<ITenant[]>;
  getTenant(id: string): Promise<ITenant | undefined>;
  updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  // User methods
  createUser(user: any): Promise<IUser>;
  getUsers(): Promise<IUser[]>;
  getUser(id: string): Promise<IUser | undefined>;
  getUsersByTenant(tenantId: string): Promise<IUser[]>;
  updateUser(id: string, data: any): Promise<IUser | undefined>;
  deleteUser(id: string): Promise<void>;

  // Role-based methods
  createSubUser(userData: any, createdBy: string): Promise<IUser>;
  getSubUsersByTenant(tenantId: string): Promise<IUser[]>;
  deactivateSubUser(userId: string, deactivatedBy: string, tenantId?: string): Promise<void>;
  updateSubUserPermissions(userId: string, permissions: string[], tenantId?: string): Promise<IUser>;
  reactivateSubUser(userId: string, reactivatedBy: string, tenantId?: string): Promise<void>;
  checkUserPermission(userId: string, permission: string): Promise<boolean>;
  fixBookingAuditTrail(): Promise<number>;

  // Vehicle methods
  createVehicle(vehicle: any): Promise<IVehicle>;
  getVehiclesByTenant(tenantId: string): Promise<IVehicle[]>;
  getVehicle(id: string, tenantId?: string): Promise<IVehicle | undefined>;
  updateVehicle(id: string, data: any, tenantId?: string): Promise<IVehicle | undefined>;
  deleteVehicle(id: string, tenantId?: string): Promise<void>;
  getAvailableVehicles(tenantId: string, pickupDate: string, returnDate: string, pickupTime?: string, returnTime?: string): Promise<IVehicle[]>;

  // Driver methods
  createDriver(driver: any): Promise<IDriver>;
  getDriversByTenant(tenantId: string): Promise<IDriver[]>;
  getDriver(id: string, tenantId?: string): Promise<IDriver | undefined>;
  updateDriver(id: string, data: any, tenantId?: string): Promise<IDriver | undefined>;
  deleteDriver(id: string, tenantId?: string): Promise<void>;
  getAvailableDrivers(tenantId: string, pickupDate: string, returnDate: string): Promise<IDriver[]>;

  // Booking methods
  createBooking(booking: any): Promise<IBooking>;
  getBookingsByTenant(tenantId: string): Promise<IBooking[]>;
  getBooking(id: string, tenantId?: string): Promise<IBooking | undefined>;
  updateBooking(id: string, data: any, tenantId?: string): Promise<IBooking | undefined>;
  deleteBooking(id: string, tenantId?: string): Promise<void>;
  getUpcomingBookings(tenantId: string): Promise<IBooking[]>;
  getTenantStats(tenantId: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    fleetSize: number;
    activeDrivers: number;
  }>;
  getRevenueReport(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    averageBookingValue: number;
    revenuePerVehicle: number;
    fleetUtilization: number;
    revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
    revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
    topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
    completedBookings: number;
    expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  }>;
  markExpiredBookingsAsCompleted(): Promise<number>;

  // Enhanced Admin Methods for Manager Control
  getManagersByTenant(tenantId: string): Promise<IUser[]>;
  deactivateClientAndManagers(tenantId: string): Promise<void>;
  activateClientAndManagers(tenantId: string): Promise<void>;

  // Subscription Plan Management
  updateTenantPlan(tenantId: string, plan: string, limits: { vehicles: number; drivers: number; managers: number; }): Promise<ITenant | undefined>;
  getTenantLimits(tenantId: string): Promise<{ vehicles: number; drivers: number; managers: number; } | null>;
  checkVehicleLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;
  checkDriverLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;
  checkManagerLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }>;

  // Onboarding methods
  markOnboardingComplete(userId: string): Promise<void>;

  // Expense methods
  createExpense(expense: any): Promise<IExpense>;
  getExpensesByTenant(tenantId: string): Promise<IExpense[]>;
  getExpense(id: string, tenantId?: string): Promise<IExpense | undefined>;
  updateExpense(id: string, data: any, tenantId?: string): Promise<IExpense | undefined>;
  deleteExpense(id: string, tenantId?: string): Promise<void>;
  getTotalExpenses(tenantId: string, startDate?: string, endDate?: string): Promise<number>;
}

// Serializes concurrent createBooking() calls for the same vehicle when running
// against a standalone (non-replica-set) MongoDB, where session.withTransaction()
// throws and createBooking() falls back to a non-atomic check-then-insert — without
// this, two requests can both pass the conflict check before either saves,
// double-booking the vehicle. Acquisition is a single atomic insert on a unique _id
// (tenantId:vehicleId), so it holds even across multiple server processes; the
// lock's own TTL index (models/index.ts) cleans up if a process crashes mid-lock.
async function withVehicleLock<T>(tenantId: string, vehicleId: string, fn: () => Promise<T>): Promise<T> {
  const lockId = `${tenantId}:${vehicleId}`;
  const maxAttempts = 40;
  let acquired = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await VehicleBookingLock.create({ _id: lockId });
      acquired = true;
      break;
    } catch (err: any) {
      if (err?.code === 11000) {
        await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
        continue;
      }
      throw err;
    }
  }
  if (!acquired) {
    throw new Error('Could not acquire vehicle booking lock — another booking attempt is still in progress for this vehicle.');
  }
  try {
    return await fn();
  } finally {
    await VehicleBookingLock.deleteOne({ _id: lockId }).catch(() => {});
  }
}

export class MongoDBStorage implements IStorage {
  constructor() {}

  // Auth methods
  async getUserByCredentials(userId: string, password: string): Promise<IUser | undefined> {
    try {
      // userId is always stored lowercase (see createUser); matching the same
      // way lets this use the {userId: 1} index instead of an unindexed
      // case-insensitive regex scan of the whole collection.
      const user = await User.findOne({
        userId: userId.toLowerCase()
      }).populate('tenantId');

      if (!user) return undefined;

      // Password remains case-sensitive
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) return undefined;
      return user;
    } catch (error) {
      console.error('Error getting user by credentials:', error);
      return undefined;
    }
  }

  async updateUserSession(id: string, sessionId: string | null, deviceInfo?: any): Promise<void> {
    try {
      const updateData: any = { 
        sessionId,
        lastLogin: sessionId ? new Date() : undefined 
      };
      
      if (deviceInfo) {
        updateData.deviceInfo = deviceInfo;
      }
      
      await User.findByIdAndUpdate(id, updateData);
    } catch (error) {
      console.error('Error updating user session:', error);
      throw error;
    }
  }

  async getUserSession(id: string): Promise<{ sessionId: string; deviceInfo?: any } | undefined> {
    try {
      const user = await User.findById(id).select('sessionId deviceInfo');
      if (user && user.sessionId) {
        return {
          sessionId: user.sessionId,
          deviceInfo: user.deviceInfo
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user session:', error);
      return undefined;
    }
  }

  async getUserBySessionId(sessionId: string): Promise<IUser | undefined> {
    try {
      const user = await User.findOne({ sessionId }).populate('tenantId') || undefined;

      if (user) {
        console.log('User loaded by sessionId:', {
          userId: user.userId,
          role: user.role,
          tenantId: user.tenantId,
          tenantIdType: typeof user.tenantId
        });
      }

      return user;
    } catch (error) {
      console.error('Error getting user by session ID:', error);
      return undefined;
    }
  }

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await User.findByIdAndUpdate(id, { 
        password: hashedPassword,
        mustResetPassword: false,
        sessionId: null // Clear session to force re-login
      });
    } catch (error) {
      console.error('Error resetting user password:', error);
      throw error;
    }
  }

  async adminResetUserPassword(userId: string, tempPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(tempPassword, 12);
      await User.findByIdAndUpdate(userId, { 
        password: hashedPassword,
        mustResetPassword: true,
        sessionId: null // Clear session to force re-login
      });
    } catch (error) {
      console.error('Error admin resetting password:', error);
      throw error;
    }
  }

  async updateUserLoginInfo(id: string, ip: string, userAgent: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(id, {
        lastLogin: new Date(),
        lastLoginIP: ip,
        lastLoginUserAgent: userAgent
      });
    } catch (error) {
      console.error('Error updating user login info:', error);
      throw error;
    }
  }

  // Tenant methods
  async createTenant(tenantData: Partial<ITenant>): Promise<ITenant> {
    try {
      const tenant = new Tenant(tenantData);
      return await tenant.save();
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  async getTenants(): Promise<ITenant[]> {
    try {
      return await Tenant.find({}).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting tenants:', error);
      throw error;
    }
  }

  async getTenant(id: string): Promise<ITenant | undefined> {
    try {
      return await Tenant.findById(id) || undefined;
    } catch (error) {
      console.error('Error getting tenant:', error);
      return undefined;
    }
  }

  async updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant | undefined> {
    try {
      return await Tenant.findByIdAndUpdate(id, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating tenant:', error);
      return undefined;
    }
  }

  async deleteTenant(id: string): Promise<void> {
    try {
      await Tenant.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // User methods
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      // Store user ID in lowercase for consistency
      if (userData.userId) {
        userData.userId = userData.userId.toLowerCase();
      }

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }
      userData.mustResetPassword = true; // New users must reset password

      // Convert tenantId string to ObjectId if provided
      if (userData.tenantId && typeof userData.tenantId === 'string') {
        console.log('Converting tenantId from string to ObjectId:', userData.tenantId);
        userData.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }

      console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });

      const user = new User(userData);
      const savedUser = await user.save();

      console.log('User created successfully:', { 
        id: savedUser._id, 
        userId: savedUser.userId, 
        tenantId: savedUser.tenantId 
      });

      return savedUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUsers(): Promise<IUser[]> {
    try {
      return await User.find({}).populate('tenantId').sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<IUser | undefined> {
    try {
      // Check if id is a valid ObjectId, if not search by userId
      if (mongoose.Types.ObjectId.isValid(id)) {
        return await User.findById(id).populate('tenantId') || undefined;
      } else {
        // Search by userId field for non-ObjectId strings like "admin"
        return await User.findOne({ userId: id }).populate('tenantId') || undefined;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUsersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      return await User.find({ tenantId }).populate('tenantId');
    } catch (error) {
      console.error('Error getting users by tenant:', error);
      throw error;
    }
  }

  async updateUser(id: string, data: Partial<IUser>): Promise<IUser | undefined> {
    try {
      // Store user ID in lowercase for consistency
      if (data.userId) {
        data.userId = data.userId.toLowerCase();
      }

      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }

      return await User.findByIdAndUpdate(id, data, { new: true }).populate('tenantId') || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await User.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Vehicle methods
  async createVehicle(vehicleData: any): Promise<IVehicle> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (vehicleData.tenantId && typeof vehicleData.tenantId === 'string') {
        vehicleData.tenantId = new mongoose.Types.ObjectId(vehicleData.tenantId);
      }

      const vehicle = new Vehicle(vehicleData);
      return await vehicle.save();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  async getVehiclesByTenant(tenantId: string): Promise<IVehicle[]> {
    try {
      return await Vehicle.find({ tenantId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting vehicles by tenant:', error);
      throw error;
    }
  }

  // P0 SECURITY FIX: `tenantId` is optional only so admin-only call sites
  // (which legitimately operate cross-tenant) can omit it. Every route that
  // serves a non-admin/tenant user MUST pass req.tenantId here. Without this
  // scoping, any authenticated user could read/modify/delete another
  // tenant's vehicles simply by guessing/enumerating ids (IDOR).
  async getVehicle(id: string, tenantId?: string): Promise<IVehicle | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Vehicle.findOne(query) || undefined;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      return undefined;
    }
  }

  async updateVehicle(id: string, data: any, tenantId?: string): Promise<IVehicle | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }
      // Never allow a request body to move a record to a different tenant.
      if (tenantId) delete data.tenantId;

      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Vehicle.findOneAndUpdate(query, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      return undefined;
    }
  }

  async deleteVehicle(id: string, tenantId?: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      await Vehicle.findOneAndDelete(query);
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  // P0 FIX (flexible-fulfilment initiative, docs/FLEXIBLE_PIPELINE_CURRENT_AUDIT.md
  // §2): this used to compare bare pickupDate/returnDate (midnight-only)
  // and only excluded status:'confirmed' bookings — a real, if narrow,
  // contributor to the "no vehicles available" dead-end, since a vehicle
  // free for the actual requested time window could still be reported
  // unavailable by a same-day-but-non-overlapping booking, or (opposite
  // direction) show as available despite an active non-'confirmed' hold.
  // Now delegates to findVehicleConflicts — the same full-datetime,
  // full-occupying-status conflict check already used by booking creation
  // and the Availability Engine — instead of a separate, divergent query.
  async getAvailableVehicles(tenantId: string, pickupDate: string, returnDate: string, pickupTime?: string, returnTime?: string): Promise<IVehicle[]> {
    try {
      const start = combineDateTime(pickupDate, pickupTime);
      const end = combineDateTime(returnDate, returnTime);

      const candidates = await Vehicle.find({ tenantId, status: 'available' }).sort({ createdAt: -1 });
      const availability = await Promise.all(candidates.map(async (v) => {
        const conflicts = await findVehicleConflicts(tenantId, v.id, start, end);
        if (conflicts.length > 0) return false;
        // TASK-VEHICLE-SAFETY-ELIGIBILITY: exclude SAFETY_HOLD vehicles from
        // the own-fleet picker's candidate list, matching the exact pattern
        // this list already uses for every other ineligible state
        // (maintenance/on-trip via the `status: 'available'` filter above,
        // already-assigned via the overlap check just above) — plain
        // exclusion, not a disabled-with-reason entry (that pattern is only
        // used for drivers elsewhere in this app). Every candidate here is
        // already known-`status: 'available'`, so `knownOperationalStatus`
        // is passed for a fully real (not neutral-placeholder) evaluation.
        const eligibility = await resolveOwnFleetEligibility(tenantId, v.id, { knownOperationalStatus: 'AVAILABLE' });
        return eligibility.eligible;
      }));
      return candidates.filter((_v, i) => availability[i]);
    } catch (error) {
      console.error('Error getting available vehicles:', error);
      throw error;
    }
  }

  // Driver methods
  async createDriver(driverData: any): Promise<IDriver> {
    try {
      // Convert tenantId string to ObjectId if provided
      if (driverData.tenantId && typeof driverData.tenantId === 'string') {
        driverData.tenantId = new mongoose.Types.ObjectId(driverData.tenantId);
      }

      const driver = new Driver(driverData);
      return await driver.save();
    } catch (error) {
      console.error('Error creating driver:', error);
      throw error;
    }
  }

  async getDriversByTenant(tenantId: string): Promise<IDriver[]> {
    try {
      return await Driver.find({ tenantId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting drivers by tenant:', error);
      throw error;
    }
  }

  // P0 SECURITY FIX: see getVehicle() above for the tenant-scoping rationale.
  async getDriver(id: string, tenantId?: string): Promise<IDriver | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Driver.findOne(query) || undefined;
    } catch (error) {
      console.error('Error getting driver:', error);
      return undefined;
    }
  }

  async updateDriver(id: string, data: any, tenantId?: string): Promise<IDriver | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      // Convert tenantId string to ObjectId if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }
      if (tenantId) delete data.tenantId;

      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Driver.findOneAndUpdate(query, data, { new: true }) || undefined;
    } catch (error) {
      console.error('Error updating driver:', error);
      return undefined;
    }
  }

  async deleteDriver(id: string, tenantId?: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      await Driver.findOneAndDelete(query);
    } catch (error) {
      console.error('Error deleting driver:', error);
      throw error;
    }
  }

  async getAvailableDrivers(tenantId: string, pickupDate: string, returnDate: string): Promise<IDriver[]> {
    try {
      const pickup = new Date(pickupDate);
      const returnD = new Date(returnDate);

      // Find drivers that are not booked during the requested period
      const bookedDriverIds = await Booking.distinct('driverId', {
        tenantId,
        driverId: { $ne: null },
        status: { $in: ['confirmed'] },
        $or: [
          {
            pickupDate: { $lte: returnD },
            returnDate: { $gte: pickup }
          }
        ]
      });

      return await Driver.find({
        tenantId,
        status: 'available',
        _id: { $nin: bookedDriverIds }
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting available drivers:', error);
      throw error;
    }
  }

  // Booking methods
  // P0 FIX: previously there was NO check that a VEHICLE wasn't already
  // booked for the requested window before creating a new booking, and no
  // check at all — ever — for the DRIVER. Two concurrent bookings for the
  // same vehicle or the SAME DRIVER overlapping in time would both
  // succeed silently (double-booking) — e.g. a driver assigned 2pm-10pm
  // could be assigned again 3pm-11pm the same day with zero backend
  // resistance, because this path never called the availability service
  // that every other mutation route (edit, extend) already used. Both
  // checks now share the same overlap logic as the rest of the app
  // (services/availability.ts) and run inside the SAME Mongo transaction
  // as the insert, so where the deployment target is a replica set
  // (required for transactions — most managed Atlas clusters are), two
  // near-simultaneous requests can't both pass the check before either
  // commits. On a standalone MongoDB instance (transactions unsupported)
  // we fall back to the same check without transactional atomicity — this
  // narrows but does not fully eliminate the race window, which is called
  // out explicitly in IMPLEMENTATION_PLAN.md.
  async createBooking(bookingData: any): Promise<IBooking> {
    if (!bookingData.bookingId) {
      // nanoid suffix avoids collisions when two bookings are created in
      // the same millisecond under load (Date.now() alone is not unique).
      bookingData.bookingId = `BK${Date.now()}${nanoid(4).toUpperCase()}`;
    }

    // Convert string IDs to ObjectIds if provided
    if (bookingData.tenantId && typeof bookingData.tenantId === 'string') {
      bookingData.tenantId = new mongoose.Types.ObjectId(bookingData.tenantId);
    }
    if (bookingData.vehicleId && typeof bookingData.vehicleId === 'string') {
      bookingData.vehicleId = new mongoose.Types.ObjectId(bookingData.vehicleId);
    }
    // Only process driverId if it's a valid non-empty string
    if (bookingData.driverId && typeof bookingData.driverId === 'string' && bookingData.driverId.trim() !== '') {
      bookingData.driverId = new mongoose.Types.ObjectId(bookingData.driverId);
    } else {
      // Remove driverId completely if it's empty or invalid
      delete bookingData.driverId;
    }

    // Combined date+time instants — see availability.ts's combineDateTime
    // comment for why a bare pickupDate is not safe to use here.
    const start = bookingData.pickupDate ? combineDateTime(bookingData.pickupDate, bookingData.pickupTime) : undefined;
    const end = bookingData.returnDate
      ? combineDateTime(bookingData.returnDate, bookingData.returnTime)
      : start;
    const checkVehicleOverlap = bookingData.vehicleId && start && end;
    const checkDriverOverlap = bookingData.driverId && start && end;

    const runCreate = async (session?: mongoose.ClientSession) => {
      if (checkVehicleOverlap) {
        const conflicts = await findVehicleConflicts(
          bookingData.tenantId.toString(), bookingData.vehicleId.toString(), start!, end!, undefined, session
        );
        if (conflicts.length > 0) {
          const err: any = new Error(
            `Vehicle is already booked for an overlapping period (conflicting booking ${conflicts[0].bookingId}).`
          );
          err.code = 'VEHICLE_DOUBLE_BOOKING';
          err.conflict = conflicts[0];
          throw err;
        }

        // Zero-overlap guard for the in-between window a real Booking
        // document can't see: another user has this exact vehicle
        // provisionally selected, for overlapping dates, in their own
        // still-open Add Booking wizard right now (see
        // findTentativeDraftConflicts). Excludes the current user's own
        // draft — finishing your own booking is never blocked by your own
        // in-progress work.
        const draftConflicts = await findTentativeDraftConflicts(
          bookingData.tenantId.toString(), bookingData.vehicleId.toString(), start!, end!,
          bookingData.createdBy?.userId, session
        );
        if (draftConflicts.length > 0) {
          const err: any = new Error(
            `This vehicle is currently being booked by another user for an overlapping period. Please try again shortly or choose a different vehicle.`
          );
          err.code = 'VEHICLE_TENTATIVELY_HELD';
          throw err;
        }
      }

      if (checkDriverOverlap) {
        const conflicts = await findDriverConflicts(
          bookingData.tenantId.toString(), bookingData.driverId.toString(), start!, end!, undefined, session
        );
        if (conflicts.length > 0) {
          const c = conflicts[0];
          const err: any = new Error(
            `This driver is already assigned to booking ${c.bookingId} from ${c.pickupTime || '?'} to ${c.returnTime || '?'}.`
          );
          err.code = 'DRIVER_TIME_CONFLICT';
          err.conflict = c;
          throw err;
        }
      }

      // TASK-VEHICLE-SAFETY-ELIGIBILITY: real server-side enforcement, not
      // just UI filtering — a SAFETY_HOLD own-fleet vehicle (unresolved
      // CRITICAL Daily Inspection defect) can never be assigned to a new
      // booking, even via a direct API call that bypasses the picker
      // entirely. Evaluated live, inside this same create path/transaction
      // — this is what makes it a real "final confirmation" recheck rather
      // than trusting whatever was true when an Add Booking form was
      // opened: a vehicle that became SAFETY_HOLD in between is caught
      // here regardless. Only runs when an own-fleet vehicleId is actually
      // being assigned — a booking captured via any other resource path
      // (Allocation Pending / Vendor Vehicle / Outsource / Tentative /
      // Quote Only, i.e. no vehicleId) is completely unaffected.
      if (bookingData.vehicleId) {
        const eligibility = await resolveOwnFleetEligibility(
          bookingData.tenantId.toString(), bookingData.vehicleId.toString(), { session }
        );
        if (eligibility.safetyHold) {
          const err: any = new Error(
            'This vehicle is on Safety Hold due to an unresolved critical Daily Inspection defect and cannot be assigned to a new booking. Resolve the defect or choose a different vehicle / allocation path (Allocation Pending, Vendor, Outsource).'
          );
          err.code = 'VEHICLE_SAFETY_HOLD';
          err.openCriticalDefects = eligibility.openCriticalDefects;
          throw err;
        }
      }

      const booking = new Booking(bookingData);
      const savedBooking = await booking.save({ session });

      // Limit to 200,000 bookings per tenant
      const bookingCount = await Booking.countDocuments({ tenantId: bookingData.tenantId }).session(session ?? null);
      if (bookingCount > 200000) {
        const oldestBooking = await Booking.findOne({ tenantId: bookingData.tenantId })
          .sort({ createdAt: 1 })
          .session(session ?? null);
        if (oldestBooking) {
          await Booking.findByIdAndDelete(oldestBooking._id).session(session ?? null);
        }
      }

      return savedBooking as unknown as IBooking;
    };

    try {
      const session = await mongoose.startSession();
      try {
        let result: IBooking | undefined;
        await session.withTransaction(async () => {
          result = await runCreate(session);
        });
        return result!;
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      // Standalone MongoDB (no replica set) does not support transactions;
      // fall back to a best-effort, non-transactional check-then-insert, made safe
      // against concurrent double-booking of the same vehicle via withVehicleLock.
      if (typeof error?.message === 'string' && error.message.includes('Transaction numbers')) {
        try {
          if (checkVehicleOverlap) {
            return await withVehicleLock(bookingData.tenantId.toString(), bookingData.vehicleId.toString(), () => runCreate(undefined));
          }
          return await runCreate(undefined);
        } catch (fallbackError) {
          console.error('Error creating booking (no-transaction fallback):', fallbackError);
          throw fallbackError;
        }
      }
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getBookingsByTenant(tenantId: string): Promise<IBooking[]> {
    try {
      return await Booking.find({ tenantId })
        .populate('vehicleId')
        .populate('driverId')
        .sort({ createdAt: -1 })
        .lean() as unknown as IBooking[]; // populated lean objects intentionally cross the document interface boundary
    } catch (error) {
      console.error('Error getting bookings by tenant:', error);
      throw error;
    }
  }

  // P0 SECURITY FIX: see getVehicle() above for the tenant-scoping rationale.
  async getBooking(id: string, tenantId?: string): Promise<IBooking | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Booking.findOne(query)
        .populate('vehicleId')
        .populate('driverId')
        .lean() as unknown as IBooking || undefined;
    } catch (error) {
      console.error('Error getting booking:', error);
      return undefined;
    }
  }

  async updateBooking(id: string, data: any, tenantId?: string): Promise<IBooking | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      // Convert string IDs to ObjectIds if provided
      if (data.tenantId && typeof data.tenantId === 'string') {
        data.tenantId = new mongoose.Types.ObjectId(data.tenantId);
      }
      if (data.vehicleId && typeof data.vehicleId === 'string') {
        data.vehicleId = new mongoose.Types.ObjectId(data.vehicleId);
      }
      if (data.driverId && typeof data.driverId === 'string') {
        data.driverId = new mongoose.Types.ObjectId(data.driverId);
      }
      // Never allow a request body to move a record to a different tenant.
      if (tenantId) delete data.tenantId;

      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      return await Booking.findOneAndUpdate(query, data, { new: true })
        .populate('vehicleId')
        .populate('driverId') || undefined;
    } catch (error) {
      console.error('Error updating booking:', error);
      return undefined;
    }
  }

  async deleteBooking(id: string, tenantId?: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      await Booking.findOneAndDelete(query);
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  }

  async getUpcomingBookings(tenantId: string): Promise<IBooking[]> {
    try {
      const now = new Date();
      return await Booking.find({
        tenantId,
        status: 'confirmed',
        pickupDate: { $gte: now }
      })
        .populate('vehicleId')
        .populate('driverId')
        .sort({ pickupDate: 1 })
        .lean() as unknown as IBooking[];
    } catch (error) {
      console.error('Error getting upcoming bookings:', error);
      throw error;
    }
  }

  async markExpiredBookingsAsCompleted(): Promise<number> {
    try {
      const now = new Date();
      const result = await Booking.updateMany(
        {
          status: 'confirmed',
          returnDate: { $lt: now }
        },
        { status: 'completed' }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking expired bookings:', error);
      return 0;
    }
  }

  async getTenantStats(tenantId: string): Promise<{
    totalRevenue: number;
    totalBookings: number;
    fleetSize: number;
    activeDrivers: number;
  }> {
    try {
      const [revenueResult, totalBookings, fleetSize, activeDrivers] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              tenantId: new mongoose.Types.ObjectId(tenantId),
              status: { $in: ['confirmed', 'completed'] }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              }
            }
          }
        ]),
        Booking.countDocuments({ tenantId }),
        Vehicle.countDocuments({ tenantId, status: 'available' }),
        Driver.countDocuments({ tenantId, status: 'available' })
      ]);

      return {
        totalRevenue: revenueResult[0]?.totalRevenue || 0,
        totalBookings,
        fleetSize,
        activeDrivers
      };
    } catch (error) {
      console.error('Error getting tenant stats:', error);
      throw error;
    }
  }

  async getRevenueReport(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    averageBookingValue: number;
    revenuePerVehicle: number;
    fleetUtilization: number;
    revenueByVehicleType: Array<{ type: string; revenue: number; count: number }>;
    revenueByBookingType: Array<{ type: string; revenue: number; count: number }>;
    topPerformingVehicles: Array<{ vehicle: any; revenue: number; bookings: number }>;
    completedBookings: number;
    expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  }> {
    try {
      // Base condition: Only completed bookings for revenue calculation
      const matchConditions: any = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'completed'
      };

      // Date filtering based on returnDate (end date) for completed bookings
      if (startDate && endDate) {
        matchConditions.returnDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z') // Include entire end date
        };
      }

      // Expense date filter (matching booking date range)
      let expenseQuery: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };
      if (startDate && endDate) {
        expenseQuery.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        };
      }

      const [
        revenueResult,
        revenueByVehicleType,
        revenueByBookingType,
        topPerformingVehicles,
        fleetSize,
        completedBookings,
        totalExpenses,
        expensesByCategory
      ] = await Promise.all([
        Booking.aggregate([
          { $match: matchConditions },
          {
            $group: {
              _id: null,
              totalRevenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              totalBookings: { $sum: 1 }
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'vehicleId',
              foreignField: '_id',
              as: 'vehicle'
            }
          },
          { $unwind: '$vehicle' },
          {
            $group: {
              _id: '$vehicle.type',
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              type: '$_id',
              revenue: 1,
              count: 1,
              _id: 0
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $group: {
              _id: '$bookingType',
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              type: '$_id',
              revenue: 1,
              count: 1,
              _id: 0
            }
          }
        ]),
        Booking.aggregate([
          { $match: matchConditions },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'vehicleId',
              foreignField: '_id',
              as: 'vehicle'
            }
          },
          { $unwind: '$vehicle' },
          {
            $group: {
              _id: '$vehicleId',
              vehicle: { $first: '$vehicle' },
              revenue: { 
                $sum: { $ifNull: ['$totalAmount', 0] }
              },
              bookings: { $sum: 1 }
            }
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          {
            $project: {
              vehicle: 1,
              revenue: 1,
              bookings: 1,
              _id: 0
            }
          }
        ]),
        Vehicle.countDocuments({ tenantId }),
        Booking.countDocuments(matchConditions), // Already filtered by completed status
        // Total expenses calculation
        Expense.aggregate([
          { $match: expenseQuery },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        // Expenses by category
        Expense.aggregate([
          { $match: expenseQuery },
          {
            $group: {
              _id: '$category',
              amount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              category: '$_id',
              amount: 1,
              count: 1,
              _id: 0
            }
          }
        ])
      ]);

      const stats = revenueResult[0] || { totalRevenue: 0, totalBookings: 0 };
      const totalRevenue = stats.totalRevenue;
      const totalBookings = stats.totalBookings;
      const totalExpensesValue = totalExpenses[0]?.total || 0;
      const netRevenue = totalRevenue - totalExpensesValue;

      // Calculate proper fleet utilization (percentage of vehicles with bookings)
      let fleetUtilization = 0;
      if (fleetSize > 0) {
        // Get unique vehicles that have bookings
        const vehiclesWithBookings = await Booking.distinct('vehicleId', matchConditions);
        console.log('Fleet Utilization Debug:', {
          fleetSize,
          uniqueVehiclesWithBookings: vehiclesWithBookings.length,
          vehicleIds: vehiclesWithBookings
        });
        fleetUtilization = (vehiclesWithBookings.length / fleetSize) * 100;
        // Ensure it doesn't exceed 100%
        fleetUtilization = Math.min(fleetUtilization, 100);
        console.log('Calculated fleet utilization:', fleetUtilization);
      }

      return {
        totalRevenue,
        totalExpenses: totalExpensesValue,
        netRevenue,
        averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
        revenuePerVehicle: fleetSize > 0 ? totalRevenue / fleetSize : 0,
        fleetUtilization,
        revenueByVehicleType,
        revenueByBookingType,
        topPerformingVehicles,
        completedBookings,
        expensesByCategory
      };
    } catch (error) {
      console.error('Error getting revenue report:', error);
      throw error;
    }
  }

  // Role-based methods
  async createSubUser(userData: any, createdBy: string): Promise<IUser> {
    try {
      // Store user ID in lowercase for consistency
      if (userData.userId) {
        userData.userId = userData.userId.toLowerCase();
      }

      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 12);
      }

      // Set default permissions for manager role
      if (userData.role === 'manager' && !userData.permissions) {
        userData.permissions = [
          'create_booking',
          'delete_booking',
          'generate_invoice',
          'view_bookings',
          'edit_booking'
        ];
      }

      // Set createdBy field
      userData.createdBy = createdBy;
      userData.mustResetPassword = true; // New sub-users must reset password

      // Convert tenantId string to ObjectId if provided
      if (userData.tenantId && typeof userData.tenantId === 'string') {
        userData.tenantId = new mongoose.Types.ObjectId(userData.tenantId);
      }

      console.log('Creating sub-user with data:', { ...userData, password: '[HIDDEN]' });

      const user = new User(userData);
      const savedUser = await user.save();

      console.log('Sub-user created successfully:', { 
        id: savedUser._id, 
        userId: savedUser.userId, 
        role: savedUser.role,
        createdBy: savedUser.createdBy 
      });

      return savedUser;
    } catch (error) {
      console.error('Error creating sub-user:', error);
      throw error;
    }
  }

  async getSubUsersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
      return await User.find({ 
        tenantId: tenantObjectId, 
        role: { $in: ['manager'] } // Only get sub-users, not admins or clients
      }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting sub-users by tenant:', error);
      throw error;
    }
  }

  // P0 SECURITY FIX: previously scoped only by `userId` (the human-readable
  // login id), with no tenant check — any authenticated client/admin could
  // deactivate or reactivate a manager belonging to a DIFFERENT tenant by
  // guessing/enumerating their userId. Now requires the target user to
  // belong to the caller's tenant (unless tenantId is omitted for admin use).
  async deactivateSubUser(userId: string, deactivatedBy: string, tenantId?: string): Promise<void> {
    try {
      const query: any = { userId: userId.toLowerCase(), role: 'manager' };
      if (tenantId) query.tenantId = tenantId;
      const result = await User.findOneAndUpdate(
        query,
        {
          isActive: false,
          sessionId: null // Clear session to force logout
        }
      );
      if (!result) {
        throw new Error('Sub-user not found in this tenant');
      }
      console.log(`Sub-user ${userId} deactivated by ${deactivatedBy}`);
    } catch (error) {
      console.error('Error deactivating sub-user:', error);
      throw error;
    }
  }

  // Tenant-scoped for the same reason as deactivateSubUser above — a
  // manager belongs to exactly one tenant and must only be editable by that
  // tenant's admin/client.
  async updateSubUserPermissions(userId: string, permissions: string[], tenantId?: string): Promise<IUser> {
    try {
      const query: any = { userId: userId.toLowerCase(), role: 'manager' };
      if (tenantId) query.tenantId = tenantId;
      const result = await User.findOneAndUpdate(
        query,
        { permissions },
        { new: true },
      );
      if (!result) {
        throw new Error('Sub-user not found in this tenant');
      }
      return result;
    } catch (error) {
      console.error('Error updating sub-user permissions:', error);
      throw error;
    }
  }

  async reactivateSubUser(userId: string, reactivatedBy: string, tenantId?: string): Promise<void> {
    try {
      const query: any = { userId: userId.toLowerCase(), role: 'manager' };
      if (tenantId) query.tenantId = tenantId;
      const result = await User.findOneAndUpdate(
        query,
        {
          isActive: true
        }
      );
      if (!result) {
        throw new Error('Sub-user not found in this tenant');
      }
      console.log(`Sub-user ${userId} reactivated by ${reactivatedBy}`);
    } catch (error) {
      console.error('Error reactivating sub-user:', error);
      throw error;
    }
  }

  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await User.findOne({ userId: userId.toLowerCase() });
      if (!user || !user.isActive) {
        return false;
      }

      // Admin and client roles have full permissions
      if (user.role === 'admin' || user.role === 'client') {
        return true;
      }

      // Check if user has wildcard permission or specific permission
      return user.permissions.includes('*') || user.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  async fixBookingAuditTrail(): Promise<number> {
    try {
      const result = await Booking.updateMany(
        { createdBy: { $exists: false } },
        { 
          $set: { 
            createdBy: {
              userId: 'System',
              role: 'admin'
            }
          }
        }
      );
      console.log(`Fixed ${result.modifiedCount} bookings without audit trail`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error fixing booking audit trail:', error);
      return 0;
    }
  }

  // Enhanced Admin Methods for Manager Control
  async getManagersByTenant(tenantId: string): Promise<IUser[]> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const managers = await User.find({ 
        tenantId: objectId,
        role: 'manager'
      }).sort({ createdAt: -1 });
      return managers;
    } catch (error) {
      console.error('Error getting managers by tenant:', error);
      throw error;
    }
  }

  async deactivateClientAndManagers(tenantId: string): Promise<void> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);

      // Deactivate tenant
      await Tenant.findByIdAndUpdate(objectId, { isActive: false });

      // Deactivate client user and all managers for this tenant
      await User.updateMany(
        { tenantId: objectId },
        { isActive: false }
      );

      console.log(`Deactivated tenant ${tenantId} and all associated users`);
    } catch (error) {
      console.error('Error deactivating client and managers:', error);
      throw error;
    }
  }

  async activateClientAndManagers(tenantId: string): Promise<void> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);

      // Activate tenant
      await Tenant.findByIdAndUpdate(objectId, { isActive: true });

      // Activate client user and all managers for this tenant
      await User.updateMany(
        { tenantId: objectId },
        { isActive: true }
      );

      console.log(`Activated tenant ${tenantId} and all associated users`);
    } catch (error) {
      console.error('Error activating client and managers:', error);
      throw error;
    }
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    console.log('Marking onboarding complete for userId:', userId);

    const user = await User.findOne({ userId });
    if (!user) {
      console.error('User not found for onboarding completion:', userId);
      throw new Error("User not found");
    }

    console.log('Current onboarding status:', user.hasCompletedOnboarding);
    user.hasCompletedOnboarding = true;
    await user.save();
    console.log('Onboarding marked complete for user:', userId);
  }

  // Subscription Plan Management Methods
  async updateTenantPlan(tenantId: string, plan: string, limits: { vehicles: number; drivers: number; managers: number; }): Promise<ITenant | undefined> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const updatedTenant = await Tenant.findByIdAndUpdate(
        objectId,
        { 
          subscriptionPlan: plan,
          limits: limits,
          maxManagers: limits.managers // Keep backward compatibility
        },
        { new: true }
      );
      return updatedTenant || undefined;
    } catch (error) {
      console.error('Error updating tenant plan:', error);
      throw error;
    }
  }

  async getTenantLimits(tenantId: string): Promise<{ vehicles: number; drivers: number; managers: number; } | null> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const tenant = await Tenant.findById(objectId);
      if (!tenant) return null;
      
      return {
        vehicles: tenant.limits?.vehicles || 6, // Default starter limits
        drivers: tenant.limits?.drivers || 3,
        managers: tenant.limits?.managers || 1
      };
    } catch (error) {
      console.error('Error getting tenant limits:', error);
      return null;
    }
  }

  async checkVehicleLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const vehicleCount = await Vehicle.countDocuments({ tenantId: objectId });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.vehicles || 6;
      
      return {
        current: vehicleCount,
        limit: limit,
        canAdd: vehicleCount < limit
      };
    } catch (error) {
      console.error('Error checking vehicle limit:', error);
      return { current: 0, limit: 6, canAdd: true };
    }
  }

  async checkDriverLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const driverCount = await Driver.countDocuments({ tenantId: objectId });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.drivers || 3;
      
      return {
        current: driverCount,
        limit: limit,
        canAdd: driverCount < limit
      };
    } catch (error) {
      console.error('Error checking driver limit:', error);
      return { current: 0, limit: 3, canAdd: true };
    }
  }

  async checkManagerLimit(tenantId: string): Promise<{ current: number; limit: number; canAdd: boolean; }> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const managerCount = await User.countDocuments({ 
        tenantId: objectId,
        role: 'manager'
      });
      const limits = await this.getTenantLimits(tenantId);
      const limit = limits?.managers || 1;
      
      return {
        current: managerCount,
        limit: limit,
        canAdd: managerCount < limit
      };
    } catch (error) {
      console.error('Error checking manager limit:', error);
      return { current: 0, limit: 1, canAdd: true };
    }
  }

  // Expense methods
  async createExpense(expenseData: any): Promise<IExpense> {
    try {
      const expense = new Expense({
        ...expenseData,
        tenantId: new mongoose.Types.ObjectId(expenseData.tenantId),
        vehicleId: new mongoose.Types.ObjectId(expenseData.vehicleId),
        createdAt: new Date()
      });
      await expense.save();
      return expense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async getExpensesByTenant(tenantId: string): Promise<IExpense[]> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      const expenses = await Expense.find({ tenantId: objectId })
        .populate('vehicleId', 'make vehicleModel licensePlate')
        .sort({ date: -1, createdAt: -1 });
      return expenses;
    } catch (error) {
      console.error('Error getting expenses by tenant:', error);
      throw error;
    }
  }

  // P0 SECURITY FIX: see getVehicle() above for the tenant-scoping rationale.
  async getExpense(id: string, tenantId?: string): Promise<IExpense | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      const expense = await Expense.findOne(query)
        .populate('vehicleId', 'make vehicleModel licensePlate');
      return expense || undefined;
    } catch (error) {
      console.error('Error getting expense:', error);
      throw error;
    }
  }

  async updateExpense(id: string, data: any, tenantId?: string): Promise<IExpense | undefined> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return undefined;
      if (data.vehicleId) {
        data.vehicleId = new mongoose.Types.ObjectId(data.vehicleId);
      }
      if (tenantId) delete data.tenantId;

      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      const expense = await Expense.findOneAndUpdate(query, data, { new: true })
        .populate('vehicleId', 'make vehicleModel licensePlate');
      return expense || undefined;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(id: string, tenantId?: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) return;
      const query: any = { _id: id };
      if (tenantId) query.tenantId = tenantId;
      await Expense.findOneAndDelete(query);
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  async getTotalExpenses(tenantId: string, startDate?: string, endDate?: string): Promise<number> {
    try {
      const objectId = new mongoose.Types.ObjectId(tenantId);
      
      let query: any = { tenantId: objectId };
      
      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        };
      }
      
      const result = await Expense.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      return result.length > 0 ? result[0].total : 0;
    } catch (error) {
      console.error('Error getting total expenses:', error);
      return 0;
    }
  }
}

export const storage = new MongoDBStorage();
