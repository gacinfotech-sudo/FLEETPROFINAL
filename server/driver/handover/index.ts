// Single mount point for this module's STAFF routes — mirrors
// server/gps/index.ts / server/driver/documents/index.ts's role.
// server/routes.ts is Integrator-only for this task; the proposed patch in
// this task's report is: an import of registerVehicleHandoverRoutes from
// this file + a single `registerVehicleHandoverRoutes(app);` call, PLUS
// (separately) the one inline driver-portal accept route — see
// driverPortalRoutes.ts's header comment for why that one is proposed as an
// inline routes.ts line rather than mounted from here.
import type { Express } from 'express';
import { registerVehicleHandoverRoutes as registerStaffRoutes } from './routes';

export function registerVehicleHandoverRoutes(app: Express): void {
  registerStaffRoutes(app);
}

export * from './types';
export { VehicleHandover, type IVehicleHandover } from './models';
export {
  createHandover, getTenantScopedHandover, listHandoversForVehicle, getOpenHandoverForVehicle,
  acceptHandoverAsDriver, listPendingHandoversForDriver,
  HandoverNotFoundError, HandoverConflictError, DriverNotEligibleError,
} from './handoverService';
export { createReturn, computeDiscrepancyFlags } from './returnService';
export { publicVehicleHandover, driverPortalHandoverSummary } from './serialization';
export { acceptHandoverHandler, getPendingHandoversForDriverPortal } from './driverPortalRoutes';
