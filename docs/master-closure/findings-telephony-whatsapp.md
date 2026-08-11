# Telephony & WhatsApp Domains — Evidence Audit

Audit date: 2026-08-07. Read-only investigation: no servers started/stopped, no
migrations run, no writes made to the shared MongoDB (`127.0.0.1:27017`, db `fleetpro`).
DB evidence below is from read-only `countDocuments`/`find`/`distinct` queries only.

## Ancestry facts (verified this session)

Run from `fleetpro-main` (`git merge-base --is-ancestor <sha> <branch>`):

| Commit / Branch | Contains telephony module (`server/telephony/**`)? | Contains atomic webhook-dedupe fix (`78ff849`)? | Ancestor of trunk `booking/integration-preview` (20bd273)? |
|---|---|---|---|
| `task/telephony-02-multiuser-isolation` (7bc8b9c, `fleetpro-telephony-rbac`) | YES (original, pre-Integrator layout) | NO (predates the fix) | NO |
| `rescue/telephony-webhook-dedupe-fix` (c9de36f) | YES (Integrator-merged layout) | YES (`78ff849` is on this branch) | NO |
| `feature/local-network-access` (0931ccc, `telephony-fix-landing`) | YES (= merge of rescue branch into the LAN branch) | YES | NO |
| `preview/manual-test-reconciled` (0931ccc) | YES (identical commit to above) | YES | NO |
| `integration/reconcile-trunk-booking-20260807` (200919b, `reconcile-trunk-booking`) | YES (via `9d2bd9c` TASK-01-05 batch) | **NO** — has the pre-fix, check-then-act `resolveInboundEvent()` | NO |
| `booking/integration-preview` (20bd273, **trunk**) | **NO** — `server/telephony` does not exist in this tree at all | NO | — |
| `runtime/stable-demo` (bdf4457, **Live Preview**) | **NO** | NO | — (older than trunk; also predates telephony work: `bdf4457` is an ancestor of the rescue branch, i.e. telephony was built *after* Preview's baseline and never landed back into it) |

**Key structural finding:** telephony work exists in at least three different lineages
that have never been reconciled with each other or with trunk:
1. The original `task/telephony-02-multiuser-isolation` work (own standalone `server/telephony/models/*.ts`).
2. The Integrator's consolidated version (`server/telephony/**` slimmed down, models
   folded into `server/models/index.ts`), which is what `rescue/telephony-webhook-dedupe-fix`
   and `telephony-fix-landing` build on.
3. `reconcile-trunk-booking`, which merged the *pre-dedupe-fix* state of lineage #2 together
   with the booking-domain work — so it has telephony, but with the race condition still present.

None of the three converge on `booking/integration-preview` (current trunk) or
`runtime/stable-demo` (current Live Preview). `curl` confirms this live: trunk/Preview
`GET /api/telephony/webhook` and `GET /api/telephony/calls` both return **HTTP 200 with
the Vite SPA `index.html` body** (the app's catch-all, not a real route — confirmed by
diffing against a deliberately bogus `/api/totally-bogus-route-xyz`, which returns the
identical 200/HTML). By contrast `GET /api/whatsapp/session/status` on both trunk and
Preview returns real JSON (`401 {"message":"Authentication required"}`), proving that
route *is* registered — direct evidence telephony is absent and WhatsApp is present on
both live instances.

## WhatsApp: what exists in trunk (VERIFIED_CODE + VERIFIED_RUNTIME)

`server/whatsapp/**` (index.ts, baileysProvider.ts, mockProvider.ts, types.ts, templates.ts,
customerTemplates.ts, quotationTemplates.ts, sendBookingMessage.ts, sendQuotationMessage.ts,
phone.ts) is present and wired into `server/routes.ts` on **trunk itself** — this is not an
unreconciled worktree feature. `@whiskeysockets/baileys@^7.0.0-rc14` is a real dependency in
`package.json`. Provider is selected via `WHATSAPP_PROVIDER` env (`baileys` default | `mock`;
comment placeholders only for `meta_cloud`/`twilio`/`gupshup` — **no official WhatsApp
Business API adapter is implemented anywhere in any worktree searched** (`fleetpro-main`,
`fleetpro-telephony-rbac`, `fleetpro-customer360` all show only the same comment).

DB evidence (read-only query against the shared `fleetpro` DB, 2026-08-07):
- `whatsappmessages`: **4,729 documents**, all under a **single tenantId** (this is trunk's
  demo tenant) — 246 `status:"sent"` via `provider:"baileys"`, 4,483 `status:"failed"`
  (mostly `"WhatsApp session not connected for this tenant"`, i.e. the session isn't
  currently linked — consistent with `whatsapp-sessions/` on disk holding only 2 tenant
  subfolders and no confirmed-active session at the time of this audit).
- Sample delivered messages are real Hindi booking-confirmation text built from actual
  booking documents (`buildBookingConfirmationMessage`), not placeholders.
- `idempotencyKey` values follow the pattern
  `{tenantId}_{bookingId}_{messageType}_{phone}_v{n}`, backed by a **unique partial index**
  (`{idempotencyKey:1}`, unique, `partialFilterExpression: status in [queued,sent]`) — this
  is WhatsApp's own dedupe guard against double-sends, independent of the telephony webhook
  dedupe fix.

## Telephony webhook dedupe fix — what it actually contains (VERIFIED_CODE, NOT integrated)

`rescue/telephony-webhook-dedupe-fix` commit `78ff849` replaces a check-then-act race in
`resolveInboundEvent()` (find by `(tenantId, providerCallId)`, then separately create-or-update)
with `storage.upsertInboundCallSession()` — a single atomic
`CallSession.findOneAndUpdate({tenantId, providerCallId}, {$set: mutableFields, $setOnInsert:
identityFields}, {upsert:true, new:true, includeResultMetadata:true})`. This is a real
mechanism (atomic DB-level upsert keyed on the same pair the pre-existing unique index
enforces), not just a comment. A regression test
(`tests/e2e/telephony-isolation.spec.ts`, "Two truly concurrent deliveries...resolve
atomically to one record") fires two `Promise.all`-parallel webhook POSTs for a brand-new
`providerCallId` and asserts exactly one `CallSession` is created; the worker's own report
(`telephony-fix-landing/.claude/tasks/reports/TASK-TELEPHONY-WEBHOOK-DEDUPE-FIX-FINAL.md`)
claims `npx playwright test ... --grep "inbound|concurrent"` → 3/3 passed, plus a
now-deleted standalone script issuing 12 concurrent upserts directly against MongoDB (0
errors, 1 created, 11 updated) — this latter claim is **REPORTED_BY_PIPELINE_ONLY** (script
no longer exists to re-run). The fix lives only on `rescue/telephony-webhook-dedupe-fix` /
`feature/local-network-access` (= `telephony-fix-landing` worktree) / `preview/manual-test-reconciled`.
**`reconcile-trunk-booking` (200919b) — the worktree whose name implies it reconciles
trunk with the booking work — still has the pre-fix, race-prone `resolveInboundEvent()`**,
confirming the dedupe fix was never propagated into that reconciliation attempt either.

## Telephony RBAC / tenant isolation / realtime rooms (VERIFIED_CODE, no live runtime)

From `fleetpro-telephony-rbac` (7bc8b9c) and its Integrator-consolidated descendant in
`telephony-fix-landing`:
- `CallSession`/`TelephonyIdentity` Mongoose models (`server/models/index.ts` on the
  integrated lineage) — ownership (`userId`/`assignedUserId`), reassignment history,
  free-text notes array (`ICallNote`), tenant-scoped compound indexes
  (`{tenantId,userId,createdAt}`, `{tenantId,assignedUserId,createdAt}`, `{tenantId,status,createdAt}`, unique `{tenantId,providerCallId}`).
- AES-256-GCM credential encryption (`server/telephony/security/credentialEncryption.ts`);
  `publicTelephonyIdentity()` strips `encryptedCredentials`/`credentialFields` from every
  API response.
- RBAC via the shared `server/middleware/permissions.ts` (`PERMISSIONS.CALL_INITIATE`,
  `CALL_VIEW_OWN`, `CALL_MANAGE`) applied per-route in `server/telephony/routes/calls.ts`.
- Realtime: Socket.IO mounted at `/ws/telephony` in `server/index.ts` (Integrator addition),
  authenticated via the existing session middleware (`io.engine.use(sessionMiddleware)`),
  joining `user:<userId>` and `tenant:<tenantId>` rooms on connect, and a `call:<id>` room
  only after an explicit ownership check (`getCallSessionForActor`) — inbound-call events
  emit to `user:<targetUserId>`, `tenant:<tenantId>` (owner/admin aggregation view), and
  `call:<id>` only, never a blanket tenant-wide broadcast to every socket.
- 16 tests in `telephony-isolation.spec.ts` + 3 in `telephony-security.spec.ts` cover
  cross-tenant ID manipulation, reassignment, credential masking, and event-targeting.
- **No frontend UI exists for telephony in any worktree searched** (`grep -rl
  "api/telephony" client/src` returns nothing anywhere, including `telephony-fix-landing`).
  This is a backend-only, API+DB+WS feature with zero live UI surface.
- **Known, self-documented limitation still open even in the most current lineage**: the
  webhook signature verification in `server/telephony/routes/webhook.ts` re-serializes
  `req.body` (already-parsed JSON) as a stand-in for raw bytes because `server/index.ts`
  applies `express.json()` before routes are registered — this is NOT byte-exact and would
  fail against a real provider that signs literal wire bytes. Comment explicitly flags this
  as unresolved.

DB evidence: `callsessions` collection has **78 documents across 47 distinct tenantIds**
(strong evidence of deliberate multi-tenant isolation testing, all `providerKey:"mock"`);
`telephonyidentities` has **59 documents**. All timestamps are 2026-08-06/07 — these are
worker/test-run artifacts against the shared dev DB, not organic production traffic (no
`server/telephony` route is live on trunk/Preview to have generated them any other way).

## Gaps found

- **No rate limiting/throttling on outbound WhatsApp sends.** `express-rate-limit` is a
  real dependency and is applied to GPS routes and login, but grep of every file under
  `server/whatsapp/` and every WhatsApp route in `server/routes.ts` shows no rate limiter —
  only a one-time 1.5s `setTimeout` while the Baileys socket boots. Real risk given the
  explicit in-code comment about ban risk from the unofficial QR-web approach.
- **No official WhatsApp Business Cloud API adapter** anywhere — only a comment placeholder
  listing `meta_cloud`/`twilio`/`gupshup` as future options.
- **Telephony has zero frontend UI** in any worktree — a fully-built backend feature
  (routes, RBAC, WS, encryption, tests) with nothing for a user to click.
- **Three unreconciled telephony lineages**, one of which (`reconcile-trunk-booking`) is
  regressed relative to the dedupe fix — merging that worktree as-is would silently
  reintroduce the race condition already fixed elsewhere.

## Table

| Requirement ID | Original Requirement | Current Implementation | Worktree | Commit | Integrated (trunk/Preview) | Live UI | API | DB | Tests | Status | Gap | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TEL-001 | Tenant configuration for telephony (per-tenant provider identity) | `TelephonyIdentity` model, `providers/registry.ts`, `services/identityService.ts`; AES-256-GCM credential encryption | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | `/api/telephony/identities/:userId` (401 confirmed off trunk; not present on trunk) | 59 docs, 47+ tenants across `telephonyidentities`/`callsessions` | telephony-security.spec.ts (credential encryption/masking test) | 🟡 PARTIALLY_IMPLEMENTED | Not merged to trunk/Preview; no UI | Integrator: reconcile the 3 lineages, choose the post-dedupe-fix one, merge to trunk |
| TEL-002 | Executive-specific number/account assignment | `TelephonyIdentity.virtualNumber`/`registeredNumber`/`extension` per `(tenantId,userId)` unique index | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | same as above | included in telephonyidentities sample docs (per-exec virtualNumber) | telephony-isolation.spec.ts | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI to assign numbers | Same as TEL-001 |
| TEL-003 | Manager visibility into calls (aggregated view across executives) | `CALL_MANAGE` permission + `tenant:<tenantId>` WS room + tenant-scoped list query | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | `GET /api/telephony/calls` (list) | 78 callsessions docs incl. manager-role actors | telephony-isolation.spec.ts (16 tests incl. manager aggregation) | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI | Same |
| TEL-004 | Call ownership model (executive owns their calls; reassignment) | `userId`/`assignedUserId` fields + `ICallReassignmentEvent[]` history, `reassignCall()` service fn | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | `PATCH /api/telephony/calls/:id` (reassign) | reassignmentHistory field present in schema | telephony-isolation.spec.ts | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI | Same |
| TEL-005 | Call logs | `CallSession` collection, tenant/user/status compound indexes | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | `GET /api/telephony/calls` | 78 docs, VERIFIED via direct query | telephony-isolation.spec.ts | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI | Same |
| TEL-006 | Feedback/notes on calls | `ICallNote[]` embedded array (`text`, `createdBy`, `createdAt`), max 5000 chars | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | note-append presumably via `PATCH /calls/:id` (route present) | notes field present, no populated sample seen in DB spot-check | not explicitly named in spec titles checked | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI | Same |
| TEL-007 | Webhook receiver | `POST /api/telephony/webhook`, signature-verified via `telephonyProvider.verifyWebhookSignature`, unauthenticated by design (provider-trust, not session-trust) | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO (confirmed via curl: trunk/Preview return SPA HTML 200, not a real route) | N/A | webhook route | inbound events create `callsessions` docs (mock provider used in tests) | telephony-isolation.spec.ts (webhook tests) | 🟡 PARTIALLY_IMPLEMENTED | Not merged; signature check uses re-serialized JSON, not true raw bytes (documented known gap) | Integrator: apply raw-body capture (`express.json({verify})`) alongside merge |
| TEL-008 | Webhook dedup logic (idempotency, not just a comment) | Atomic `storage.upsertInboundCallSession()` — single `findOneAndUpdate({upsert:true})` keyed on `(tenantId, providerCallId)`, backed by unique partial index; replaces prior check-then-act race | telephony-fix-landing (= rescue/telephony-webhook-dedupe-fix merged) | 0931ccc (fix commits 78ff849, c9de36f) | **NO** — and notably **also absent from `reconcile-trunk-booking` (200919b)**, which has the pre-fix racy version | None | webhook route | unique index confirmed in schema (`{tenantId,providerCallId}` unique partial) | New concurrency regression test; report claims 3/3 pass + 12-way concurrent-upsert script (script since deleted, REPORTED_BY_PIPELINE_ONLY for that specific claim) | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | Real atomic fix exists but sits on an orphan branch/worktree not reachable from trunk; a *different* "reconciliation" worktree regresses it | Integrator: merge `telephony-fix-landing`'s exact `resolveInboundEvent`/`upsertInboundCallSession` into whichever branch becomes canonical; do NOT use `reconcile-trunk-booking`'s copy as-is |
| TEL-009 | RBAC on telephony features | `PERMISSIONS.CALL_INITIATE`/`CALL_VIEW_OWN`/`CALL_MANAGE` wired into shared `server/middleware/permissions.ts`, enforced per-route | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | all `/api/telephony/*` routes gated | n/a | telephony-security.spec.ts | 🟡 PARTIALLY_IMPLEMENTED | Not merged; no UI to exercise RBAC end-to-end | Merge to trunk |
| TEL-010 | Tenant isolation (Tenant A cannot see Tenant B's calls) | Every service fn tenant-scopes by `tenantId`; direct call-session ID manipulation across tenants explicitly tested | fleetpro-telephony-rbac / telephony-fix-landing | 7bc8b9c / 0931ccc | NO | None | n/a | 47 distinct tenantIds across 78 callsessions docs — consistent with deliberate isolation test fixtures | telephony-isolation.spec.ts (explicit cross-tenant-ID-manipulation tests) | 🟡 PARTIALLY_IMPLEMENTED | Not merged; cannot be verified live since routes aren't registered on trunk/Preview | Merge, then re-run isolation suite against the live integrated app |
| TEL-011 | Realtime session-scoped rooms (WS/SSE tenant scoping) | Socket.IO at `/ws/telephony`, session-authenticated, rooms `user:<id>`/`tenant:<id>`/`call:<id>`, ownership check before joining a call room | telephony-fix-landing (Integrator addition on top of TASK-02) | 0931ccc | NO — no Socket.IO/`/ws/telephony` mount found in trunk `server/index.ts` | None | WS handshake | n/a | not explicitly covered by a dedicated WS test in the two spec files reviewed | 🟡 PARTIALLY_IMPLEMENTED | Not merged; this is the newest/least-tested piece (added by Integrator, not by original TASK-02 author) | Merge; add a dedicated WS-scoping regression test |
| WA-001 | QR-code connection flow (Baileys self-hosted) | `BaileysProvider.startSession()` — `useMultiFileAuthState`, `QRCode.toDataURL(qr)`, status machine `disconnected/qr_pending/connected/logged_out` | **trunk** (`fleetpro-main`) | be5ca9b / 2b5923c (checkpoint commits) | **YES — already on trunk and Preview** | `client/src/pages/whatsapp-panel.tsx` exists | `POST /api/whatsapp/session/start`, `GET /session/status`, `POST /session/logout` — confirmed live via curl (real 401 JSON, not SPA fallback) | `whatsapp-sessions/` has 2 tenant auth-state folders on disk | none found (`find *.spec.ts` for whatsapp session flow: none) | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | No automated test for the QR/session flow itself; session currently disconnected for the demo tenant | Add an e2e test using MockProvider or a Baileys test double; re-link demo tenant's session |
| WA-002 | Baileys session persistence (survive restart) | `useMultiFileAuthState(SESSIONS_DIR/tenantId)`, in-code comment confirms this is deliberate ("server restart doesn't force a re-scan") | trunk | be5ca9b | YES | via whatsapp-panel | session/start reuses saved creds | 2 tenant folders present under `whatsapp-sessions/` | none | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | Not independently verified this session (would require restarting the live server, out of scope for read-only audit) | Verify with a controlled restart in a non-shared environment |
| WA-003 | Official WhatsApp Business API adapter (alternative to Baileys) | Comment-only placeholder (`meta_cloud`/`twilio`/`gupshup`) in `createProvider()`; no implementation in any worktree searched | — | — | NO | None | None | None | None | ❌ NOT_IMPLEMENTED | No code at all, just a TODO-style comment | Build if/when required by spec |
| WA-004 | Message templates | `templates.ts` (`booking_confirmation`, `driver_duty`), `customerTemplates.ts`, `quotationTemplates.ts` — all built from real booking/customer/quotation data, no hard-coded values | trunk | be5ca9b / 2b5923c | YES | Template previews via `GET /api/customers/:id/whatsapp/templates`, `GET /api/bookings/:id/whatsapp/preview` | confirmed routes in routes.ts | 4,729 whatsappmessages docs use these templates | quotation-whatsapp-pdf.spec.ts covers upload/validation path | ✅ VERIFIED_COMPLETE | Success-path (actual send reaching a connected socket) documented as verified only via a temporary MockProvider during development, not in this audit | none needed |
| WA-005 | Booking confirmation messages | `sendBookingMessage.ts`, `buildBookingConfirmationMessage()` | trunk | be5ca9b | YES | Booking Communication panel (per test comments) | `POST /api/bookings/:id/whatsapp/send` | 4,729 docs incl. real Hindi booking-confirmation content, 246 `sent` | referenced in test comments as covered elsewhere | ✅ VERIFIED_COMPLETE | 90%+ of demo-tenant sends currently `failed` (session not connected) — a live/ops issue, not a code gap | Re-link WhatsApp session for the demo tenant |
| WA-006 | Driver/customer messages | `recipientType: 'driver' | 'customer' | 'vendor'` on `WhatsAppMessage`; `messageType === 'driver_duty'` branch in both `sendBookingMessage.ts` and `routes.ts`; 8 distinct real messageTypes in use (`booking_confirmation`, `customer_booking_summary`, `customer_driver_details`, `customer_google_review_request`, `driver_duty`, `quotation_share`, `quotation_share_pdf`, `vendor.vehicle_requirement`) | trunk | be5ca9b | YES | n/a | same send routes, `recipientType` branch | **confirmed via direct query: 38 documents with `recipientType:"driver"`** | none found specific to driver-duty | ✅ VERIFIED_COMPLETE | none | none |
| WA-007 | Delivery logging | `WhatsAppMessage` model: `status`, `attemptCount`, `providerMessageId`, `error`, `sentAt`, `idempotencyKey` (unique partial index) | trunk | be5ca9b | YES | Booking Communication panel shows message history (`GET /api/bookings/:id/whatsapp/messages`) | route confirmed | 4,729 real docs with full status/error/attempt tracking | n/a | ✅ VERIFIED_COMPLETE | none | none |
| WA-008 | Reconnect handling (session drops, needs to resume) | `connection.update` handler: `loggedOut` → wipe auth dir + force re-link; any other close → status `disconnected`, **no automatic reconnect loop** (explicit design choice per comment, staff must click "start session" again); `retryFailedMessages()` sweeps messages that failed only due to "not connected yet" once the socket reaches `open` | trunk | be5ca9b | YES | manual retry via WhatsApp panel (per requireWhatsAppAdmin-gated routes) | `session/start` is the resume action | 4,483 `failed` docs, `error:"WhatsApp session not connected for this tenant"` is exactly the class `retryFailedMessages()` targets | none | 🟡 PARTIALLY_IMPLEMENTED | No automatic reconnect (deliberate, to avoid infinite-retry bug class) — this means a dropped session silently stops all sends until a human notices and re-links; failed-message backlog (4,483) is real evidence this gap has real-world impact | Add an alerting mechanism (e.g. admin notification) when session status is `disconnected`/`logged_out` for > N minutes |
| WA-009 | Tenant isolation (separate session per tenant) | `Map<tenantId, TenantSession>` in `BaileysProvider`, `authDir(tenantId)` scopes on-disk creds per tenant | trunk | be5ca9b | YES | n/a | all routes take `req.tenantId!` | `whatsapp-sessions/` has 2 separate tenant subfolders on disk; all 4,729 messages belong to 1 tenant (consistent with only 1 tenant actively using it) | none dedicated to cross-tenant WA isolation found | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | No explicit cross-tenant-leakage test found (unlike telephony, which has 16 dedicated isolation tests) | Add a WhatsApp-specific cross-tenant isolation e2e test |
| WA-010 | Rate controls/throttling (avoid provider bans) | **None found.** Only a one-time 1.5s `setTimeout` while the socket boots; `express-rate-limit` is used elsewhere (GPS, login) but not wired to any `/api/whatsapp/*` or `/api/bookings/:id/whatsapp/send` route | — | — | N/A | N/A | unthrottled | n/a | none | ❌ NOT_IMPLEMENTED | Real operational risk: comment in `baileysProvider.ts` itself acknowledges "a linked number can be banned" | Add a per-tenant send-rate limiter (e.g. token bucket) before wiring any bulk-send feature |

## Summary of confidence classification used above
- ✅ VERIFIED_COMPLETE: code + live route response + real DB documents all confirmed this session.
- 🟢 IMPLEMENTED_NEEDS_FINAL_TEST: code verified, but a specific claim (e.g. a deleted verification script, or a code path with no DB sample found) wasn't independently re-run.
- 🟡 PARTIALLY_IMPLEMENTED: code exists and is internally coherent/tested in its own worktree, but is not integrated into trunk/Preview and so has no live/production evidence.
- ❌ NOT_IMPLEMENTED: no code found anywhere searched.
