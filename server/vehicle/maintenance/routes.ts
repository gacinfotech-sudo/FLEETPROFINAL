// Not mounted by this task (server/routes.ts is Integrator-only) — see
// index.ts and this task's report for the proposed single mount line.
// Uses PERMISSIONS.MANAGE_VEHICLES for now (same interim pattern as
// server/driver/handover/routes.ts, itself unmerged) since the finer-
// grained vehicle.maintenance.view/manage strings this module's report
// proposes aren't in the protected permissions.ts file yet.
import type { Express, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import {
  createMaintenanceRecord, listMaintenanceRecordsForVehicle, completeMaintenanceRecord,
  sweepDueMaintenanceForVehicle, MaintenanceRecordNotFoundError,
} from './maintenanceService';
import {
  installTyre, removeTyre, listTyresForVehicle, DuplicateInServiceTyreError, TyreRecordNotFoundError,
  installBattery, removeBattery, listBatteriesForVehicle, DuplicateInServiceBatteryError, BatteryRecordNotFoundError,
} from './tyreBatteryService';
import { createInventoryItem, listInventoryForVehicle, updateInventoryItemStatus, InventoryItemNotFoundError } from './inventoryService';

function actor(req: AuthRequest) {
  return { userId: req.userId!, role: req.user?.role || 'client' };
}

export function registerVehicleMaintenanceRoutes(app: Express): void {
  // --- Maintenance records ---
  app.post('/api/vehicles/:vehicleId/maintenance-records', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const record = await createMaintenanceRecord({ ...req.body, tenantId: req.tenantId!, vehicleId: req.params.vehicleId, createdBy: actor(req) });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to create maintenance record' });
    }
  });

  app.get('/api/vehicles/:vehicleId/maintenance-records', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listMaintenanceRecordsForVehicle(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch maintenance records' });
    }
  });

  app.post('/api/maintenance-records/:recordId/complete', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const result = await completeMaintenanceRecord({
        tenantId: req.tenantId!, recordId: req.params.recordId,
        serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : new Date(),
        odometerAtService: req.body.odometerAtService, engineHoursAtService: req.body.engineHoursAtService,
        cost: req.body.cost, vendorName: req.body.vendorName, nextSchedule: req.body.nextSchedule,
      });
      res.json(result);
    } catch (error: any) {
      res.status(error instanceof MaintenanceRecordNotFoundError ? 404 : 400).json({ message: error?.message || 'Failed to complete maintenance record' });
    }
  });

  app.post('/api/vehicles/:vehicleId/maintenance-records/sweep-due', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const changed = await sweepDueMaintenanceForVehicle(req.tenantId!, req.params.vehicleId, {
        odometerKm: req.body.odometerKm, engineHours: req.body.engineHours,
        asOfDate: req.body.asOfDate ? new Date(req.body.asOfDate) : undefined,
        hasActiveDiagnosticAlert: req.body.hasActiveDiagnosticAlert,
      });
      res.json({ changed });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to evaluate maintenance triggers' });
    }
  });

  // --- Tyres ---
  app.post('/api/vehicles/:vehicleId/tyres', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const tyre = await installTyre({ ...req.body, tenantId: req.tenantId!, vehicleId: req.params.vehicleId, purchaseDate: new Date(req.body.purchaseDate), createdBy: actor(req) });
      res.status(201).json(tyre);
    } catch (error: any) {
      res.status(error instanceof DuplicateInServiceTyreError ? 409 : 400).json({ message: error?.message || 'Failed to install tyre' });
    }
  });

  app.post('/api/tyres/:tyreRecordId/remove', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const result = await removeTyre({
        tenantId: req.tenantId!, tyreRecordId: req.params.tyreRecordId,
        removalOdometerKm: req.body.removalOdometerKm, removalDate: req.body.removalDate ? new Date(req.body.removalDate) : new Date(),
        removalReason: req.body.removalReason, finalStatus: req.body.finalStatus,
      });
      res.json(result);
    } catch (error: any) {
      res.status(error instanceof TyreRecordNotFoundError ? 404 : 400).json({ message: error?.message || 'Failed to remove tyre' });
    }
  });

  app.get('/api/vehicles/:vehicleId/tyres', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listTyresForVehicle(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch tyre records' });
    }
  });

  // --- Battery ---
  app.post('/api/vehicles/:vehicleId/battery', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const battery = await installBattery({ ...req.body, tenantId: req.tenantId!, vehicleId: req.params.vehicleId, purchaseDate: new Date(req.body.purchaseDate), installationDate: new Date(req.body.installationDate), createdBy: actor(req) });
      res.status(201).json(battery);
    } catch (error: any) {
      res.status(error instanceof DuplicateInServiceBatteryError ? 409 : 400).json({ message: error?.message || 'Failed to install battery' });
    }
  });

  app.post('/api/battery/:batteryRecordId/remove', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const record = await removeBattery({ tenantId: req.tenantId!, batteryRecordId: req.params.batteryRecordId, removalDate: req.body.removalDate ? new Date(req.body.removalDate) : new Date(), removalReason: req.body.removalReason });
      res.json(record);
    } catch (error: any) {
      res.status(error instanceof BatteryRecordNotFoundError ? 404 : 400).json({ message: error?.message || 'Failed to remove battery' });
    }
  });

  app.get('/api/vehicles/:vehicleId/battery', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listBatteriesForVehicle(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch battery records' });
    }
  });

  // --- Inventory catalog ---
  app.post('/api/vehicles/:vehicleId/inventory', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const item = await createInventoryItem({ ...req.body, tenantId: req.tenantId!, vehicleId: req.params.vehicleId, createdBy: actor(req) });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to create inventory item' });
    }
  });

  app.get('/api/vehicles/:vehicleId/inventory', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listInventoryForVehicle(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch inventory' });
    }
  });

  app.patch('/api/inventory/:itemId/status', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await updateInventoryItemStatus(req.tenantId!, req.params.itemId, req.body.status));
    } catch (error: any) {
      res.status(error instanceof InventoryItemNotFoundError ? 404 : 400).json({ message: error?.message || 'Failed to update inventory item' });
    }
  });
}
