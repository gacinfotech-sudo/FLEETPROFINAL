# Allowed patch scope

Customer 360 work may change only these areas unless this file is updated with a reason before the change:

- `server/models/index.ts` for backward-compatible customer-related schemas and references
- `server/services/customerService.ts` and customer-specific service modules
- `server/services/timelineService.ts` for linked Customer 360 events
- Customer API blocks in `server/routes.ts`
- `client/src/pages/customers.tsx`
- `client/src/components/customers/**`
- Customer-focused tests in `tests/e2e/**`
- `playwright.config.ts` only to let the isolated worktree target its own test port
- Customer migration scripts in `scripts/**`
- Documentation in `docs/customer-360/**`

Explicitly excluded: application shell, sidebar/header structure, existing booking page structure, Vendor 360 files, unrelated driver/fleet/payment behavior, and destructive database operations.
