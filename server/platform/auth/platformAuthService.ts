// STEP 7: Platform Auth Service
// Fresh authentication for Platform users (separate from Tenant auth)

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../../models';
import { AuditLog } from '../models/AuditLog';

export class PlatformAuthService {
  async login(userId: string, password: string, req: any) {
    try {
      // Find user by userId
      const user = await User.findOne({ userId });
      if (!user) {
        throw new Error('User not found');
      }

      // Verify this is a platform user (has platformRole, no tenantId)
      if (!user.platformRole || user.tenantId) {
        throw new Error('Not a platform user');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.accountLocked = true;
          user.lockoutTime = new Date();
        }
        await user.save();
        throw new Error('Invalid password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('User is inactive');
      }

      // Create session
      const sessionId = crypto.randomBytes(32).toString('hex');
      user.sessionId = sessionId;
      user.activeSessions = user.activeSessions || [];
      user.activeSessions.push({
        sessionId,
        deviceInfo: {
          userAgent: req.get('user-agent'),
          ip: req.ip,
          loginTime: new Date()
        },
        createdAt: new Date()
      });

      // Keep only last 5 sessions
      if (user.activeSessions.length > 5) {
        user.activeSessions = user.activeSessions.slice(-5);
      }

      // Reset failed attempts on successful login
      user.failedLoginAttempts = 0;
      user.accountLocked = false;
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip;
      user.lastLoginUserAgent = req.get('user-agent');

      await user.save();

      // Create express session
      req.session.userId = user.userId;

      // Audit log
      await AuditLog.create({
        actor: user.userId,
        action: 'PLATFORM_LOGIN',
        resource: 'auth',
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        createdAt: new Date()
      });

      return {
        userId: user.userId,
        platformRole: user.platformRole,
        tenantId: null,
        sessionId
      };
    } catch (error) {
      await AuditLog.create({
        actor: userId || 'unknown',
        action: 'PLATFORM_LOGIN',
        resource: 'auth',
        status: 'failure',
        errorMessage: error.message,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        createdAt: new Date()
      });
      throw error;
    }
  }

  async logout(userId: string, sessionId: string) {
    const user = await User.findOne({ userId });
    if (!user) return;

    user.activeSessions = user.activeSessions?.filter(s => s.sessionId !== sessionId) || [];
    user.sessionId = null;
    await user.save();

    await AuditLog.create({
      actor: userId,
      action: 'PLATFORM_LOGOUT',
      resource: 'auth',
      status: 'success',
      createdAt: new Date()
    });
  }
}

export const platformAuthService = new PlatformAuthService();
