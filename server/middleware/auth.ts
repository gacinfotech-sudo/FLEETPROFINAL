import { Request, Response, NextFunction } from "express";
import { storage } from "../storage-mongodb";

export interface AuthRequest extends Request {
  user?: any;
  userId?: string;
  tenantId?: string;
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if session exists
    if (!req.session) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const sessionId = (req.session as any)?.userId;

    if (!sessionId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Device fingerprint validation - detect session hijacking
    const storedFingerprint = (req.session as any)?.deviceFingerprint;
    const currentIP = req.ip || req.connection.remoteAddress || 'unknown';
    const currentUserAgent = req.get('User-Agent') || 'unknown';

    if (storedFingerprint) {
      // Check for significant changes that indicate potential hijacking
      if (storedFingerprint.ip !== currentIP) {
        console.warn(`⚠️ Session IP mismatch: stored=${storedFingerprint.ip}, current=${currentIP}`);
        // Allow IP changes (mobile networks) but log it
      }

      if (storedFingerprint.userAgent !== currentUserAgent) {
        console.warn(`⚠️ Session user agent mismatch - possible browser/device change`);
        // Allow UA changes but log it
      }
    }

    // SA-01: a lookup FAILURE (thrown error — e.g. a transient MongoDB
    // reconnect blip) must never be treated the same as "no such session".
    // Only a clean null result means the session genuinely doesn't map to a
    // real user and should be destroyed; a failed lookup gets a retryable
    // 503 with the session left intact, so a brief DB hiccup can't
    // permanently force-log-out a user who was validly logged in.
    let user;
    try {
      user = await storage.getUserBySessionId(sessionId);
    } catch (lookupError) {
      console.error('🔴 Session lookup failed (transient?), not destroying session:', lookupError);
      return res.status(503).json({ message: "Temporarily unavailable, please retry." });
    }

    if (!user) {
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('🔴 Error destroying session:', err);
      });
      return res.status(401).json({ message: "Invalid session" });
    }

    if (!user.isActive) {
      console.warn(`⚠️ Inactive user session attempt: ${user.userId}`);
      return res.status(401).json({ message: "Invalid session" });
    }

    req.user = user;
    req.userId = user.userId;
    // Handle both populated and non-populated tenantId
    if (user.tenantId) {
      req.tenantId = typeof user.tenantId === 'object'
        ? (user.tenantId as any)._id.toString()
        : (user.tenantId as any).toString();
    }

    // P0 FIX: this used to console.log the full user identity (userId,
    // role, tenantId) on every single authenticated request in production,
    // which bloats logs with sensitive data and makes it easy to
    // accidentally ship those logs somewhere less trusted. Only log at
    // this granularity in development, and never log session ids/passwords.
    if (process.env.NODE_ENV === 'development') {
      console.log("User authenticated:", { userId: user.userId, role: user.role });
    }

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  // Optional: Add IP-based security check
  const clientIP = req.ip || req.connection.remoteAddress;
  console.log(`Admin access from IP: ${clientIP} by user: ${req.user.userId}`);
  
  // Optional: Check for admin session timeout (stricter than regular users)
  const lastActivity = (req.session as any)?.lastActivity;
  const adminSessionTimeout = 30 * 60 * 1000; // 30 minutes for admin
  
  if (lastActivity && Date.now() - lastActivity > adminSessionTimeout) {
    req.session.destroy((err) => {
      console.log('Admin session expired due to inactivity');
    });
    return res.status(401).json({ message: "Admin session expired" });
  }
  
  (req.session as any).lastActivity = Date.now();
  next();
};

export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Admin users can access all tenant resources
  if (req.user?.role === "admin") {
    return next();
  }
  
  // Every non-admin role must have a tenant. Letting an orphaned manager
  // through is unsafe because optional tenant scopes are interpreted by the
  // storage layer as an intentional admin/cross-tenant query.
  if (!req.tenantId) {
    console.log("Tenant access denied for user:", req.user?.userId, "tenantId:", req.tenantId);
    return res.status(403).json({ message: "Tenant access required" });
  }
  
  next();
};
