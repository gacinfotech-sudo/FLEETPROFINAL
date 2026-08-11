# TASK-DRIVER-DOCUMENTS-03 — Report

Branch: `driver/documents-03-google-drive`. Worktree: `fleetpro-worktrees/driver-google-documents`.

## Note on the task/spec files themselves

`.claude/tasks/active/**` and `docs/driver-research/**` are untracked working-directory
content in the main checkout (`git ls-files` returns zero for both paths on trunk) — `git
worktree add` only materializes committed files into a new worktree, so this worktree
started with neither directory present. The task/manifest/spec files were read from
`fleetpro-main-p0-fixed/fleetpro-main/.claude/tasks/active/TASK-DRIVER-DOCUMENTS-03.md`,
`.../DRIVER-LIFECYCLE-MANIFEST.md`, and `.../docs/driver-research/{GOOGLE-DRIVE-SECURITY-SPEC,
DRIVER-DOCUMENT-MATRIX,CURRENT-DRIVER-MODULE-AUDIT}.md` instead. All code/tests below were
built in this worktree as instructed. Flagging this in case other drivers-initiative workers
hit the same gap.

## What was built

All new code under `server/driver/documents/**` (this task's exclusive ownership):

- `types.ts` — `DocumentType` enum (13 matrix types + `other`), access-classification and
  retention-status enums, and the `DOCUMENT_TYPE_ACCESS_CLASSIFICATION` /
  `DOCUMENT_TYPE_EXPIRY_BEARING` maps transcribed 1:1 from `DRIVER-DOCUMENT-MATRIX.md`.
- `permissions.ts` — proposed permission string constants (not added to the real
  `PERMISSIONS` object — see "Proposed patches" below).
- `security/documentEncryption.ts` — AES-256-GCM envelope encryption, structurally identical
  to `server/gps/security/credentialEncryption.ts` but keyed by its own env var
  (`DRIVER_DOCUMENT_ENCRYPTION_KEY`), used for both Drive connection credentials and raw
  (unmasked) document numbers.
- `drive/serviceAccountAuth.ts`, `drive/driveApiClient.ts` — a dependency-free Google Drive
  API v3 REST client (service-account JWT-bearer auth via Node's built-in `crypto.sign`, and
  an OAuth-refresh-token path) built on global `fetch`. See "Why no `googleapis` dependency"
  below.
- `drive/clientFactory.ts` — resolves a `DriveClient` from decrypted connection credentials;
  carries a test-only override seam (`setDriveClientFactoryForTesting`).
- `models/tenantGoogleDriveConnection.ts` — one Drive connection per tenant (unique index on
  `tenantId`), encrypted credentials, mirrors `gpsConnection.ts`'s shape.
- `models/driverDocument.ts` — the document registry: every field the Google Drive Rule
  lists, plus an embedded `versions[]` array for history.
- `models/driverDocumentAuditLog.ts` — mirrors `GpsAuditLog`'s shape; every
  upload/replace/verify/view/download/connection-change writes one row.
- `services/{folderService,connectionService,documentService,fileServing,masking}.ts` — the
  business logic (folder resolution, upload/version/verify, tier-gated redaction, the
  Drive-backed file-serving handler, Aadhaar/PAN masking).
- `routes/{connectionRoutes,documentRoutes}.ts` + `index.ts` — the HTTP surface, mounted via
  a single `registerDriverDocumentModule(app)` call (same shape as
  `registerGpsConnectionRoutes`/etc.).
- `validation.ts` — Zod schemas for every request body.

Tests, under `tests/e2e/` (this task's exclusive ownership):
`driver-documents-lifecycle.spec.ts`, `driver-documents-access-control.spec.ts`,
`driver-documents-drive-auth-live.spec.ts`.

## Endpoints (as specified, all mounted by `registerDriverDocumentModule`)

- `POST /api/drivers/:driverId/documents` — multipart upload (`multer`, memory storage,
  15MB cap; real file-type sniffing via `file-type`'s `fileTypeFromBuffer`, not the
  client-supplied Content-Type — same P0 pattern `server/routes.ts` already uses for
  images). Requires `driver_document.manage`.
- `GET /api/drivers/:driverId/documents` — tier-filtered list. Requires `driver_document.view`.
- `GET /api/driver-documents/:documentId` — single record, same tier filtering.
- `POST /api/driver-documents/:documentId/verify` — independent of upload. Requires
  `driver_document.verify`.
- `GET /api/driver-documents/:documentId/file[?download=1]` — streams bytes from Drive,
  never a link. Requires `driver_document.view` (+ `driver_document.view_high` for
  High-tier documents).
- Drive connection CRUD under `/api/driver-documents/drive-connection*` — mirrors
  `server/gps/routes/connections.ts` (create/get/update/rotate-credentials/test).

## Google Drive connection design: service account (primary), OAuth-consent (schema-only)

**Decision: service account is the implemented, exercised path.** Rationale:

1. The file-serving route (`GET /api/driver-documents/:id/file`) must work on every
   authenticated staff request with no human in the loop — a service account's credentials
   never expire/require re-consent; an OAuth-consent refresh token technically doesn't either,
   but ties the connection's continued validity to a specific Google user's account state
   (suspended/2FA-reset/deprovisioned) in a way a dedicated service account does not.
2. It matches this repo's one existing external-provider-credential pattern (GPS connections)
   — none of which use an interactive OAuth-consent UI; `authenticationType` values are all
   non-interactive (api_key/bearer_token/basic/oauth_client_credentials/session_login).
3. It avoids the higher-privilege domain-wide-delegation path entirely (the spec explicitly
   flags that as an elevated attack surface) — the tenant creates a Shared Drive in their own
   Workspace and adds the service account as a Content Manager member, so its reach is
   narrowly scoped to exactly that one Shared Drive.

**OAuth-consent is schema-supported but not wired to an interactive UI in this pass** — the
data model (`authType: 'oauth_consent'`) and the token-refresh client
(`OAuthRefreshTokenProvider`) both exist and are real, but the authorize-URL/callback
endpoints that would let a tenant owner complete a one-time consent flow are not built. This
was a scope call: building that flow (state-token CSRF protection, callback route, refresh
token capture) is meaningfully more work for a path this task recommends against by default.
Flagging for whoever picks this up if a tenant genuinely can't provision a service account.

**Why no `googleapis`/`google-auth-library` dependency**: the repo has neither today, and
adding one touches `package.json` + `package-lock.json` — both Integrator-only shared files
per `.claude/rules/parallel-dispatch.md`, and this worktree's `node_modules` is a symlink
shared with the main checkout and several other concurrently-running worktrees, so an
`npm install` here risks mutating a directory other workers' `tsc`/tests depend on mid-run.
Instead, `drive/serviceAccountAuth.ts` and `drive/driveApiClient.ts` implement the documented
JWT-bearer service-account flow and the Drive API v3 REST contract directly against Node's
built-in `crypto` + global `fetch` (Node 24 here) — real request shapes (multipart upload
with the exact metadata+media boundary format, `supportsAllDrives`/`corpora=drive` query
params for Shared Drive support, etc.), not a simplified stand-in. **Proposed
`package.json` patch** (for the Integrator, if the team prefers the SDK over this): add
`"googleapis": "^144.0.0"` — not applied here.

## `servePrivateTenantFile()` — why it's not called directly, and what was reused instead

`servePrivateTenantFile()` (`server/routes.ts:190-220`) is a closure private to
`registerRoutes()` — not exported, so `server/driver/documents/**` cannot import it — and it
serves bytes from a local filesystem (`baseDir/tenantId/filename`), which doesn't fit
Drive-backed documents (Drive holds file bytes only; there is no local file at all).
`services/fileServing.ts`'s `serveDriverDocumentFile()` reimplements the exact same security
**shape**: tenant identity resolved only from the authenticated session (never a request
parameter), a 404 (not 403) on any not-found-or-wrong-tenant case so existence in another
tenant is never confirmable, and a safe, non-PII-derived filename in `Content-Disposition`.
On top it adds the two things the generic helper never needed: an access-tier check and a
mandatory audit-log write on every access. **Proposed patch**: export
`servePrivateTenantFile` from `server/routes.ts` (drop the `void servePrivateTenantFile;`
line and add `export`) so a future local-cache layer, if one is ever added on top of Drive,
could reuse it directly instead of re-deriving the pattern a third time.

## Proposed patches (for the Integrator — none applied to protected files)

**`server/routes.ts`** (2 lines, same shape as the existing GPS registration):
```ts
import { registerDriverDocumentModule } from "./driver/documents/index";
// ...
registerGpsConnectionRoutes(app);
registerGpsDeviceRoutes(app);
registerGpsAssignmentRoutes(app);
registerDriverDocumentModule(app);
```
Optionally also: `export function servePrivateTenantFile(...)` (see above) and remove the
now-inaccurate `// currently unused` comment on it.

**`server/middleware/permissions.ts`** — merge `DRIVER_DOCUMENT_PERMISSIONS` from
`server/driver/documents/permissions.ts` into the canonical `PERMISSIONS` object verbatim
(7 keys: `driver_document.{view,view_high,manage,verify,retention_manage}`,
`drive_connection.{view,manage}`). Routes already use the literal string values via
`requirePermission()`, so this merge is additive and doesn't change route behavior — it just
makes the constants importable/discoverable from the canonical location.

**`.env.example`** — add:
```
# 32-byte key (64 hex chars or base64). Required only when saving encrypted Google
# Drive connection credentials or raw (unmasked) driver document numbers; never
# expose to the client. Same convention as GPS_CREDENTIAL_ENCRYPTION_KEY, kept as a
# separate key so the two initiatives' secrets rotate independently.
DRIVER_DOCUMENT_ENCRYPTION_KEY=
```

**`server/models/index.ts`** — no change needed/proposed; this task's models are
self-contained in `server/driver/documents/models/**`, same as GPS's models live under
`server/gps/models/**` rather than the shared index.

## Acceptance criteria — status

- **No document ever reachable via a public/unauthenticated URL** — verified with a real
  unauthenticated HTTP request (fresh `request` fixture, no cookies) against the real running
  server: `GET /api/driver-documents/:id/file` → `401`, response body checked to not contain
  file magic bytes. See `driver-documents-access-control.spec.ts`.
- **Aadhaar-type documents store a masked number; raw number never in a log statement or a
  below-High-tier API response** — grep-verified (a real filesystem grep in the test,
  scanning every `.ts` file under `server/driver/documents/` for
  `console.(log|error|warn|info|debug)` lines mentioning `documentNumber`: zero matches) and
  HTTP-verified (a `driver_document.view`-only session sees `maskedDocumentNumber` but
  `documentNumber: undefined` for a High-tier document; a
  `driver_document.view_high`-holding session sees the real value).
- **Every upload creates a new version record; verification is a distinct, permission-gated
  action** — verified at the service level (stubbed Drive client): a second upload of the
  same `(driver, documentType)` pushes the prior version into `versions[]` (old `driveFileId`
  preserved) rather than overwriting, resets `verificationStatus` to `pending`, and
  `verifyDriverDocument()` never touches `uploadedBy`/`driveFileId`. HTTP-verified: a session
  without `driver_document.verify` gets `403` on the verify route.
- **Folder-structure document-type names match the enum exactly** — the stubbed
  `ensureFolder` calls in the lifecycle test assert the document-type-level folder name
  equals the literal `documentType` enum value; the driver-level folder name equals the
  Driver's Mongo `_id`, never a mutable field.
- **Offboarding does not trigger immediate deletion** — `setRetentionHoldForDriver()` only
  ever transitions `retentionStatus` to `retention_hold`; there is no delete/erasure route or
  function anywhere in this module. Verified: after calling it, the document is still
  `findById`-able with its `driveFileId` unchanged.
- **Cross-tenant access is impossible** — a document row seeded under an unrelated fake
  tenant/driver returns `404` (never `403`, so existence is never confirmable) from both the
  metadata and file routes, via real HTTP against the running server.

## What was verified live vs. mock-only

**Live** (real network, real HTTP, real MongoDB, no mocking of this module's own logic):
- All tenant-isolation, auth, and permission-tier checks (`driver-documents-access-control.spec.ts`)
  — real requests against a real running `tsx server/index.ts` instance and the shared dev
  MongoDB.
- The service-account JWT-bearer token exchange reaching Google's real
  `https://oauth2.googleapis.com/token` endpoint (`driver-documents-drive-auth-live.spec.ts`)
  — a real (locally-generated, never-registered) RSA key signs a real JWT that Google's server
  receives, parses, and rejects with `invalid_grant: account not found` (HTTP 400) rather than
  a format/network error — proving the request construction is contractually correct. This is
  **not** a full authenticated Drive operation — no real service account exists in this
  sandbox to prove one end-to-end.

**Mock/stub-level only** (no real Drive credentials available in this environment):
- Folder creation/resolution, file upload, permission-listing/removal, and file download —
  exercised via a stub `DriveClient` passed as an explicit function parameter to
  `uploadDriverDocument()`/`serveDriverDocumentFile()` (dependency injection at the call
  site, not a runtime monkeypatch), in `driver-documents-lifecycle.spec.ts`. This covers 100%
  of this module's own business logic (version history, masking, audit writes, the
  public-permission defensive check) with only the actual Google Drive HTTP calls replaced.
- The Drive connection `POST .../test` route's real-connection success path (it does make a
  real Drive API call structurally, but was only exercised against Google's real servers
  indirectly via the auth-live test above, not through the full connection-test route with a
  real Shared Drive).

## Test results

`npx playwright test tests/e2e/driver-documents-*.spec.ts --reporter=list` (against a
temporarily-wired local instance on port 5071 — see below): **11/11 passed**.
`npx tsc --noEmit`: clean, no errors.

Port note: the manifest suggested `PORT=5061` for this worktree. That port is on Chromium's
restricted-ports list (SIPS default), which makes every `page.goto()`-based Playwright test
fail with `ERR_UNSAFE_PORT`. Used `PORT=5071` instead (outside both the contested default
`5050` and the driver-lifecycle batch's assigned `5060-5066` range). Flagging for other
drivers-initiative workers who might hit the same thing if they picked a port in that range.

**How the routes were exercised without touching `server/routes.ts`**: `server/routes.ts` was
temporarily, locally patched (two lines, the exact patch proposed above) to register this
module, the dev server was restarted, the full test suite was run against it, and the patch
was reverted (`git checkout -- server/routes.ts`) before this report was written — confirmed
via `git status --porcelain server/routes.ts` (clean) and a final `npx tsc --noEmit` (clean).
The committed diff never includes this file.

## Notes for downstream tasks

- **TASK-DRIVER-ONBOARDING-UI-04**: `GET /api/drivers/:driverId/documents` returns
  `DocumentListView[]` (see `services/documentService.ts`) — `hasFileAccess: boolean` tells
  the UI whether to render a "view/download" control or a permission-denied state per row;
  don't assume every row is downloadable. `maskedDocumentNumber` is always safe to display;
  `documentNumber` is `undefined` unless the viewer holds `driver_document.view_high` AND the
  document is High-tier.
- **TASK-VEHICLE-HANDOVER-05**: `vehicle_handover_acknowledgement` is already a
  `documentType` in the matrix/enum — per the matrix's own note, store handover
  acknowledgements through this same registry (`uploadDriverDocument()` /
  `POST /api/drivers/:id/documents` with `documentType=vehicle_handover_acknowledgement`)
  rather than a separate mechanism.
- **TASK-DRIVER-OPERATIONS-06**: `setRetentionHoldForDriver({tenantId, driverId, reason,
  actorUserId})` (exported from `server/driver/documents/index.ts`) is the offboarding
  integration point — call it from the offboarding flow; it is not wired to any event itself.
  Expiry-alert data is on `DriverDocument.expiryDate`/`issueDate`
  (`DOCUMENT_TYPE_EXPIRY_BEARING` in `types.ts` tells you which types carry it).
- **TASK-DRIVER-DOMAIN-02** (concurrent): this task depended only on Driver IDs being stable
  Mongo ObjectIds, which they already are — nothing about a shipped lifecycle-stage contract
  changes this module's design. If DOMAIN-02 introduces a *replacement* Driver id/collection
  (it shouldn't, per the manifest's "don't create a second Driver master" rule), folder names
  and the `driverId` ref in `DriverDocument`/audit logs would need updating.
- **TASK-DRIVER-QA-SECURITY-07**: the grep-verified no-raw-Aadhaar-in-logs check and the
  folder-name/enum pairing check in this task's own suite are narrow (this module only); your
  full pass should probably broaden both repo-wide.
