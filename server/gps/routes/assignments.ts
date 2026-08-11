import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Vehicle } from '../../models/index';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { VehicleGpsAssignment } from '../models/vehicleGpsAssignment';
import {
  assignGpsDevice,
  GpsAssignmentConflictError,
  GpsAssignmentNotFoundError,
  populateGpsAssignment,
  publicVehicleGpsAssignment,
  unassignGpsDevice,
} from '../services/assignmentService';
import { writeGpsConnectionAudit } from '../services/connectionService';

const assignSchema = z.object({
  gpsDeviceId: z.string().min(1),
  assignedFrom: z.coerce.date().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
}).strict();
const unassignSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

const gpsAssignmentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many GPS assignment changes. Please try again later.' },
});

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function tenantContext(req: AuthRequest, res: Response) {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required for GPS assignments.' });
    return null;
  }
  return req.tenantId;
}

async function tenantVehicleExists(tenantId: string, vehicleId: string) {
  return mongoose.isValidObjectId(vehicleId) && Boolean(await Vehicle.exists({ _id: vehicleId, tenantId }));
}

function assignmentError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: error.issues.map((issue) => issue.message).join('; ') });
  }
  if (error instanceof GpsAssignmentNotFoundError) return res.status(404).json({ message: error.message });
  if (error instanceof GpsAssignmentConflictError) return res.status(409).json({ message: error.message });
  throw error;
}

export function registerGpsAssignmentRoutes(app: Express): void {
  app.get('/api/vehicles/:vehicleId/gps-assignment', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_VIEW), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!(await tenantVehicleExists(tenantId, req.params.vehicleId))) return res.status(404).json({ message: 'Vehicle not found.' });
    const assignment = await populateGpsAssignment(
      VehicleGpsAssignment.findOne({ tenantId, vehicleId: req.params.vehicleId, status: 'active' }),
    );
    res.json({ assignment: assignment ? publicVehicleGpsAssignment(assignment) : null });
  }));

  app.get('/api/vehicles/:vehicleId/gps-assignment-history', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_VIEW), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!(await tenantVehicleExists(tenantId, req.params.vehicleId))) return res.status(404).json({ message: 'Vehicle not found.' });
    const assignments = await populateGpsAssignment(
      VehicleGpsAssignment.find({ tenantId, vehicleId: req.params.vehicleId }).sort({ assignedFrom: -1 }),
    );
    res.json(assignments.map(publicVehicleGpsAssignment));
  }));

  app.post('/api/vehicles/:vehicleId/gps-assignment', gpsAssignmentRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_ASSIGNMENT_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    try {
      const input = assignSchema.parse(req.body);
      const result = await assignGpsDevice({
        tenantId,
        vehicleId: req.params.vehicleId,
        gpsDeviceId: input.gpsDeviceId,
        assignedFrom: input.assignedFrom,
        actor: req.userId!,
        reason: input.reason,
      });
      const assignment = await populateGpsAssignment(VehicleGpsAssignment.findById(result.assignment._id));
      const publicAssignment = publicVehicleGpsAssignment(assignment!);
      if (!result.alreadyAssigned) {
        await writeGpsConnectionAudit({
          tenantId,
          userId: req.userId!,
          action: result.replacedAssignmentId ? 'gps.assignment.changed' : 'gps.device.assigned',
          connectionId: publicAssignment.connectionId,
          deviceId: publicAssignment.gpsDeviceId,
          vehicleId: publicAssignment.vehicleId,
          oldValue: result.replacedAssignment ? publicVehicleGpsAssignment(result.replacedAssignment) : undefined,
          newValue: publicAssignment,
          reason: input.reason,
        });
      }
      res.status(result.alreadyAssigned ? 200 : 201).json({ assignment: publicAssignment, alreadyAssigned: result.alreadyAssigned, replacedAssignmentId: result.replacedAssignmentId });
    } catch (error) {
      assignmentError(error, res);
    }
  }));

  app.delete('/api/vehicles/:vehicleId/gps-assignment', gpsAssignmentRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_ASSIGNMENT_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    try {
      const input = unassignSchema.parse(req.body);
      const result = await unassignGpsDevice({ tenantId, vehicleId: req.params.vehicleId, actor: req.userId!, reason: input.reason });
      if (!result.assignment) return res.json({ assignment: null, alreadyUnassigned: true });
      const assignment = await populateGpsAssignment(VehicleGpsAssignment.findById(result.assignment._id));
      const publicAssignment = publicVehicleGpsAssignment(assignment!);
      await writeGpsConnectionAudit({
        tenantId,
        userId: req.userId!,
        action: 'gps.device.unassigned',
        connectionId: publicAssignment.connectionId,
        deviceId: publicAssignment.gpsDeviceId,
        vehicleId: publicAssignment.vehicleId,
        oldValue: publicVehicleGpsAssignment(result.previousAssignment),
        newValue: publicAssignment,
        reason: input.reason,
      });
      res.json({ assignment: publicAssignment, alreadyUnassigned: false });
    } catch (error) {
      assignmentError(error, res);
    }
  }));
}
