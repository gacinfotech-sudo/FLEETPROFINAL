# Allowed patch scope

Customer 360 work may change only these areas unless this file is updated with a reason before the change:

- `server/models/index.ts` for backward-compatible customer-related schemas and references
- `server/services/customerService.ts` and customer-specific service modules
- `server/services/timelineService.ts` for linked Customer 360 events
- Customer API blocks in `server/routes.ts`
- Driver-feedback/profile API blocks in `server/routes.ts` for Phase 5 Customer-to-Driver integration
- Vehicle-feedback/profile and vehicle-performance API blocks in `server/routes.ts` for Phase 6 Customer-to-Fleet integration
- `client/src/pages/customers.tsx`
- `client/src/components/customers/**`
- `client/src/components/drivers/driver-feedback-profile.tsx` and the existing Driver Profile dialog insertion point in `client/src/pages/dashboard.tsx`
- `client/src/components/fleet/vehicle-feedback-profile.tsx`, `client/src/pages/vehicle-performance.tsx`, and the existing Fleet Management insertion points in `client/src/pages/dashboard.tsx`
- Customer-focused tests in `tests/e2e/**`
- `playwright.config.ts` only to let the isolated worktree target its own test port
- Customer migration scripts in `scripts/**`
- Documentation in `docs/customer-360/**`

Explicitly excluded: application shell, sidebar/header structure, existing booking page structure, Vendor 360 files, unrelated driver/fleet/payment behavior, and destructive database operations. Phase 5 may add computed customer-feedback analytics to the existing Driver Profile dialog, but may not replace Driver Management or its operational fields. Phase 6 may add a read-only Vehicle Profile dialog and customer-feedback metrics to the existing Fleet/Vehicle Performance views, but may not replace Fleet Management, vehicle editing, pricing, availability, or expense accounting.
