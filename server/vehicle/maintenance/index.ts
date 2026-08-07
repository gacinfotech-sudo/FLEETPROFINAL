// Single mount point for this module's routes — mirrors
// server/driver/handover/index.ts's role. server/routes.ts is
// Integrator-only for this task; the proposed patch in this task's report
// is: an import of registerVehicleMaintenanceRoutes from this file + one
// `registerVehicleMaintenanceRoutes(app);` call.
import type { Express } from 'express';
import { registerVehicleMaintenanceRoutes } from './routes';

export function registerVehicleMaintenanceModule(app: Express): void {
  registerVehicleMaintenanceRoutes(app);
}

export * from './types';
export { MaintenanceRecord, TyreRecord, BatteryRecord, VehicleInventoryItem } from './models';
export type { IMaintenanceRecord, ITyreRecord, IBatteryRecord, IVehicleInventoryItem } from './models';
export { evaluateMaintenanceTrigger } from './triggerEvaluation';
export { calculateTyreLifeKm, calculateTyreCostPerKm, aggregateTyreCostPerKm } from './tyreCalculations';
export {
  createMaintenanceRecord, listMaintenanceRecordsForVehicle, completeMaintenanceRecord,
  sweepDueMaintenanceForVehicle, MaintenanceRecordNotFoundError,
} from './maintenanceService';
export {
  installTyre, removeTyre, listTyresForVehicle, DuplicateInServiceTyreError, TyreRecordNotFoundError,
  installBattery, removeBattery, listBatteriesForVehicle, DuplicateInServiceBatteryError, BatteryRecordNotFoundError,
} from './tyreBatteryService';
export { createInventoryItem, listInventoryForVehicle, updateInventoryItemStatus, InventoryItemNotFoundError } from './inventoryService';
