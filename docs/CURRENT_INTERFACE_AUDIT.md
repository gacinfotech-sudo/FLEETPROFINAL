# Current Interface Audit

Evidence-based inventory of the interface as it exists today, before any changes in this initiative. Every claim below is grounded in a file:line citation, not assumption.

## Route structure

The app is a single-page shell, not many distinct URL routes. `client/src/App.tsx`:
- `/` — landing page
- `/login`, `/reset-password`, `/admin` — auth/admin
- `/driver-login`, `/driver` — separate driver-portal auth (own session mechanism, not staff auth)
- `/dashboard/:section?` — the entire staff application; `:section` selects a client-side view, not a server route
- catch-all → 404

**Implication:** "26 confusing sidebar items" is not a routing problem — it's a single `ViewType` union (`client/src/pages/dashboard.tsx:58`) and one flat `navItems` array (`client/src/components/layout/sidebar.tsx`) rendered as a switch statement. This is good news for the "preserve every route" mandate: every `/dashboard/:section` URL already works via deep link and browser refresh (confirmed: `section` is read from `useParams()` on mount), so reorganizing the *sidebar's presentation* of these 26 items into a grouped tree does not require touching routing at all — only the sidebar's rendering and, optionally, adding parent/child grouping metadata.

## Sidebar — current flat structure (26 items, no grouping)

```
Dashboard, Inquiries, Leads, Follow-ups, Live Bookings, Upcoming Bookings,
Payment Collection Due, Add Booking, View Fleet, Vehicle Performance,
Manage Drivers, Driver Attendance, Driver Leave, Driver Performance,
Booking History, Customers, After-Sales, Campaigns, Vendors, Revenue Report,
Vendor Settlement, Manage Expenses, Salary, WhatsApp, Manage Users, Profile
```
(`client/src/components/layout/sidebar.tsx`, `navItems` array)

Booking-related entries are interleaved with unrelated ones rather than grouped:
- Booking-primary: Live Bookings, Upcoming Bookings, Payment Collection Due, Add Booking, Booking History
- Booking-adjacent (resource assignment): View Fleet, Vehicle Performance, Manage Drivers, Driver Attendance, Driver Leave, Driver Performance, Vendors, Vendor Settlement
- Pre-booking pipeline (CRM): Inquiries, Leads, Follow-ups
- Post-booking/finance: Manage Expenses, Salary, Revenue Report
- Other: Customers, After-Sales, Campaigns, WhatsApp, Manage Users, Profile

This confirms the core complaint: a user tracking one booking through its lifecycle (assign resources → start trip → invoice → payment) must jump between 5+ non-adjacent sidebar entries.

## Dashboard Overview — already partially booking-first

`client/src/pages/dashboard.tsx:530-620` (the `case "dashboard"` render):
- "Create New Booking" is already the primary button, top-right, before any other content (line 542).
- "Manage Fleet" is the only other header-level action.
- Below that: `EnhancedStats` (KPI cards), then an "Upcoming Bookings" card with Today/Tomorrow/Future/All tabs and a "Create Booking" empty-state CTA.

**This is a FULLY_WORKING baseline**, not broken — the mega-spec's ask to "prioritize Create Booking, Today's/Upcoming Bookings" is already substantially met. What's missing per the spec: Search Customer/Mobile, Quick Inquiry, Follow-ups Due, and Pending Quotations are not yet on this Overview screen (they exist as their own full pages, reachable only via sidebar).

## Customer → New Booking flow — already exists

`tests/e2e/customer-quick-actions.spec.ts` (pre-existing, passing) confirms:
- Exact mobile match opens Customer 360°, with a New Booking action.
- Unknown mobile shows "No Existing Customer Found" with a working "Create Quick Inquiry" CTA, prefilled with the searched number.
- "Use as template" on a past booking copies route/notes only, never dates/driver/vehicle/price.

Classification: **FULLY_WORKING**. Spec section 12 is already implemented; no new work needed here beyond verifying it still works after navigation changes.

## Pipeline stage state machines — backend exists, no UI stepper

`server/services/inquiryStatus.ts`, `leadStatus.ts`, `quotationStatus.ts` each define valid-transition logic already enforced server-side (used by the pipeline-audit repairs earlier this project). No stepper/progress UI component exists anywhere in `client/src/components/` (confirmed by search — zero matches for Stepper/ProgressStep/PipelineProgress). Classification: **MISSING_NEXT_ACTION** — the data to build a stepper from already exists; the UI does not.

## Contextual actions — partially present, not systematized

Inquiry/Lead pages (`inquiries.tsx`, `leads.tsx`) already have individual action buttons (Qualify, Create Lead, Create Quotation, Convert to Booking, etc. — added across the earlier pipeline-audit phase of this project) but each page implements its own action bar ad hoc; there is no shared, reusable, permission-aware `ContextualActionBar` component. Classification: **PARTIALLY_WORKING** — the actions exist and work, but are not a reusable, consistent pattern, and are not status-aware everywhere (needs per-page verification in Phase 1's pipeline audit).

## Booking Workspace — exists as a dialog, not a full connected workspace

Booking details currently render inside a `Dialog` in `dashboard.tsx` (`viewingBooking` state), containing: booking summary, customer info, `PaymentSection`, `TripCostSummary`, `AssignVendorDialog`, `ExtendBookingDialog`, `BookingCommunication`. This is close to the spec's "Booking Workspace" concept already — most of sections 7's required sections (Payments, Trip Execution/Expenses via TripCostSummary, Vendor, Messages) are present. Missing from the dialog: Quotation link-back, Feedback, Timeline, and a pipeline stepper. Classification: **PARTIALLY_WORKING**.

## No lint script

`package.json` has no `lint` script; ESLint is not configured in this repo (confirmed earlier this project). This is a pre-existing condition, not something this initiative introduces or must fix — noted per the mega-spec's "record existing failures" requirement.
