# Vendor 360° — Migration

## Phase 1 status: no migration needed yet

Phase 1 only adds new, empty collections (`Vendor`, `Counter`) and does not touch or
require backfilling any existing `Booking` documents. There is nothing to migrate for
Vendor Master to function — it starts empty and is populated going forward by real
vendor creation through the API/UI.

## Deferred: linking existing free-text booking vendor mentions

Existing `Booking` documents already carry free-text vendor/agent fields from the
earlier "Booking Source" patch this session (plain strings — company name, contact,
etc., not linked to any structured record). Section 23 of the spec asks for an
idempotent migration that scans these, normalizes mobile numbers and vehicle
registrations, suggests `Vendor` records, and links bookings to them without
auto-merging distinct vendors or deleting old fields.

This is explicitly deferred until **after** Vendor Drivers and Vendor Vehicles exist
(Phase 2/3) — running it now would only be able to create bare `Vendor` shells with no
driver/vehicle data behind them, defeating the point of a "suggest existing records"
migration. Building it early would also mean rewriting it once driver/vehicle linking
logic exists, which the spec's own "no duplicate architecture" principle argues
against.

Planned command surface (not yet implemented):

```bash
npm run migrate:vendor-360:dry-run   # scan + report only, no writes
npm run migrate:vendor-360           # apply, idempotent (safe to re-run)
npm run migrate:vendor-360:rollback  # undo a prior apply run
```

Each run will be logged with counts of: bookings scanned, vendors suggested, vendors
auto-linked (unambiguous single match), conflicts flagged for manual review, and
records left untouched. No automatic merging of two different vendors will ever
happen — conflicts are reported, not resolved silently.
