# GPS Phase 3 — Device Master

## Delivered

- Added a separate tenant-scoped GPS Device collection; the existing Vehicle collection remains unchanged.
- Added device list, detail and allowlisted update APIs.
- Added provider device synchronization through the registered backend adapter only.
- Added idempotent provider-device matching, duplicate rejection, bounded/sanitized provider metadata and audit records.
- Added soft removal; old device records are not physically deleted.

## Provider behavior

- Device sync requires an enabled connection with a verified `connected` status.
- The current undocumented provider remains `configuration_required`; its sync endpoint returns HTTP 409 and creates zero devices.
- Device online/offline/location values are accepted only from normalized provider records. No production location or status is generated locally.

## Database compatibility

- New collection: `gpsdevices`.
- Unique active indexes: tenant/connection/provider device ID, tenant/internal device code and tenant/IMEI.
- Query indexes: tenant/status/last seen and tenant/connection/deletion state.
- `rawMetadata` is excluded from normal reads and bounded to 32 KB after unsafe-key sanitization.
- GPS audit records gained an optional `deviceId`; existing audit records remain compatible.
- No existing Vehicle, Booking or Driver field changed. No migration is required.

## Verification

- Provider sync creates one canonical device, updates it idempotently and rejects duplicate/invalid provider records.
- API tests verify redaction, immutable provider ID, duplicate provider ID/IMEI protection, cross-tenant 404, audit creation and soft removal.
- Undocumented-provider sync was verified to create no fake device data.
