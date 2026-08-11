# Vendor 360° — Repository Audit

Audit performed before any Vendor 360° code was written, to confirm the patch fits the
existing architecture rather than introducing a second one.

## Stack

- Frontend: React + Vite + TypeScript, Wouter routing, TanStack Query, shadcn/Radix UI components, Tailwind.
- Backend: Node.js + Express, single large `server/routes.ts`, single large `server/models/index.ts` (Mongoose).
- Database: MongoDB via Mongoose.
- Auth: session-based (`authenticateUser` middleware), CSRF via `/api/csrf-token` + `X-CSRF-Token` header on mutating requests.
- Tests: Playwright, `tests/e2e/*.spec.ts`, run against the live dev server (not mocked).

## Existing patterns identified and reused (not duplicated)

- **Tenant isolation**: every tenant-owned collection carries `tenantId: ObjectId`, and every route scopes queries with `{ ..., tenantId: req.tenantId }`. `Vendor` follows this exactly.
- **Soft delete**: `isDeleted: boolean` flag rather than hard deletes (`Customer`, now `Vendor`).
- **Ledger pattern**: derived/financial totals are never directly client-editable — they're computed from an append-only transaction collection (`PaymentTransaction` → `Booking.advanceReceived`, `RewardTransaction` → `Customer.rewardPointsBalance`). Vendor Payable/Receivable (Phase 2+) will follow the same pattern via `VendorTransaction`.
- **Permissions**: `server/middleware/permissions.ts` — a flat `PERMISSIONS` string-constant map, `requirePermission(code)` middleware, checked against `user.permissions` (admin/client bypass everything). New `VENDOR_VIEW` / `VENDOR_CREATE` / `VENDOR_EDIT` / `VENDOR_BLOCK` constants were added to this same map — no parallel permission system was created.
- **Safe-merge PATCH**: the existing `PUT /api/customers/:id` deletes a denylist of derived fields from `req.body` before applying it. `PATCH /api/vendors/:vendorId` uses the stricter converse — an explicit allowlist with `!== undefined` checks and shallow-merge on nested objects (`businessDetails`, `bankDetails`, `address`) — per this spec's explicit "never `vendor = req.body`" requirement.
- **4-spot dashboard wiring**: adding a view = (1) `ViewType` union in `dashboard.tsx`, (2) `allowedSections` array, (3) `restrictedSections` array (manager exclusion), (4) `renderContent()` switch case, plus a `navItems` entry in `sidebar.tsx`. Used verbatim for the new `"vendors"` view — no sidebar/header/layout code was touched otherwise.
- **Phone normalization**: `normalizeIndianPhone()` in `server/whatsapp/phone.ts`, already used by `Customer`/`CustomerConsentEvent`/booking flows, reused for `Vendor.normalizedMobile`.

## Existing Vendor-related fields found

`Booking` already has a free-text vendor/agent block from the earlier "Booking Source" patch this session (`bookingSource`, `vendorName`, `vendorContact`, etc. — plain strings, not linked to any Vendor record). This is the exact target of the Section 23 migration (link existing free-text booking vendor mentions to real `Vendor` records) — **not yet run**; scoped as a later patch once Vendor Drivers/Vehicles exist to link against too.

## No git history existed

This repository had no `.git` directory at all before this patch (confirmed via `git status` → "not a git repository"). `git init` was run, all current working-tree files were committed as `checkpoint: before Vendor 360 implementation` on a `main`-equivalent initial branch, and `feature/vendor-360-patch` was branched from it — satisfying the spec's "create a Git checkpoint" requirement for a project that had no version control to begin with.

## Conclusion

The codebase conventions are simple and consistent enough that Vendor 360° needs no new subsystem — only new Mongoose models, new route handlers in the existing `routes.ts`, a new service file per module (matching `customerService.ts`, `campaignService.ts`, `rewardService.ts`), and new page components wired through the existing 4-spot pattern. Phase 1 (this patch) follows exactly that.
