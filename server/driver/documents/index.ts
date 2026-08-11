// Single mount point for this module — mirrors server/gps/index.ts's role and
// server/routes.ts's registerGpsConnectionRoutes/registerGpsDeviceRoutes call
// pattern. server/routes.ts is Integrator-only for this task (see task file's
// "Files forbidden to modify"); the proposed patch in this task's report is
// exactly two lines: an import of registerDriverDocumentModule from this file,
// and a single `registerDriverDocumentModule(app);` call alongside the existing
// registerGps*Routes(app) calls.
import type { Express } from 'express';
import { registerGoogleDriveConnectionRoutes } from './routes/connectionRoutes';
import { registerDriverDocumentRoutes } from './routes/documentRoutes';

export function registerDriverDocumentModule(app: Express): void {
  registerGoogleDriveConnectionRoutes(app);
  registerDriverDocumentRoutes(app);
}

export * from './types';
export * from './permissions';
export { TenantGoogleDriveConnection } from './models/tenantGoogleDriveConnection';
export { DriverDocument } from './models/driverDocument';
export { DriverDocumentAuditLog } from './models/driverDocumentAuditLog';
export { setRetentionHoldForDriver } from './services/documentService';
