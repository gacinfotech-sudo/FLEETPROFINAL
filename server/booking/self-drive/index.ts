// Single mount point for the self-drive lifecycle module — same pattern as
// server/driver/handover/index.ts.
import type { Express } from 'express';
import { registerSelfDriveRoutes as registerRoutes } from './routes';

export function registerSelfDriveRoutes(app: Express): void {
  registerRoutes(app);
}

export { SelfDriveTrip, deriveStage, DEPOSIT_METHODS, type ISelfDriveTrip, type SelfDriveStage } from './models';
export { publicSelfDriveTrip } from './routes';
