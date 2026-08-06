import { Request, Response, NextFunction } from "express";
import { Driver } from "../models/index";

// Deliberately separate from server/middleware/auth.ts's authenticateUser —
// see the comment on IDriver.loginPin in server/models/index.ts for why a
// driver is never a User.role value. This middleware only ever grants
// access to the small, explicit set of /api/driver-portal/* routes; it
// cannot reach any staff/tenant-management route, by construction (no
// route checks BOTH authenticateUser and authenticateDriver, and no route
// meant for staff uses this middleware).
export interface DriverAuthRequest extends Request {
  driverId?: string;
  driver?: any;
}

export const authenticateDriver = async (req: DriverAuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.session) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const sessionId = (req.session as any)?.driverSessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const driver = await Driver.findOne({ sessionId });
    if (!driver) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid driver session:', err);
      });
      return res.status(401).json({ message: "Invalid session" });
    }
    req.driverId = driver._id.toString();
    req.driver = driver;
    next();
  } catch (error) {
    console.error("Driver authentication error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};
