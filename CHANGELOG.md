# Changelog — Security & Stability Audit Pass

## 2026-08-04 — P0 security fixes + partial P1

### Removed
- `ADMIN_CREDENTIALS.md` — contained a plaintext admin username/password. **Rotate this credential.**
- `cookies.txt`
- `test-login.js`

### Added
- `connect-mongo`, `file-type` npm dependencies.
- `.gitignore`: `ADMIN_CREDENTIALS.md`, `cookies.txt`, `test-login.js`, `.env*`, `uploads/`.
- `AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `CHANGELOG.md` (this file).
- `server/middleware/security.ts`: `issueCsrfToken`, `csrfProtection` (double-submit CSRF token).
- `server/routes.ts`: `GET /api/csrf-token`, `scopeTenant()` helper, `getSafeImageExtension()`,
  `verifyUploadedImage()`, `servePrivateTenantFile()` (unused for now — reserved for P2 private
  document uploads).
- `client/src/lib/api.ts`: `fetchCsrfToken()`, `getCachedCsrfToken()`, `MUTATING_METHODS` (exported
  for reuse by `queryClient.ts`); `apiRequest()` now fetches/attaches `X-CSRF-Token` automatically
  and self-heals once on a stale-token 403.
- `client/src/lib/queryClient.ts`: `apiRequest()` updated to match (imports the shared CSRF helpers
  from `api.ts` instead of duplicating the logic).
- `server/storage-mongodb.ts`: `findOverlappingBooking()` (private), vehicle double-booking check
  inside `createBooking()`, wrapped in a MongoDB transaction with non-replica-set fallback.

### Changed — security
- `server/connectDB.ts`: retries with backoff, then `process.exit(1)` on fatal failure (was: silent
  continue with a false "in-memory fallback" message — no such fallback exists).
- `server/index.ts`:
  - Global error handler no longer `throw`s after `res.json()`.
  - `process.env.PORT` respected (was hard-coded `5000`).
  - Background job `setInterval` no longer duplicates on MongoDB reconnect.
  - Fixed `emitWarning` override TS typing (pre-existing, unrelated to security).
- `server/routes.ts`:
  - `SESSION_SECRET` now mandatory (min 32 chars) — `process.exit(1)` if missing/short.
  - Session store: `express-session` `MemoryStore` → `connect-mongo` (encrypted payload, 30-day TTL,
    custom cookie name `fleetpro.sid`, `rolling: true`).
  - CSRF middleware wired in after session setup.
  - `/uploads` static mount scoped to `/uploads/logos` and `/uploads/signatures` only (was: entire
    `uploads/` directory public).
  - Multer `filename()` for logo/signature uploads now derives the extension from an allow-list
    keyed by mimetype instead of trusting the client's original filename.
  - Logo/signature upload routes now call `verifyUploadedImage()` (magic-byte check) before
    persisting the file as base64.
  - `/api/admin/fix-booking-audit`: added `requireAdmin`.
  - `/api/test-background-job`: added `authenticateUser` + `requireAdmin` (was fully open), disabled
    outside `NODE_ENV=development`.
  - Wired `requirePermission(PERMISSIONS.MANAGE_VEHICLES | MANAGE_DRIVERS | CREATE_BOOKING |
    EDIT_BOOKING | DELETE_BOOKING)` into the corresponding vehicle/driver/booking mutation routes
    (middleware existed, was never applied anywhere).
  - Removed logging of: full login request bodies, session IDs, full tenant-creation request bodies,
    full mapped booking payloads (customer PII), verbose per-request user/session debug object.
  - `POST /api/bookings`: no longer pre-generates `bookingId` in the route (left to
    `storage.createBooking`, which now includes a random suffix); returns 409 with a clear message
    on `VEHICLE_DOUBLE_BOOKING`.
  - Every vehicle/driver/booking/expense/sub-user single-record route (`GET/PUT/PATCH/DELETE
    /api/vehicles/:id`, `/api/drivers/:id`, `/api/bookings/:id`, `/api/expenses/:id`,
    `/api/users/sub-users/:userId`) now passes `scopeTenant(req)` into the storage call.
  - Multer `filename()` error callbacks now pass `(err, '')` to satisfy TS typing (functionally
    unchanged — multer's runtime behavior with an error is unaffected).
- `server/middleware/auth.ts`: removed the per-request `console.log` of the full authenticated
  user/session object; retained a minimal userId+role log gated to `NODE_ENV === 'development'`.
  Fixed a pre-existing TS narrowing error on `user.tenantId`.
- `server/middleware/security.ts`: added `issueCsrfToken`/`csrfProtection` (see "Added").
- `server/schemas/mongodb-schemas.ts`: `role` Zod enum now includes `'manager'` (was
  `admin|client` only — didn't match the Mongoose model, silently rejected valid manager data).
- `server/storage-mongodb.ts`:
  - `getVehicle/updateVehicle/deleteVehicle`, `getDriver/updateDriver/deleteDriver`,
    `getBooking/updateBooking/deleteBooking`, `getExpense/updateExpense/deleteExpense`: all now
    accept an optional `tenantId` parameter and scope their Mongo query by `{_id, tenantId}` instead
    of bare `findById`/`findByIdAndUpdate`/`findByIdAndDelete`. Update methods also strip `tenantId`
    from the incoming update payload when a `tenantId` scope is provided, so a request body can't
    reassign a record to a different tenant. All now validate `mongoose.Types.ObjectId.isValid(id)`
    before querying.
  - `deactivateSubUser`/`reactivateSubUser`: now accept an optional `tenantId` and require the
    target user to belong to that tenant AND have `role: 'manager'` (previously matched on `userId`
    alone with no tenant or role check — cross-tenant IDOR).
  - `createBooking`: added overlap check against existing `confirmed/ongoing/hold` bookings for the
    same vehicle, wrapped in a MongoDB transaction (`session.withTransaction`) with a fallback path
    for standalone (non-replica-set) MongoDB deployments; `bookingId` generation now includes a
    random suffix to avoid same-millisecond collisions; removed the bare `try { ... } catch` in
    favor of explicit transaction/fallback error handling.
- `server/models/index.ts`: added `deviceInfo?: { userAgent?, ip?, loginTime? }` to the `IUser`
  interface (field existed on the Mongoose schema and was used throughout the storage layer, but was
  missing from the TS interface — pre-existing bug, now fixed).
- `server/vite.ts`: fixed `allowedHosts: true` TS typing (`as const`) — pre-existing, unrelated to
  security.

### Verification
- `npx tsc --noEmit`: zero errors under `server/**` (confirmed before and after this pass to isolate
  which errors were pre-existing vs. introduced — none were introduced).
- `npm run build`: succeeds (`vite build` + `esbuild` bundle of `server/index.ts`).
- Manual boot test with `NODE_ENV=production` and no `MONGODB_URI`: process now exits immediately
  with a clear error (previously would have logged a misleading "in-memory fallback" message and
  continued running in a broken state).

### Known pre-existing issues found but NOT fixed in this pass
See `IMPLEMENTATION_PLAN.md` for the full list and rationale. Notably: field-name duplication across
vehicle create/update (multiple aliases for model/rate fields), several client-side TS errors in
`dashboard.tsx`/`stats-cards.tsx`/`invoice-generator.tsx`/`use-permissions.ts`, no automated tests
exist yet, P2 business workflow completion not started.
