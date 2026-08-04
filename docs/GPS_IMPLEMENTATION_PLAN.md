# FleetPro GPS Incremental Implementation Plan

Every phase is additive, tenant-scoped, permission-controlled and committed independently.

1. Safety baseline, existing-code audit, provider-neutral types, adapter contract and registry.
2. Encrypted tenant GPS connection model, redacted DTOs, permissions, CRUD/test boundary and audit records.
3. GPS Device Master and provider device synchronization with idempotent tenant indexes.
4. Historical vehicle-device assignments with one-active-device/vehicle enforcement.
5. Normalization, validation, deduplication and time-series telemetry storage.
6. Durable ingestion job records, webhook acknowledgement, retry/dead-letter processing and provider health.
7. Derived vehicle live state plus authenticated tenant-scoped SSE or existing realtime bridge.
8. Additive Live Map panel using a map adapter; no markers without stored telemetry.
9. Vehicle Profile and Booking Details GPS sections.
10. Route history, gap-aware replay, noise-filtered distance and trip reconciliation.
11. Geofences, alert rules, grouped incidents and cooldown suppression.
12. Dashboard/owner summaries, utilization, reports, exports, retention and final acceptance.

## Preserve-first boundaries

- Booking controls remain authoritative; GPS movement cannot silently start or finish a booking.
- Vehicle operational status remains separate from GPS movement/health status.
- GPS data cannot mutate payments or finalized invoices.
- Existing odometers remain manual evidence; GPS reconciliation stores its own source and approval.
- Provider and map integrations remain separate adapters.
- No production demo telemetry, random marker, hard-coded speed or false connected state is permitted.

## Current blocker for a real provider adapter

The selected provider name, official API documentation/version, tenant test account, authentication flow, device and history response examples, webhook signing specification, streaming support, and rate-limit rules are still required. Until supplied, connections must remain `configuration_required` and no provider factory is registered.
