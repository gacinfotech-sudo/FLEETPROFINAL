import type { Express, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { recordFuelTransaction, listFuelTransactions } from './services/fuelTransactionService';

export function registerVehicleFuelRoutes(app: Express): void {
  app.get('/api/vehicles/:vehicleId/fuel-transactions', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listFuelTransactions(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch fuel transactions' });
    }
  });

  app.post('/api/vehicles/:vehicleId/fuel-transactions', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { fuelType, odometer, quantity, amount, isFullTank, station, date } = req.body;
      const record = await recordFuelTransaction(
        {
          tenantId: req.tenantId!, vehicleId: req.params.vehicleId,
          fuelType, odometer, quantity, amount,
          isFullTank: isFullTank ?? true, station, date: date ? new Date(date) : new Date(),
        },
        req.userId!,
        // Default 25% deviation / 3-fillup minimum — tenant-configurable
        // via request body override; never hard-coded in the calculator
        // itself (see analytics.ts).
        { deviationThreshold: req.body.deviationThreshold ?? 0.25, minimumHistoryCount: req.body.minimumHistoryCount ?? 3 },
      );
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record fuel transaction' });
    }
  });
}
