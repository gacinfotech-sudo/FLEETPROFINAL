import type { Express, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { BreakdownEvent } from './models/breakdownEvent';
import { AccidentEvent } from './models/accidentEvent';
import { Challan } from './models/challan';
import { transitionBreakdownState } from './services/breakdownService';

export function registerVehicleIncidentRoutes(app: Express): void {
  // --- Breakdowns ---
  app.get('/api/vehicles/:vehicleId/breakdowns', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    res.json(await BreakdownEvent.find({ tenantId: req.tenantId, vehicleId: req.params.vehicleId }).sort({ reportedAt: -1 }));
  });

  app.post('/api/vehicles/:vehicleId/breakdowns', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { symptoms, location, driverId, bookingId } = req.body;
      const event = await BreakdownEvent.create({
        tenantId: req.tenantId, vehicleId: req.params.vehicleId, driverId, bookingId,
        symptoms, location, downtimeStartAt: new Date(),
        createdBy: req.userId!, updatedBy: req.userId!,
      });
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record breakdown' });
    }
  });

  app.post('/api/breakdowns/:breakdownId/transition', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { toState, notes } = req.body;
      const event = await transitionBreakdownState(req.tenantId!, req.params.breakdownId, toState, req.userId!, notes);
      if (!event) return res.status(404).json({ message: 'Breakdown not found' });
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Invalid transition' });
    }
  });

  // --- Accidents ---
  app.get('/api/vehicles/:vehicleId/accidents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    res.json(await AccidentEvent.find({ tenantId: req.tenantId, vehicleId: req.params.vehicleId }).sort({ occurredAt: -1 }));
  });

  app.post('/api/vehicles/:vehicleId/accidents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const event = await AccidentEvent.create({
        ...req.body, tenantId: req.tenantId, vehicleId: req.params.vehicleId,
        downtimeStartAt: req.body.downtimeStartAt ? new Date(req.body.downtimeStartAt) : new Date(),
        occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : new Date(),
        createdBy: req.userId!, updatedBy: req.userId!,
      });
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record accident' });
    }
  });

  app.post('/api/accidents/:accidentId/review', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { reviewStatus, reviewNotes } = req.body;
      const event = await AccidentEvent.findOneAndUpdate(
        { _id: req.params.accidentId, tenantId: req.tenantId },
        { reviewStatus, reviewNotes, reviewedBy: req.userId, reviewedAt: new Date(), updatedBy: req.userId },
        { new: true },
      );
      if (!event) return res.status(404).json({ message: 'Accident not found' });
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to update review' });
    }
  });

  // --- Challans ---
  app.get('/api/vehicles/:vehicleId/challans', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    res.json(await Challan.find({ tenantId: req.tenantId, vehicleId: req.params.vehicleId }).sort({ eventDate: -1 }));
  });

  app.post('/api/vehicles/:vehicleId/challans', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const challan = await Challan.create({
        ...req.body, tenantId: req.tenantId, vehicleId: req.params.vehicleId,
        eventDate: req.body.eventDate ? new Date(req.body.eventDate) : new Date(),
        createdBy: req.userId!, updatedBy: req.userId!,
      });
      res.status(201).json(challan);
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: 'A challan with this number already exists.' });
      res.status(400).json({ message: error?.message || 'Failed to record challan' });
    }
  });

  // Records the responsibility DECISION only — never triggers a deduction
  // or payment action itself, per this task's explicit acceptance
  // criterion (no code path in this module deducts driver money).
  app.post('/api/challans/:challanId/responsibility', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { responsibilityDecision } = req.body;
      const challan = await Challan.findOneAndUpdate(
        { _id: req.params.challanId, tenantId: req.tenantId },
        { responsibilityDecision, responsibilityDecidedBy: req.userId, responsibilityDecidedAt: new Date(), updatedBy: req.userId },
        { new: true },
      );
      if (!challan) return res.status(404).json({ message: 'Challan not found' });
      res.json(challan);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record responsibility decision' });
    }
  });
}
