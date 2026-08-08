# Booking Market Research

Generated: 2026-08-07. Research done for the FleetPro "Smart Booking Experience"
initiative — patterns converted into FleetPro-specific requirements, not copied designs.

## 1. Progressive disclosure for complex forms

Progressive disclosure reduces cognitive load by showing only essential fields first and
revealing complexity as the user provides input — e.g. booking.com only reveals
child-age fields once a child is added to a reservation, rather than showing them
upfront for every booking. The failure mode in both directions is real: too little
disclosure and users can't find capabilities they need; too much and the form is back to
overwhelming. The multi-step pattern (splitting a large form across screens so each step
asks one class of decision) is the standard mitigation for high-field-count forms like
ours (27+ requirement states in scope).

**FleetPro requirement:** TASK-BOOKING-UI-04's wizard must default to the minimum field
set needed for a Quote (customer + rough trip type), and progressively reveal
date-precision, vehicle-category, and fulfilment-source questions only as the user
commits to a more certain booking stage — never require an unknown answer to proceed.

## 2. Quote → Tentative → Confirmed as a first-class status model

Reservation and resource-management systems converge on a small set of named states
rather than a single boolean "confirmed" flag: quote, tentative/soft, confirmed, with a
"proposed" or "hard vs soft" distinction for resource-holding behavior. A tentative
reservation that isn't confirmed by a follow-up point commonly reverts to a saved quote
rather than silently expiring or blocking the workspace. Critically, "soft"
allocation explicitly does **not** consume the resource's capacity — the vehicle/driver
stays available to other bookings until the status is hardened to confirmed.

**FleetPro requirement:** this is precisely the `travelDateStatus` /
`tentativeStartDate` / `confirmedTravelDate` split mandated for TASK-BOOKING-DOMAIN-02 —
a tentative or date-not-decided booking must not consume driver/vehicle availability
(mirrors "soft booking doesn't consume capacity" above), and an unconfirmed tentative
booking should be revisitable via a follow-up date rather than silently expiring.

## 3. Dispatch-board patterns for unallocated work

Fleet/field-service dispatch UIs converge on a "single pane of glass" with drag-and-drop
assignment, filtered by project/location/type, plus **dedicated queue shortcuts for the
most common failure states** — e.g. a platform's UX research turned the most common
support-search phrases directly into saved views ("view unassigned loads", "view loads
missing PODs") rather than making dispatchers construct a filter every time. Role-based
quick filters ("my fleet only", "on duty now") reduce clutter for the common case.

**FleetPro requirement:** TASK-BOOKING-QUEUES-05's "Unallocated", "Date Pending",
"Follow-up Due", "Needs Attention" views should be exactly this pattern — pre-built
saved queue shortcuts for FleetPro's own most common incomplete states, not a generic
filter builder the dispatcher has to configure from scratch.

## 4. Error recovery must never destroy input

Baymard's checkout-usability research is blunt on this: clearing form fields after a
validation error is one of the most damaging UX failures observed, and recovery should
autoscroll the user to the first error rather than leaving them to hunt for it. Preserving
every field (including selections, not just typed text) through an error is the baseline
expectation, not an enhancement.

**FleetPro requirement:** matches the prompt's own "existing form data must remain
preserved" / "booking draft must remain recoverable" requirements directly — this is not
optional polish, it's the documented industry floor. TASK-BOOKING-UI-04 must guarantee
no error path clears any field, and TASK-BOOKING-DOMAIN-02's draft persistence must
survive a failed submit, not just a page refresh.

## 5. Concurrency control for shared resources (the vehicle/driver double-booking problem)

Two established patterns exist for preventing two bookings from claiming the same
vehicle/driver in the same window:

- **Optimistic concurrency** — no row lock; a version token detects if the record
  changed between read and write. Cheap, but degrades under high contention (many
  transactions get rejected and retried).
- **Pessimistic locking** — lock the resource row for the duration of the check+write,
  serializing conflicting attempts. Simpler to reason about correctness-wise, costs
  throughput under contention.
- **Atomic conditional update** ("read-then-write window elimination") — embed the
  availability condition directly in the write itself (e.g. a single
  `findOneAndUpdate` with a query that only matches if the slot is still free), so there
  is no separate read step to race against at all.

**FleetPro requirement:** given FleetPro's MongoDB/Mongoose stack and that overlap
checks are keyed on a single resource (a specific vehicle or driver) rather than a
high-contention shared pool, the atomic conditional-update pattern is the right default
for TASK-RESOURCE-03 — a single `findOneAndUpdate`-style operation whose filter includes
the overlap condition, so a second concurrent allocation attempt simply fails to match
rather than racing a separate availability read. Optimistic version tokens are the
fallback for the booking record itself (concurrent edits to the same booking by two
staff members), which is a lower-contention, different problem from resource allocation.

## 6. Mobile/responsive booking workflows

No single authoritative source was found specifically on "mobile booking wizard"
patterns distinct from general responsive/progressive-disclosure practice above; the
requirement is treated as the general responsive-form and progressive-disclosure
findings applied at narrow viewports (sticky summary collapses to a bottom sheet,
multi-step wizard becomes the primary mobile pattern rather than a long single-page
form), which is TASK-BOOKING-UI-04's responsibility and consistent with this repo's
existing breakpoint-fix work (see the concurrent TASK-01 responsive-overflow fixes
already merged to trunk).

---

## Sources

- [Progressive disclosure in UX design: Types and use cases – LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- [What Is Progressive Disclosure in UX? – UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [13 Progressive Disclosure Examples and Best Practices for SaaS – Userpilot](https://userpilot.com/blog/progressive-disclosure-examples/)
- [All-In-One Dispatch Operations Platform case study – Lindi Wheaton](https://www.lindiwheaton.com/case_study/dispatch-operations-platform/)
- [What Is Dispatch Management? – Locus](https://locus.sh/blogs/what-is-dispatch-management/)
- [Tentative Bookings – Productive Help Center](https://help.productive.io/en/articles/8582323-tentative-bookings)
- [Booking statuses – Microsoft Dynamics 365 Project Operations](https://learn.microsoft.com/en-us/dynamics365/project-operations/resource-management/booking-status)
- [Streamline booking processes with tentative bookings – Roller](https://mysupport.roller.software/docs/streamline-booking-processes-with-tentative-bookings)
- [Form Design: 6 Best Practices for Better E-Commerce UI – Baymard](https://baymard.com/learn/form-design)
- [E-Commerce Cart & Checkout Usability Research – Baymard](https://baymard.com/research/checkout-usability)
- [Solving Double Booking at Scale – itnext.io](https://itnext.io/solving-double-booking-at-scale-system-design-patterns-from-top-tech-companies-4c5a3311d8ea)
- [How to Solve Race Conditions in a Booking System – HackerNoon](https://hackernoon.com/how-to-solve-race-conditions-in-a-booking-system)
- [Handling the Double-Booking Problem in Databases – Adam Djellouli](https://adamdjellouli.com/articles/databases_notes/07_concurrency_control/04_double_booking_problem)
