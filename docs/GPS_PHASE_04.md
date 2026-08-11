# GPS Phase 4 — Vehicle / Device Assignment

## Delivered

- Added a separate, tenant-scoped vehicle-to-GPS-device assignment collection. Existing Vehicle and GPS Device records remain authoritative and unchanged.
- Added active assignment, assignment history, replacement and explicit unassignment APIs under the existing vehicle resource.
- Enforced one active device per vehicle and one active vehicle per device with service validation and database unique indexes.
- Preserved effective-dated assignment history so telemetry can be resolved to the vehicle that owned a device at the event time.
- Added tenant-scoped audit events for assignment, replacement and unassignment.
- Preserved an assigned device's internal assignment state when provider status is synchronized.

## API compatibility

- `GET /api/vehicles/:vehicleId/gps-assignment`
- `GET /api/vehicles/:vehicleId/gps-assignment-history`
- `POST /api/vehicles/:vehicleId/gps-assignment`
- `DELETE /api/vehicles/:vehicleId/gps-assignment`

All endpoints use the existing authentication, tenant context, CSRF protection and GPS permissions. Cross-tenant vehicle IDs return `404` and never reveal assignment data.

## Database compatibility

- New collection: `vehiclegpsassignments`.
- New optional audit-log field: `vehicleId`.
- Existing Vehicle, Booking, Driver and GPS Device fields were not renamed, removed or replaced.
- Historical assignments are ended, not deleted.
- No migration of existing records is required.

## Verification

- TypeScript check passed.
- GPS Playwright regression suite passed: 8/8.
- Production build passed.
- Tests cover idempotent assignment, device and vehicle conflicts, faulty-device rejection, provider-sync status preservation, replacement history, effective-date lookup, database uniqueness, cross-tenant denial, audit events and idempotent unassignment.
- Verification used an isolated clone database; no production GPS location was generated.
