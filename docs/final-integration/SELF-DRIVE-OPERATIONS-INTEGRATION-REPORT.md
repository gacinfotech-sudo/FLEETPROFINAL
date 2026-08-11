# Self-Drive Operations — Integration Report (2026-08-08, late night)

Integrated into canonical trunk `booking/integration-preview` at merge commit
`8fc4fab` (branch `operations/self-drive-refunds`), live on :5050.
Verified there: **9/9 E2E** (self-drive-refund-lifecycle 5, self-drive-workspace 4);
earlier on the worktree preview :5077: 14/14 including the live-operations 5.

## What shipped (the 50-section deposit/refund/overdue prompt)

Additive extensions on the canonical `SelfDriveTrip` + `Booking` records —
no new booking store, pre-existing trips keep working unmodified.

**Deposit (§2-§3):** wizard captures amount/mode/reference/received for
self-drive bookings with a live duration display (§1); receipt recorded via
the canonical deposit endpoint; `Booking.securityDepositStatus` grew
`refund_pending` / `partially_refunded` and stays in sync end-to-end.
Deposit money never touches fare/advance/balance (Rules A/B).

**Handover/Return (§4-§6):** checklist fields (condition, documents,
accessories, deposit confirmation, notes; challan flag at return), opening
readings synced to the live card, and an interactive 9-step **fuel gauge**
(§5) with out-vs-in comparison and percentage difference.

**Late charges (§10):** per-booking `latePolicy` (grace/rate/unit —
per-hour/per-30min/per-day/fixed; default 30m/₹200/hour), transparent
`computeLateCharge` breakdown, live "late charge so far" estimate on
overdue cards, auto-seeded (never auto-charged) as a deduction at return.

**Refund engine (§13-§21, Rules C/H/J):** vehicle return + deposit held
auto-opens the refund case; fixed deduction vocabulary (toll/parking/
challan/delivery/fuel/late/damage/cleaning/other) with waivers; changing or
waiving recorded deductions requires a reason; deductions can never reduce
refundable below what's already paid out; partial refund transactions;
close only at balance ₹0 (owner override with reason otherwise); forfeit
reason-gated; every override in an audit trail. Legacy one-shot settlement
closes the refund case coherently.

**Alerts (§8, §14-§15, §26, §39-§40):** the existing reminder engine grew
`refund_pending` SLA alerts (<6h info, 6-24h attention, 24-48h urgent,
48h+ critical; deduped per bucket; resolve on payout) and **overdue
re-arm** — an acknowledged overdue alert re-activates after
`overdueRealertMinutes` (default 30) with a bumped `realertCount` the
popup re-keys on (ack pauses, never dismisses). WhatsApp sends inside the
sweep are bounded to 15s so a wedged provider can't stall it.

**UI:** Customers → **Self Drive** hub (Active/Upcoming/Overdue/Returned/
Refund Pending/Refund Completed, SLA-aged refund table, CSV export);
Process Refund settlement dialog (checklist → calculation → payouts →
close/forfeit); Customer 360 Self Drive History + one-click risk-flag tags
(§22-§23, reusing the audited tag system); dashboard KPIs Deposit Held /
Refunds Pending (§29); live cards show KM/Fuel Out, late rate, estimate.

**Review requests (§24):** post-closure button reuses the existing
Google-review WhatsApp flow; the route now falls back to the tenant's
configured `operationsSettings.googleReviewUrl` — multi-tenant, never a
global link.

## Also committed en route (integrator duties)

- `66cdda4` multi-device sessions (fixes the 401 "Invalid session" kicks),
  per-vehicle booking-creation lock, advance-vs-total guard (concurrent
  session's stable WIP, reviewed + typechecked).
- `d6d75e1` booking-wizard hardening (draft resume keeps fulfilment mode,
  no silent submit failures, session-kick message, number-input fixes).
- `04330b4` Vehicle Type Master (concurrent session's stable WIP).

## Verification

- `npx tsc` clean (fresh tsbuildinfo) on worktree and trunk post-merge.
- E2E on :5050 after restart: full lifecycle (auto ₹400 late charge from a
  2h15m-late return at 15m grace, deductions 1050, partial 2000 + final
  1950, close, deposit status sync, alert resolve, Customer 360 history),
  guard rails, zero-deposit, legacy-trip compatibility, overdue re-arm,
  plus the updated self-drive-workspace suite.
- Known environment hazards this session re-confirmed (not regressions):
  Chrome blocks ports 5060/5061 (ERR_UNSAFE_PORT); a concurrent session's
  broad process cleanup killed a worktree dev server once (see
  parallel-dispatch.md's pkill rule); Baileys init can wedge a test server —
  worktree test servers should run WHATSAPP_PROVIDER=mock (§78).

## Deferred (documented, not blocking)

Photo attachments on handover/return (§4/§6 optional), WhatsApp
customer-facing template editor UI (§25 quick actions exist via templates;
stage-level customer/driver toggles shipped with Live Operations), reports
beyond the CSV export (§45), global-search facet for refund status (§44 —
customer/phone/booking search works in the hub).

## Addendum — extras pass (2026-08-09 ~00:15 IST, merged f9f6f01/ef077ce)

Shipped the previously-deferred items:
- **Inspection photos** (§4/§6): multipart upload per handover/return phase
  (JPEG/PNG/WebP ≤8MB, ≤7/set) under uploads/self-drive/<bookingId>/,
  served only via an authenticated, tenant-checked, traversal-proof route;
  thumbnails in the workspace panel.
- **Customer WhatsApp quick actions** (§25): handover details / return
  reminder / overdue reminder / extension payment request / refund
  confirmation, with tenant-overridable {{placeholder}} templates
  (operationsSettings.sdTemplates, editable in Reminder Settings), honest
  delivery status and unique ledger idempotency keys per send.
- **Reports** (§45): /api/operations/self-drive/report?days= + Reports tab
  in the Self Drive hub (KPI tiles, deductions-by-kind, CSV export).
- Settings dialog grew Google review link, overdue re-alert minutes, and
  the template editor.

Verified on :5050 after merge + restart: self-drive-extras 3/3,
refund-lifecycle 5/5 (extras also 3/3 and full self-drive set 12/12 on the
worktree preview first).

Integrator fixes en route:
- Restored `client/src/components/dashboard/enhanced-stats.tsx` — the
  premium-dashboard merge (8dc9497) imported it but the file was never
  committed on any branch, which broke the entire dashboard bundle on
  :5050 (vite pre-transform error). Restored from the md5-identical copy
  in three older worktrees.
- Known remaining tsc debt NOT from this work: revenue-report.tsx prop
  mismatches (KPICardsGrid CardDataProps / chart `data` props) — the
  revenue session's own call-site WIP, left to that session.
