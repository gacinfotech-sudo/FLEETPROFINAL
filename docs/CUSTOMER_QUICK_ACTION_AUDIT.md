# Customer Quick Action Audit

Full findings in the commit history of this audit session; summarized here with the implementation plan for Phase 2.

## Current state (facts)

- **No global/header search** exists anywhere (`header.tsx` has no search input; no command-palette component was ever scaffolded).
- `customers.tsx` has its own solid **server-side** search (`GET /api/customers?search=...`, matches name/mobile/alternateMobile/whatsappNumber/phoneAliases/email/emailAliases/companyAliases), but it is not reachable from Add Booking, Inquiry, Lead, or Quotation, and has no debounce (every keystroke fires a request).
- Mobile normalization is solid and single-sourced (`normalizeIndianPhone`, one implementation, used consistently everywhere). No DB-level unique constraint on `Customer.primaryMobile` per tenant — dedup is enforced only at the application layer (`findOrCreateCustomer`), which is why a duplicate-customer merge tool already exists as a safety net.
- Customer 360 (`customer-dashboard.tsx`) is a single long-scrolling dialog, not tabs. It has 19 distinct sections but **no "+ New Booking" action anywhere** — the only booking-adjacent action is "Edit Booking," which only operates on an already-existing booking being viewed.
- "Customer not found" in `customers.tsx` shows static text only, no CTA.
- `quick-inquiry-form.tsx` already does phone-based existing-customer lookup + "Use This Customer" prefill correctly — it's just not reachable from `customers.tsx`'s empty state.
- No "Use Previous Booking as Template" / duplicate-booking feature exists anywhere.

## Phase 2 plan (what will actually be built)

1. **Reusable `CustomerSearch` component** (`client/src/components/customers/customer-search.tsx`, new file): debounced (300ms), calls the existing `GET /api/customers?search=` endpoint (no backend change needed — it already supports everything required). Renders a result list; each result shows the same summary fields already computed server-side (name, mobile, bookings, due).
2. **Mount points**: header (new, small — a search icon that opens a popover using the same component, not a full redesign of the header), and as a drop-in replacement for the ad-hoc search boxes already in `customers.tsx`/`inquiries.tsx` where practical without touching their existing query wiring.
3. **"+ New Booking" in Customer 360**: new button next to the existing "Edit Booking" trigger area. On click: build a prefill object from the customer's own profile (name, phone, email — same shape `LeadsPage`'s `onConvertToBooking` already produces) and call the exact same `handleConvertLeadToBooking`-style prop chain already wired in `dashboard.tsx` for Lead conversion (reused, not duplicated) — `EnhancedBookingForm`'s `initialValues` prop already supports this with zero backend change.
4. **"Customer not found" CTA**: add a "Create Quick Inquiry" button to `customers.tsx`'s empty state, opening the existing `quick-inquiry-form.tsx` component with the searched phone number prefilled — zero new inquiry-side code.
5. **"Use Previous Booking as Template"**: new button in Customer 360's booking history rows. Copies only `pickupLocation`, `dropoffLocation`, `tripType`, `bookingType`, passenger-adjacent notes — never dates, driver, vehicle, vendor, rate, advance, payment, or the old booking number (per spec §16, enforced by only copying an explicit allow-list of fields into the same `initialValues` prefill object).

None of this requires a backend route change beyond what already exists, except the new-booking/use-previous-booking prefill paths, which reuse the already-built, already-tested `EnhancedBookingForm.initialValues` + `BookingDraft` mechanism verbatim.
