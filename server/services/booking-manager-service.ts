/**
 * BOOKING MANAGER SERVICE
 * Assigns accountability for booking execution
 * Handles duty control, follow-up, and 30-min vehicle reporting
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface BookingManagerAssignment {
  bookingId: string;
  tenantId: string;
  assignedManagerUserId: string;
  assignedManagerName: string;
  assignedManagerMobile: string;
  assignedManagerWhatsApp?: string;
  assignedAt: Date;
  isDefaultManager: boolean;
  audit: {
    previousManagerUserId?: string;
    changedBy?: string;
    changedAt?: Date;
    reason?: string;
  };
}

export class BookingManagerService {
  /**
   * Get tenant's default booking manager
   */
  static async getTenantDefaultManager(
    tenantId: string
  ): Promise<any | null> {
    try {
      const db = await storage.getDb();

      const tenant = await db.collection('tenants').findOne({
        _id: new mongoose.Types.ObjectId(tenantId),
      });

      if (!tenant?.settings?.defaultBookingManagerUserId) {
        return null;
      }

      // Get manager user details
      const manager = await db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(
          tenant.settings.defaultBookingManagerUserId
        ),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      return manager ? {
        userId: manager._id.toString(),
        name: manager.name,
        mobile: manager.phone,
        whatsapp: manager.whatsappNumber || manager.phone,
        role: manager.role,
        designation: manager.designation,
        isDefault: true,
      } : null;
    } catch (error) {
      console.error('Error fetching default manager:', error);
      return null;
    }
  }

  /**
   * Get all available managers for tenant
   */
  static async getTenantManagers(tenantId: string): Promise<any[]> {
    try {
      const db = await storage.getDb();

      // Get all staff/users with manager roles
      const managers = await db
        .collection('users')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          role: { $in: ['admin', 'manager', 'staff', 'operations'] },
          isActive: true,
        })
        .project({
          _id: 1,
          name: 1,
          phone: 1,
          whatsappNumber: 1,
          designation: 1,
          role: 1,
        })
        .toArray();

      return managers.map((m) => ({
        userId: m._id.toString(),
        name: m.name,
        mobile: m.phone,
        whatsapp: m.whatsappNumber || m.phone,
        designation: m.designation,
        role: m.role,
      }));
    } catch (error) {
      console.error('Error fetching tenant managers:', error);
      return [];
    }
  }

  /**
   * Check if staff/manager exists by mobile
   */
  static async findStaffByMobile(
    tenantId: string,
    normalizedMobile: string
  ): Promise<any | null> {
    try {
      const db = await storage.getDb();

      const staff = await db.collection('users').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        $or: [
          { phone: normalizedMobile },
          { whatsappNumber: normalizedMobile },
          { alternatePhone: normalizedMobile },
        ],
      });

      return staff ? {
        userId: staff._id.toString(),
        name: staff.name,
        mobile: staff.phone,
        whatsapp: staff.whatsappNumber || staff.phone,
        designation: staff.designation,
        role: staff.role,
        exists: true,
      } : null;
    } catch (error) {
      console.error('Error finding staff by mobile:', error);
      return null;
    }
  }

  /**
   * Create new staff/manager for tenant
   */
  static async createStaff(
    tenantId: string,
    staffData: {
      name: string;
      mobile: string;
      whatsapp?: string;
      designation: string;
      role: string;
      branch?: string;
    }
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      // Check if already exists
      const existing = await this.findStaffByMobile(tenantId, staffData.mobile);
      if (existing) {
        return existing;
      }

      // Create new user/staff
      const newStaff = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId: `STAFF-${Date.now()}`,
        name: staffData.name,
        phone: staffData.mobile,
        whatsappNumber: staffData.whatsapp || staffData.mobile,
        designation: staffData.designation,
        role: staffData.role,
        branch: staffData.branch,
        isActive: true,
        createdAt: new Date(),
      };

      const result = await db.collection('users').insertOne(newStaff);

      return {
        userId: result.insertedId.toString(),
        name: staffData.name,
        mobile: staffData.mobile,
        whatsapp: staffData.whatsapp || staffData.mobile,
        designation: staffData.designation,
        role: staffData.role,
        created: true,
      };
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  /**
   * Assign manager to booking
   */
  static async assignManagerToBooking(
    tenantId: string,
    bookingId: string,
    managerUserId: string,
    isDefault: boolean = false
  ): Promise<BookingManagerAssignment> {
    try {
      const db = await storage.getDb();

      // Get manager details
      const manager = await db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(managerUserId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      if (!manager) {
        throw new Error('Manager not found');
      }

      // Update booking with manager assignment
      const assignment: BookingManagerAssignment = {
        bookingId,
        tenantId,
        assignedManagerUserId: managerUserId,
        assignedManagerName: manager.name,
        assignedManagerMobile: manager.phone,
        assignedManagerWhatsApp: manager.whatsappNumber || manager.phone,
        assignedAt: new Date(),
        isDefaultManager: isDefault,
        audit: {},
      };

      await db.collection('bookings').updateOne(
        { _id: new mongoose.Types.ObjectId(bookingId) },
        {
          $set: {
            assignedManagerUserId: new mongoose.Types.ObjectId(managerUserId),
            assignedManagerName: manager.name,
            assignedManagerMobile: manager.phone,
            assignedManagerWhatsApp: manager.whatsappNumber || manager.phone,
            managerAssignedAt: new Date(),
            isDefaultManager: isDefault,
          },
        }
      );

      return assignment;
    } catch (error) {
      console.error('Error assigning manager to booking:', error);
      throw error;
    }
  }

  /**
   * Change manager for booking (audit trail)
   */
  static async changeBookingManager(
    tenantId: string,
    bookingId: string,
    newManagerUserId: string,
    changedBy: string,
    reason?: string
  ): Promise<BookingManagerAssignment> {
    try {
      const db = await storage.getDb();

      // Get current booking
      const booking = await db.collection('bookings').findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      // Get new manager details
      const newManager = await db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(newManagerUserId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      if (!newManager) {
        throw new Error('Manager not found');
      }

      // Update booking with audit trail
      const assignment: BookingManagerAssignment = {
        bookingId,
        tenantId,
        assignedManagerUserId: newManagerUserId,
        assignedManagerName: newManager.name,
        assignedManagerMobile: newManager.phone,
        assignedManagerWhatsApp: newManager.whatsappNumber || newManager.phone,
        assignedAt: new Date(),
        isDefaultManager: false,
        audit: {
          previousManagerUserId: booking.assignedManagerUserId?.toString(),
          changedBy,
          changedAt: new Date(),
          reason,
        },
      };

      await db.collection('bookings').updateOne(
        { _id: new mongoose.Types.ObjectId(bookingId) },
        {
          $set: {
            assignedManagerUserId: new mongoose.Types.ObjectId(newManagerUserId),
            assignedManagerName: newManager.name,
            assignedManagerMobile: newManager.phone,
            assignedManagerWhatsApp: newManager.whatsappNumber || newManager.phone,
            managerChangedAt: new Date(),
            managerChangeAudit: assignment.audit,
          },
        }
      );

      return assignment;
    } catch (error) {
      console.error('Error changing booking manager:', error);
      throw error;
    }
  }

  /**
   * Set tenant's default booking manager
   */
  static async setDefaultManager(
    tenantId: string,
    managerUserId: string
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      // Verify manager exists
      const manager = await db.collection('users').findOne({
        _id: new mongoose.Types.ObjectId(managerUserId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      if (!manager) {
        throw new Error('Manager not found');
      }

      // Update tenant settings
      await db.collection('tenants').updateOne(
        { _id: new mongoose.Types.ObjectId(tenantId) },
        {
          $set: {
            'settings.defaultBookingManagerUserId': new mongoose.Types.ObjectId(
              managerUserId
            ),
            'settings.defaultBookingManagerName': manager.name,
            'settings.defaultBookingManagerMobile': manager.phone,
            'settings.updatedAt': new Date(),
          },
        }
      );
    } catch (error) {
      console.error('Error setting default manager:', error);
      throw error;
    }
  }

  /**
   * Get booking manager assignment
   */
  static async getBookingManager(
    tenantId: string,
    bookingId: string
  ): Promise<any | null> {
    try {
      const db = await storage.getDb();

      const booking = await db.collection('bookings').findOne({
        _id: new mongoose.Types.ObjectId(bookingId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });

      if (!booking?.assignedManagerUserId) {
        return null;
      }

      return {
        userId: booking.assignedManagerUserId.toString(),
        name: booking.assignedManagerName,
        mobile: booking.assignedManagerMobile,
        whatsapp: booking.assignedManagerWhatsApp,
        assignedAt: booking.managerAssignedAt,
        isDefault: booking.isDefaultManager,
      };
    } catch (error) {
      console.error('Error fetching booking manager:', error);
      return null;
    }
  }
}

export default BookingManagerService;
