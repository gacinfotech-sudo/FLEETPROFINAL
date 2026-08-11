import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { Vehicle } from '../../models/index';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { VehicleGpsAssignment } from '../models/vehicleGpsAssignment';
import { getLatestVehicleState } from '../telemetry/queries';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

/**
 * Read path for the Vehicle 360 GPS & Telematics tab. Returns the assigned
 * device's latest known state, or [] when there's no active GPS assignment
 * or no telemetry has arrived yet — never a fabricated position.
 */
export function registerGpsVehicleStateRoutes(app: Express): void {
  app.get('/api/vehicles/:vehicleId/gps/latest-state', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_VIEW), safeAsync(async (req, res) => {
    const tenantId = req.tenantId!;
    if (!mongoose.isValidObjectId(req.params.vehicleId) || !(await Vehicle.exists({ _id: req.params.vehicleId, tenantId }))) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }
    const assignment = await VehicleGpsAssignment.findOne({ tenantId, vehicleId: req.params.vehicleId, status: 'active' }).lean();
    if (!assignment) return res.json([]);
    const state = await getLatestVehicleState({ tenantId, gpsDeviceId: String(assignment.gpsDeviceId) });
    res.json(state ? [state] : []);
  }));
}
