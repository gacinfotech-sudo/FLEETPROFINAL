import mongoose from 'mongoose';
import { storage } from '../storage-mongodb';
import { nanoid } from 'nanoid';

/**
 * BOOKING DRAFT SERVICE
 * Auto-save intermediate booking state without final submission.
 * Supports recovery on browser close/restart or session loss.
 */

export interface BookingDraftData {
  tenantId: string;
  userId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  bookingType?: string;
  tripType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  vehicleId?: string;
  vehicleCategory?: string;
  driverId?: string;
  totalAmount?: number;
  advanceAmount?: number;
  tollCharges?: number;
  parkingCharges?: number;
  miscellaneousAmount?: number;
  notes?: string;
  source?: string;
  progressStep?: number;
  formData?: Record<string, any>;
}

export class BookingDraftService {
  /**
   * Create or get booking draft
   */
  static async createOrGetDraft(
    tenantId: string,
    userId: string,
    userName: string,
    userMobile: string | undefined
  ): Promise<{ draftId: string; isNew: boolean }> {
    try {
      const db = await storage.getDb();

      // Check if user has existing in-progress draft
      const existing = await db.collection('bookingDrafts').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId,
        status: 'in_progress',
      });

      if (existing) {
        return { draftId: existing.draftId, isNew: false };
      }

      // Create new draft
      const draftId = `DRAFT-${nanoid(8).toUpperCase()}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const draft = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        userId,
        draftId,
        status: 'in_progress',
        progressStep: 0,
        createdByUserId: userId,
        createdByUserName: userName,
        createdByUserMobile: userMobile,
        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
        expiresAt,
      };

      await db.collection('bookingDrafts').insertOne(draft);
      return { draftId, isNew: true };
    } catch (error) {
      console.error('Error creating draft:', error);
      throw error;
    }
  }

  /**
   * Auto-save draft data
   */
  static async saveDraft(
    tenantId: string,
    draftId: string,
    data: Partial<BookingDraftData>
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      const updateData: any = {
        ...data,
        updatedAt: new Date(),
        lastSavedAt: new Date(),
      };

      // Remove tenantId and userId from update if present
      delete updateData.tenantId;
      delete updateData.userId;

      await db.collection('bookingDrafts').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          draftId,
        },
        { $set: updateData }
      );
    } catch (error) {
      console.error('Error saving draft:', error);
      // Don't throw - non-blocking auto-save
    }
  }

  /**
   * Get draft by ID
   */
  static async getDraft(tenantId: string, draftId: string): Promise<any | null> {
    try {
      const db = await storage.getDb();

      const draft = await db.collection('bookingDrafts').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        draftId,
      });

      return draft;
    } catch (error) {
      console.error('Error fetching draft:', error);
      throw error;
    }
  }

  /**
   * Get user's active drafts
   */
  static async getUserDrafts(tenantId: string, userId: string): Promise<any[]> {
    try {
      const db = await storage.getDb();

      const drafts = await db
        .collection('bookingDrafts')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          userId,
          status: 'in_progress',
        })
        .sort({ lastSavedAt: -1 })
        .toArray();

      return drafts;
    } catch (error) {
      console.error('Error fetching user drafts:', error);
      throw error;
    }
  }

  /**
   * Finalize draft to booking
   */
  static async finalizeDraft(
    tenantId: string,
    draftId: string,
    bookingData: Record<string, any>
  ): Promise<{ bookingId: string }> {
    try {
      const db = await storage.getDb();

      // Mark draft as finalized
      await db.collection('bookingDrafts').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          draftId,
        },
        {
          $set: {
            status: 'finalized',
            updatedAt: new Date(),
          },
        }
      );

      // Create booking from draft data
      const booking = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        bookingId: `BK${Date.now()}`,
        ...bookingData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('bookings').insertOne(booking);

      return { bookingId: result.insertedId.toString() };
    } catch (error) {
      console.error('Error finalizing draft:', error);
      throw error;
    }
  }

  /**
   * Delete draft
   */
  static async deleteDraft(tenantId: string, draftId: string): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('bookingDrafts').deleteOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        draftId,
      });
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }

  /**
   * Clean up expired drafts (30+ days)
   */
  static async cleanupExpiredDrafts(): Promise<number> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('bookingDrafts').deleteMany({
        expiresAt: { $lt: new Date() },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error cleaning up drafts:', error);
      return 0;
    }
  }
}

export default BookingDraftService;
