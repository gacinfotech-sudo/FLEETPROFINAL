# Pipeline Permission Inventory

## Enforcement model

`server/middleware/permissions.ts`: `requirePermission(permission)` middleware checks `storage.checkUserPermission(userId, permission)` — admin/client roles get an unconditional pass; manager roles are checked against their own `user.permissions` array (or a `'*'` wildcard). Frontend mirror: `client/src/hooks/use-permissions.ts`'s `usePermissions()` hook implements the *same* logic (`hasPermission`) independently but consistently — verified matching, not diverging.

## Spot-checked sensitive actions

| Action | Frontend gate | Backend gate | Finding |
|---|---|---|---|
| View revenue/driver-performance/vehicle-performance | `restrictedForManagers` (sidebar + `dashboard.tsx` URL guard) | ~~none~~ → **`requirePermission(PERMISSIONS.VIEW_REVENUE)` added this phase** | **Fixed P0** — was a real backend gap; any authenticated tenant user could bypass the frontend hiding via direct API call. See Bug Report #1. |
| Finalize an invoice | ~~none~~ → **`canGenerateInvoice()` gate added this phase** | `requirePermission(PERMISSIONS.GENERATE_INVOICE)` (already correct) | **Fixed P2** — backend was already safe; frontend now matches for a consistent UX (disabled + tooltip instead of a surprise 403 after clicking). See Bug Report #5. |
| Export a report/list (Revenue Report PDF) | Same `restrictedForManagers` gating (whole screen hidden) | Inherits the same `/api/reports/revenue` fix above (client-side jsPDF generation from already-fetched data, no separate export endpoint) | Covered by the same fix. |
| Manage users / tenant settings | `adminOnly` (sidebar) + inline role check in `dashboard.tsx` | Inline `role !== 'admin' && role !== 'client'` checks on each sub-user route + `requireAdmin` on platform-level `/api/admin/tenants/*` | Correct, though implemented as ad hoc inline checks rather than a shared `requirePermission` call — consistent enough, not changed (would be a larger refactor for no functional gain). |

## Permission constants available (`server/middleware/permissions.ts`, `PERMISSIONS`)

`CREATE_BOOKING, DELETE_BOOKING, EDIT_BOOKING, VIEW_BOOKINGS, GENERATE_INVOICE, MANAGE_VEHICLES, MANAGE_DRIVERS, VIEW_REVENUE, MANAGE_USERS, MANAGE_CAMPAIGNS, MANAGE_INVOICE_SETTINGS` plus the Inquiry/Lead/Quotation/Followup CRM permission set (`inquiry.*`, `lead.*`, `quotation.*`, `followup.*`). `VIEW_REVENUE` existed but was unused on the backend before this phase's fix — now wired to its 3 intended routes.

## Tenant isolation spot-check (5 models)

Every query checked (`Customer`, `Booking`, `Invoice`, `PaymentTransaction` ×2) derives `tenantId` from the server-side `req.tenantId` (set by `authenticateUser` from the authenticated session, never from client-supplied body/query params) — no cross-tenant leak found in this sample. One soft spot documented, not fixed (intentional design, not a bug) — see Bug Report #14 (`storage.getDriver`'s optional `tenantId` parameter, mirroring an identical documented pattern on `getVehicle`).

## Sub-user management routes — hardened this phase

`DELETE /api/users/sub-users/:userId` and `PATCH /api/users/sub-users/:userId/reactivate` were missing the `requireTenant` middleware present on their sibling create/list routes (narrow edge case for an orphaned tenant-less admin/client user). Added for consistency — see Bug Report #4.
