/**
 * WHATSAPP SESSION DURABILITY SERVICE
 * Persistent provider sessions that survive restart
 * No unnecessary QR rescans, tenant isolation
 */

import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

export interface WhatsAppProviderSession {
  tenantId: string;
  providerId: string;
  sessionState: 'disconnected' | 'connecting' | 'connected' | 'qr_pending';
  qrData?: string;
  phoneNumber?: string;
  lastConnectedAt?: Date;
  credentials?: Record<string, any>;
  metadata?: Record<string, any>;
  expiresAt: Date;
}

export class WhatsAppSessionDurability {
  /**
   * Store provider session (persistent across restarts)
   */
  static async storeSession(
    tenantId: string,
    providerId: string,
    sessionData: Partial<WhatsAppProviderSession>
  ): Promise<void> {
    try {
      const db = await storage.getDb();
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

      await db.collection('whatsappSessions').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          providerId,
        },
        {
          $set: {
            ...sessionData,
            expiresAt,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error storing WhatsApp session:', error);
    }
  }

  /**
   * Retrieve provider session from storage
   */
  static async getSession(
    tenantId: string,
    providerId: string
  ): Promise<WhatsAppProviderSession | null> {
    try {
      const db = await storage.getDb();

      const session = await db.collection('whatsappSessions').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        providerId,
        expiresAt: { $gt: new Date() },
      });

      return session || null;
    } catch (error) {
      console.error('Error retrieving WhatsApp session:', error);
      return null;
    }
  }

  /**
   * Update session state without losing credentials
   */
  static async updateSessionState(
    tenantId: string,
    providerId: string,
    state: 'disconnected' | 'connecting' | 'connected' | 'qr_pending'
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('whatsappSessions').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          providerId,
        },
        {
          $set: {
            sessionState: state,
            updatedAt: new Date(),
            ...(state === 'connected' && { lastConnectedAt: new Date() }),
          },
        }
      );
    } catch (error) {
      console.error('Error updating WhatsApp session state:', error);
    }
  }

  /**
   * Store QR code temporarily (for new sessions only)
   */
  static async storeQRCode(
    tenantId: string,
    providerId: string,
    qrData: string
  ): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('whatsappSessions').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          providerId,
        },
        {
          $set: {
            qrData,
            sessionState: 'qr_pending',
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      console.error('Error storing QR code:', error);
    }
  }

  /**
   * Clear QR once scanned
   */
  static async clearQRCode(tenantId: string, providerId: string): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('whatsappSessions').updateOne(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          providerId,
        },
        {
          $unset: { qrData: '' },
          $set: { updatedAt: new Date() },
        }
      );
    } catch (error) {
      console.error('Error clearing QR code:', error);
    }
  }

  /**
   * Check if session exists and is not expired
   */
  static async sessionExists(tenantId: string, providerId: string): Promise<boolean> {
    try {
      const db = await storage.getDb();

      const count = await db.collection('whatsappSessions').countDocuments({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        providerId,
        expiresAt: { $gt: new Date() },
      });

      return count > 0;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for tenant
   */
  static async getTenantSessions(tenantId: string): Promise<WhatsAppProviderSession[]> {
    try {
      const db = await storage.getDb();

      const sessions = await db
        .collection('whatsappSessions')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          expiresAt: { $gt: new Date() },
        })
        .toArray();

      return sessions;
    } catch (error) {
      console.error('Error fetching tenant sessions:', error);
      return [];
    }
  }

  /**
   * Delete session (logout/disconnect)
   */
  static async deleteSession(tenantId: string, providerId: string): Promise<void> {
    try {
      const db = await storage.getDb();

      await db.collection('whatsappSessions').deleteOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        providerId,
      });
    } catch (error) {
      console.error('Error deleting WhatsApp session:', error);
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('whatsappSessions').deleteMany({
        expiresAt: { $lt: new Date() },
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

export default WhatsAppSessionDurability;
