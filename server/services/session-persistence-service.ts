/**
 * SESSION PERSISTENCE SERVICE
 * Secure login that survives browser close/restart
 * JWT + Refresh Token + Persistent Storage
 */

import jwt from 'jsonwebtoken';
import { storage } from '../storage-mongodb';
import mongoose from 'mongoose';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-prod';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'default-refresh-change-in-prod';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionData {
  userId: string;
  tenantId: string;
  name: string;
  phone?: string;
  role: string;
  iat: number;
  exp: number;
}

export class SessionPersistenceService {
  /**
   * Create access + refresh tokens
   */
  static createTokens(userId: string, tenantId: string, userData: any): SessionTokens {
    try {
      const payload = {
        userId,
        tenantId,
        name: userData.name,
        phone: userData.phone,
        role: userData.role,
      };

      const accessToken = jwt.sign(payload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'fleetpro',
        audience: 'fleetpro-app',
      });

      const refreshToken = jwt.sign(
        { userId, tenantId },
        REFRESH_SECRET,
        {
          expiresIn: REFRESH_TOKEN_EXPIRY,
          issuer: 'fleetpro',
          audience: 'fleetpro-app',
        }
      );

      const decoded = jwt.decode(accessToken) as any;
      const expiresIn = decoded.exp * 1000 - Date.now();

      return { accessToken, refreshToken, expiresIn };
    } catch (error) {
      console.error('Error creating tokens:', error);
      throw error;
    }
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): SessionData | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'fleetpro',
        audience: 'fleetpro-app',
      });
      return decoded as SessionData;
    } catch (error) {
      console.error('Invalid access token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static refreshAccessToken(refreshToken: string): SessionTokens | null {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET, {
        issuer: 'fleetpro',
        audience: 'fleetpro-app',
      }) as any;

      // Fetch fresh user data
      // In production, would query database for latest user info
      const accessToken = jwt.sign(
        {
          userId: decoded.userId,
          tenantId: decoded.tenantId,
        },
        JWT_SECRET,
        {
          expiresIn: ACCESS_TOKEN_EXPIRY,
          issuer: 'fleetpro',
          audience: 'fleetpro-app',
        }
      );

      const decodedAccess = jwt.decode(accessToken) as any;
      const expiresIn = decodedAccess.exp * 1000 - Date.now();

      return { accessToken, refreshToken, expiresIn };
    } catch (error) {
      console.error('Invalid refresh token:', error);
      return null;
    }
  }

  /**
   * Store refresh token in database for logout/revocation
   */
  static async storeRefreshToken(
    userId: string,
    tenantId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const db = await storage.getDb();
      await db.collection('refreshTokens').insertOne({
        userId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        token,
        isRevoked: false,
        createdAt: new Date(),
        expiresAt,
      });
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Verify refresh token exists and is not revoked
   */
  static async verifyRefreshTokenExists(
    userId: string,
    tenantId: string,
    token: string
  ): Promise<boolean> {
    try {
      const db = await storage.getDb();
      const record = await db.collection('refreshTokens').findOne({
        userId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        token,
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      });
      return !!record;
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke refresh token (logout)
   */
  static async revokeRefreshToken(
    userId: string,
    tenantId: string,
    token: string
  ): Promise<void> {
    try {
      const db = await storage.getDb();
      await db.collection('refreshTokens').updateOne(
        {
          userId,
          tenantId: new mongoose.Types.ObjectId(tenantId),
          token,
        },
        {
          $set: { isRevoked: true, revokedAt: new Date() },
        }
      );
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
  }

  /**
   * Revoke all tokens for user (logout from all devices)
   */
  static async revokeAllUserTokens(userId: string, tenantId: string): Promise<void> {
    try {
      const db = await storage.getDb();
      await db.collection('refreshTokens').updateMany(
        {
          userId,
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isRevoked: false,
        },
        {
          $set: { isRevoked: true, revokedAt: new Date() },
        }
      );
    } catch (error) {
      console.error('Error revoking all tokens:', error);
    }
  }

  /**
   * Cleanup expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const db = await storage.getDb();
      const result = await db.collection('refreshTokens').deleteMany({
        expiresAt: { $lt: new Date() },
      });
      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error cleaning up tokens:', error);
      return 0;
    }
  }
}

export default SessionPersistenceService;
