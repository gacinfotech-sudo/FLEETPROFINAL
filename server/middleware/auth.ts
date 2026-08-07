import { Request, Response, NextFunction } from "express";
import { storage } from "../storage-mongodb";
import { isPlatformRole } from "../root/types";

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
      console.error('Session lookup failed (transient?), not destroying session:', lookupError);
      return res.status(503).json({ message: "Temporarily unavailable, please retry." });
    }

    if (!user) {
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      return res.status(401).json({ message: "Invalid session" });
    }

    if (!user.isActive) {
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
  // Platform staff (a VALID, recognized platformRole) can access all tenant
  // resources. This REPLACES the old unconditional, unaudited
  // `role === "admin"` bypass — see TASK-ROOT-SECURITY-05's report for the
  // full before/after behavior analysis. `role` itself is untouched: a
  // user can still be role:'admin' for `requireAdmin`-gated /api/admin/**
  // routes while separately holding (or not holding) a platformRole for
  // requireTenant-gated routes.
  //
  // Validated via isPlatformRole(), not a bare truthy check (integration
  // review fix): the migration script itself only ever writes validated
  // values, but this is the core cross-tenant bypass for the WHOLE app —
  // it must fail closed against any future write path (a manual DB edit,
  // a raw-driver write, a bug in not-yet-built Root User Management) that
  // could leave an unrecognized string in this field, not just against
  // paths this integration happens to control today.
  if (isPlatformRole(req.user?.platformRole)) {
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
