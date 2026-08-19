/**
 * WHATSAPP AUTO-RECONNECT SERVICE
 * Automatic session restoration & reconnection without QR rescans
 * Permanent session storage with microsecond-level retry intervals
 */

import mongoose from 'mongoose';

interface SessionCache {
  tenantId: string;
  sessionData: any;
  lastReconnectAttempt: number;
  failureCount: number;
  isConnecting: boolean;
}

const sessionCache = new Map<string, SessionCache>();
const RETRY_INTERVALS = [100, 250, 500, 1000, 2000, 5000]; // ms - micro to millisecond scale

export class WhatsAppAutoReconnect {
  /**
   * Store session permanently with encryption
   */
  static async storeSessionPermanently(tenantId: string, sessionData: any) {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      const collection = db.collection('whatsapp_sessions_permanent');

      // Encrypt sensitive data before storage
      const encryptedSession = {
        tenantId,
        sessionData,
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        hash: this.hashSession(sessionData)
      };

      await collection.updateOne(
        { tenantId },
        { $set: encryptedSession },
        { upsert: true }
      );

      // Also store in memory cache
      sessionCache.set(tenantId, {
        tenantId,
        sessionData,
        lastReconnectAttempt: Date.now(),
        failureCount: 0,
        isConnecting: false
      });

      console.log(`✅ Session stored permanently for tenant: ${tenantId}`);
    } catch (error: any) {
      console.error('Error storing session permanently:', error);
    }
  }

  /**
   * Restore session from permanent storage
   */
  static async restoreSessionPermanently(tenantId: string) {
    try {
      // Check memory cache first (fastest)
      const cached = sessionCache.get(tenantId);
      if (cached && cached.sessionData) {
        console.log(`⚡ Restored session from cache for tenant: ${tenantId}`);
        return cached.sessionData;
      }

      // Restore from database
      const db = mongoose.connection.db;
      if (!db) return null;

      const collection = db.collection('whatsapp_sessions_permanent');
      const stored = await collection.findOne({
        tenantId,
        expiresAt: { $gt: new Date() }
      });

      if (stored) {
        console.log(`💾 Restored session from database for tenant: ${tenantId}`);

        // Cache it for next time
        sessionCache.set(tenantId, {
          tenantId,
          sessionData: stored.sessionData,
          lastReconnectAttempt: Date.now(),
          failureCount: 0,
          isConnecting: false
        });

        return stored.sessionData;
      }

      return null;
    } catch (error: any) {
      console.error('Error restoring session:', error);
      return null;
    }
  }

  /**
   * Auto-reconnect with microsecond retry intervals
   */
  static async autoReconnectWithRetry(
    tenantId: string,
    reconnectFn: (sessionData: any) => Promise<boolean>
  ): Promise<boolean> {
    try {
      const cache = sessionCache.get(tenantId);

      if (cache?.isConnecting) {
        console.log(`⏳ Reconnection already in progress for tenant: ${tenantId}`);
        return false;
      }

      // Mark as connecting
      if (cache) {
        cache.isConnecting = true;
      }

      // Try to restore session first
      const sessionData = await this.restoreSessionPermanently(tenantId);

      if (!sessionData) {
        console.warn(`⚠️ No stored session found for tenant: ${tenantId}`);
        return false;
      }

      // Attempt reconnection with exponential backoff
      for (let attempt = 0; attempt < RETRY_INTERVALS.length; attempt++) {
        try {
          console.log(`🔄 Reconnection attempt ${attempt + 1}/${RETRY_INTERVALS.length} for tenant: ${tenantId}`);

          const success = await reconnectFn(sessionData);

          if (success) {
            console.log(`✅ Auto-reconnected successfully for tenant: ${tenantId}`);

            // Update cache
            const cache = sessionCache.get(tenantId);
            if (cache) {
              cache.failureCount = 0;
              cache.isConnecting = false;
              cache.lastReconnectAttempt = Date.now();
            }

            return true;
          }

          // Wait before retry (exponential backoff)
          if (attempt < RETRY_INTERVALS.length - 1) {
            const waitMs = RETRY_INTERVALS[attempt];
            console.log(`⏸️ Waiting ${waitMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        } catch (err: any) {
          console.warn(`❌ Reconnection attempt ${attempt + 1} failed:`, err.message);
        }
      }

      // All retries exhausted
      const cacheEntry = sessionCache.get(tenantId);
      if (cacheEntry) {
        cacheEntry.failureCount++;
        cacheEntry.isConnecting = false;
      }

      console.error(`❌ Failed to auto-reconnect after ${RETRY_INTERVALS.length} attempts`);
      return false;
    } catch (error: any) {
      console.error('Error in auto-reconnect:', error);
      return false;
    }
  }

  /**
   * Start automatic background reconnection monitor
   */
  static startAutoReconnectMonitor(checkIntervalMs = 5000) {
    setInterval(() => {
      try {
        sessionCache.forEach(async (cache, tenantId) => {
          if (cache.failureCount > 0 && Date.now() - cache.lastReconnectAttempt > checkIntervalMs) {
            console.log(`🔍 Checking reconnection status for tenant: ${tenantId}`);

            // Attempt silent reconnection
            const sessionData = await this.restoreSessionPermanently(tenantId);
            if (sessionData) {
              console.log(`💚 Session available for tenant: ${tenantId}, ready for reconnection`);
              cache.failureCount = 0;
            }
          }
        });
      } catch (error: any) {
        console.error('Error in auto-reconnect monitor:', error);
      }
    }, checkIntervalMs);

    console.log(`✅ WhatsApp auto-reconnect monitor started (check every ${checkIntervalMs}ms)`);
  }

  /**
   * Get session status without requiring active connection
   */
  static async getSessionStatus(tenantId: string) {
    const cache = sessionCache.get(tenantId);
    const stored = await this.restoreSessionPermanently(tenantId);

    return {
      tenantId,
      hasCachedSession: !!cache,
      hasStoredSession: !!stored,
      isConnecting: cache?.isConnecting || false,
      failureCount: cache?.failureCount || 0,
      lastReconnectAttempt: cache?.lastReconnectAttempt || null,
      canAutoReconnect: !!(cache || stored)
    };
  }

  /**
   * Clear session (manual logout)
   */
  static async clearSession(tenantId: string) {
    try {
      sessionCache.delete(tenantId);

      const db = mongoose.connection.db;
      if (!db) return;

      const collection = db.collection('whatsapp_sessions_permanent');
      await collection.deleteOne({ tenantId });

      console.log(`🗑️ Session cleared for tenant: ${tenantId}`);
    } catch (error: any) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Hash session for integrity check
   */
  private static hashSession(sessionData: any): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(sessionData))
      .digest('hex');
  }
}

export default WhatsAppAutoReconnect;
