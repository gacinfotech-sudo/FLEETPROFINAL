# FleetPro GPS Existing Code Audit

## Safety baseline

- Starting checkpoint: `f77939b feat: complete Raju customer 360 acceptance`
- GPS branch: `feature/gps-live-tracking-patch`
- Initial worktree: clean
- Database backup: `/Users/pradeep/fleetpro-backups/gps-baseline-20260805-031720`
- Backup scope: 33 collections and 6,135 documents from the configured source database
- Baseline screenshots: Dashboard, Fleet list, Vehicle Profile, Booking Details, Live Operations, and Profile/Settings are stored beside the backup.

## Existing architecture

- Frontend: React 18, TypeScript, Vite, Wouter, TanStack Query, Tailwind and Radix UI.
- Backend: Express/TypeScript on Node, with all current application routes registered in `server/routes.ts`.
- Database: MongoDB through Mongoose; operational records are tenant-linked by `tenantId`.
- Authentication: server-side Express sessions stored in MongoDB, CSRF protection, `authenticateUser`, `requireTenant`, and permission middleware.
- Tenant model: `Tenant`; non-admin users derive `tenantId` from the authenticated user. Admin access is intentionally cross-tenant in existing middleware.
- Permissions: string permissions stored on `User`; admins/clients currently receive broad access, managers use explicit permissions.
- Vehicle model: separate `Vehicle` collection with operational status `available`, `on_trip`, or `maintenance`. No GPS status exists.
- Driver model: separate tenant-scoped `Driver` collection.
- Booking model: links vehicle, optional driver and customer; scheduled and actual date-times are separate; manual start/end odometers and `totalKilometers` already exist.
- Trip model: no independent Trip collection. The booking lifecycle is the current trip workflow.
- Live Operations: `server/services/liveOperations.ts` derives operational buckets from bookings. It contains no telemetry.
- Map library: none found in dependencies or source.
- Realtime: the HTTP server is exposed as `global.notificationServer` and routes call an optional `broadcastNotification` hook, but no GPS stream or browser SSE/WebSocket implementation exists.
- Background work: one guarded five-minute in-process interval marks expired bookings complete. There is no durable queue, distributed lock, retry ledger, or dead-letter queue.
- GPS/location code: no existing GPS provider, device, telemetry, geofence, coordinate, map, or route-history implementation found.
- Odometer code: Booking has manual `startOdometer`, `endOdometer`, and `totalKilometers`; completion validates readings and stores the difference.
- Integration pattern: server-only provider abstraction already exists for WhatsApp and is a useful precedent, but GPS credentials must use a dedicated encrypted connection store.
- Environment handling: `dotenv`, mandatory `MONGODB_URI` and `SESSION_SECRET`, optional provider/environment selectors, and `process.env` access confined to server code.

## Route and module inventory

- 152 existing Express route declarations were recorded before GPS edits.
- Existing route groups: auth/security, tenants/users, dashboard, vehicles, drivers, bookings, operations, payments, customers, invoices, campaigns, WhatsApp, rewards, attendance/leaves, reports, and expenses.
- No existing route or model is renamed or removed by the GPS patch.

## Provider documentation audit

No GPS vendor API documentation or credentials were supplied in the repository, attached assets, environment-variable names, or the provided specification. Consequently no base URL, authentication endpoint, device endpoint, history endpoint, webhook field, WebSocket endpoint, or rate limit is assumed.
