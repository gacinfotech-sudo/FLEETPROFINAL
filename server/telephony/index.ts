import type { Express } from 'express';
import { registerTelephonyCallRoutes } from './routes/calls';
import { registerTelephonyIdentityRoutes } from './routes/identities';
import { registerTelephonyWebhookRoutes } from './routes/webhook';

// Single entry point server/routes.ts calls, mirroring
// registerGpsConnectionRoutes/registerGpsDeviceRoutes/
// registerGpsAssignmentRoutes's registration pattern for the GPS module.
export function registerTelephonyRoutes(app: Express): void {
  registerTelephonyCallRoutes(app);
  registerTelephonyIdentityRoutes(app);
  registerTelephonyWebhookRoutes(app);
}

export { telephonyProvider } from './providers/registry';
export { setTelephonyEventEmitter } from './services/callService';
export type { TelephonyEvent } from './services/callService';
