# Driver Navigation Consolidation + Leave Calendar + Driver Operations

Date: 2026-08-08 · Integrator: driver/navigation-operations session
Worktree: `fleetpro-worktrees/driver-navigation-operations` · Branch: `driver/navigation-operations`

## OLD DRIVER NAVIGATION

Four independent top-level sidebar entries scattered between other modules:

- Manage Drivers
- Driver Attendance
- Driver Leave
- Driver Performance

Driver Leave was a bare list page (no calendar, no today-on-leave, no cancel/edit,
no half-day). Driver 360 had no attendance/leave tab. The `server/driver/operations`
module (incidents/challans/training/suspension, TASK-DRIVER-OPERATIONS-06) existed
only on the `driver/*` branch lineage and was never mounted on the canonical trunk,
and trunk's `checkDriverAvailability` had lost the lifecycle-eligibility gate.

## NEW DRIVER NAVIGATION

ONE expandable **Drivers** group (default collapsed, chevron rotates, active child
keeps the parent highlighted), placed after Follow-ups / before View Fleet — the
mandated Dashboard → Customers → Bookings prefix is untouched
(`tests/e2e/ui-shell-redesign.spec.ts` still passes):

```
Drivers
  ├── All Drivers        → /dashboard/drivers        (canonical driver list, unchanged)
  ├── Add Driver         → /dashboard/drivers-add    (same screen, canonical wizard pre-opened — mirrors customers-add)
  ├── Attendance         → /dashboard/driver-attendance
  ├── Leave Calendar     → /dashboard/driver-leave   (rebuilt workspace, below)
  └── Performance        → /dashboard/driver-performance
```

No driver-* item remains anywhere else in the sidebar.

Submenu items deliberately NOT added (nothing genuinely implemented to link to —
"only show what exists"): Expenses (Expense.driverId exists in the schema but there
is no driver-scoped expense UI; adding the generic Manage Expenses page under
Drivers would duplicate an existing entry), Vehicle Assignments / Handover
(staff-side UI lives in Vehicle 360's Driver Assignments and Handover/Return tabs;
driver-side acceptance lives in the driver portal), Incidents & Reports (server
module now mounted, no client UI yet — reachable via API, future work).

## ROUTES REUSED

- Driver list/edit/360: existing `drivers` view + `Driver360` dialog — no new list.
- Add Driver: existing `DriverForm` wizard (zero-block onboarding preserved; the
  TASK-DRIVER-ADD-400-FIX behavior regression-tested by `driver-add-wizard-e2e`
  passed against the candidate).
- Attendance: existing `/api/attendance/daily` module unchanged (now also reports
  `half_day` + `leaveDayPart` when a half-day leave covers the date).
- Performance: existing `/api/reports/driver-performance` page unchanged.
- Leave: existing `DriverLeave` model + `/api/driver-leaves` routes extended
  (no V2 anything).

## DUPLICATES REMOVED

- 4 scattered sidebar entries → 1 group (labels renamed inside the group only;
  ids/routes/permissions unchanged).
- No new driver list, no new leave collection, no DriverLeaveV2/DriverMenuV2.

## LEAVE DOMAIN (one canonical source)

`DriverLeave` remains the ONE leave record. Changes:

- `dayPart: 'full' | 'first_half' | 'second_half'` (default `full`) — half-day
  support. A half-day still blocks assignment for the whole day (bookings have no
  half-day granularity); the UI and conflict payloads say WHICH half so ops can
  decide overrides. Surfaced in `LeaveConflict.dayPart`.
- `PATCH /api/driver-leaves/:id` — edit (pending freely; approved only until it
  starts; date changes on approved leave re-run the booking-conflict check with
  the same `LEAVE_BOOKING_CONFLICT` 409 + `override` flow as approval).
- `POST /api/driver-leaves/:id/cancel` — soft cancel (pending/approved →
  `cancelled`), never a delete; history preserved; availability frees automatically
  because the engine only honours `status: 'approved'`.
- **Bug fixed:** leave dates parsed with bare `new Date("YYYY-MM-DD")` landed on
  UTC midnight, so the LAST day of every leave range fell outside the availability
  overlap check — the driver showed as assignable on the final day of their own
  approved leave. `parseLeaveDay` now normalizes to local start-of-day /
  END-of-day. Covered by the multi-day e2e.

Statuses stay: REQUESTED(pending) / APPROVED / REJECTED / CANCELLED, with the
existing manager-approval flow preserved (no new bureaucracy added).

## TODAY ON LEAVE

`TodayOnLeaveStrip` (client/src/components/drivers/leave/today-on-leave-strip.tsx)
— driver initial-avatars + type/half-day + date, compact empty state ("All
scheduled drivers available today."). Rendered ABOVE the calendar on the Leave
page and on the Drivers landing screen (with a "View Leave Calendar" action).
Both derive from the same `/api/driver-leaves` records.

## CALENDAR

`client/src/pages/driver-leave.tsx` rebuilt as a graphical workspace:

- KPI row: Today on Leave / Upcoming Leave / Available Drivers Today / Pending
  Requests (all computed from real records — `/api/driver-leaves` +
  `/api/attendance/daily`).
- Upcoming Leave: compact list, max 4 + View All (switches to List view).
- Month (default) / Week / List views; Previous / Today / Next; month label.
- Day cells: up to 2 driver names with status dots + "+N more", ½ marker for
  half-day; mobile (<sm) shows a count chip instead of names.
- Click date → day-detail dialog (drivers on leave with status pills, remaining
  driver count, Add Leave prefilled with that date).
- Click record → detail dialog (driver, range, type, day part, status,
  requested/decided by, reason, recorded booking conflicts) with
  Approve / Reject / Edit / Cancel Leave / View Driver 360 per state.
- Filters: driver, leave type, status + search (name/phone).
- Legend: Approved / Pending / Rejected / Cancelled / ½ Half day — text labels,
  color never the only indicator. FleetPro palette (green/amber/red/gray) only.
- Availability summary card: Total / On Duty / Available / On Leave from the
  daily report.

## ATTENDANCE LINK

Approved leave already derives attendance automatically in
`/api/attendance/daily` (no duplicate manual marking); a half-day leave now
derives `half_day`. Attendance page reachable only via Drivers → Attendance.

## AVAILABILITY LINK

`checkDriverAvailability` (server/services/availability.ts) remains the ONE
engine — booking conflicts + approved-leave conflicts + (restored) the
TASK-DRIVER-DOMAIN-02 lifecycle-eligibility gate that trunk had lost. The
`/api/drivers/available` selector shows "On leave (type)" for
`includeUnavailable=true`. Cancelling leave frees the driver immediately.

## BOOKING CONFLICT CHECK

Approving (or date-editing) leave over an existing confirmed booking returns
409 `LEAVE_BOOKING_CONFLICT` with the affected bookings; the UI shows the
"Driver leave conflict" dialog with an explicit "Proceed anyway — I will assign
a replacement driver" override, which records `conflictingBookings` on the leave
for follow-up. Proven end-to-end in the new spec.

## DRIVER 360

New "Attendance & Leave" tab (`driver-attendance-leave-panel.tsx`): today's
attendance status, current leave status, upcoming leave, full leave history —
same canonical sources, so 360 and the calendar can never disagree.

## DRIVER OPERATIONS MODULE (lineage reconciliation)

`server/driver/operations/**` (incidents, challans, training,
suspension/offboarding, incident-folded performance) ported from
`driver/integration-preview` and mounted (`registerDriverOperationsRoutes`) —
it had never been wired into the canonical trunk. Its 4-test e2e suite passes
against the candidate. The driver-portal handover-acceptance route was reviewed
and added to the qa-foundations allow-list.

## RESPONSIVE QA

`driver-navigation-leave.spec.ts` asserts no horizontal overflow and a working
day-tap → detail dialog at 375×812; the calendar collapses names to count chips
on phones; ui-shell's 375/768/1366/1920 overflow tests still pass.

## TENANT ISOLATION

All leave routes are `authenticateUser + requireTenant` and query by
`tenantId`; list/edit/cancel/approve all scope by `{_id, tenantId}`. The
qa-foundations exhaustive driver-portal enumeration passes (no staff route
reachable with a driver session). No new query paths bypass tenant scoping.

## REGRESSION

Verified on the candidate (:5250, plus isolated-DB server :5251 for the
fixtures suites): driver-navigation-leave 8/8, navigation 22/22 (updated for
group labels), ui-shell-redesign, app-shell, booking-actions (leave flow
rewritten for the new UI), driver-operations-lifecycle 4/4,
driver-ui-onboarding-360 (except one failure pre-existing on trunk),
driver-add-wizard-e2e, driver-add-optional-fields, driver-qa-foundations 6/6.
Pre-existing failures confirmed unchanged on trunk baseline (not regressions):
availability-engine buffer test, driver-overlap (seeded "Amit" driver no longer
exists in the shared dev DB), driver-feedback, driver-360 "12 fields" test,
5 html2pdf `tsc` errors (cold-run baseline parity: 13 lines on both trunk and
candidate).

## CANONICAL COMMIT

`33fa352` on `booking/integration-preview` (fast-forward of
`driver/navigation-operations`, which contains the Unified Booking Workspace +
serviceModes/SA-01 trunk merge `d0e9469`). Key commits: `b63eaa6` (server
reconciliation), `38c9ebb` (nav + leave workspace UI), `2af2809` (e2e + end-of-day
fix).

## LIVE URL

http://127.0.0.1:5050 (restarted PID-targeted onto `33fa352`; verified live —
driver-navigation-leave 8/8 against :5050).

## ROLLBACK

`git -C fleetpro-main reset --hard d0e9469` (pre-driver-consolidation trunk =
Unified Booking Workspace state) and restart the :5050 tsx process by PID.
The `driver-navigation-operations` worktree/branch is kept for re-promotion.
