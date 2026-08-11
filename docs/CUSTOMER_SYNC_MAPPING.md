# Customer Synchronization Mapping

How the new `Inquiry` model relates to the existing `Customer` record, and exactly which existing APIs are reused (per the spec's "Do not duplicate Customer business logic" / "Reuse existing Customer 360 APIs/components" rules).

## Lookup flow (Phase 1)

1. User types a mobile number into the Quick Inquiry form.
2. Frontend calls the **existing, unmodified** `GET /api/customers/lookup?phone=...` (`server/routes.ts:3220-3247`) — not a new endpoint.
3. If a match is found, the response's `{customer, recentBookings, pendingDue}` shape (already returned exactly as-is by that route today) is used to show the "Existing Customer Found" panel (spec §11) and offer auto-fill.
4. If no match, the Inquiry is saved with contact fields only (`customerName`, `primaryMobile`, etc.) and `Inquiry.linkedCustomerId` stays unset — the Inquiry does **not** create a `Customer` record at this stage. Per spec §4's own distinction ("A person/company becomes a Customer when an existing record is linked, or a new record is created **after validation**"), customer creation is deferred to the Lead→Customer conversion step (a later phase), not done implicitly on every Inquiry.

## Auto-fill behavior

Matches spec §12: selecting an existing customer via the lookup panel fills `Inquiry.customerName`/`primaryMobile`/`whatsappNumber`/`email` from the `Customer` record, but only as an explicit one-time fill action (`Use This Customer` button) — never a silent overwrite of whatever the user already typed. No new merge/conflict-resolution UI is built in Phase 1 (the spec's "Saved Value / Current Value" diff picker is scoped for the fuller Lead/Booking auto-fill phase, where there are more fields in play); Phase 1's Quick Inquiry form has few enough fields (name/mobile/whatsapp/email) that a single "apply" action is sufficient and non-destructive (it only fires on explicit click, and only replaces fields the user hasn't already diverged from — implemented as: only pre-fills empty fields, never overwrites a field the user has already typed into).

## `Inquiry.linkedCustomerId`

Nullable `ObjectId` ref to `Customer`, set only when:
- The user explicitly selects an existing customer from the lookup panel, or
- (Later phase) the Inquiry converts to a Lead which converts to a Customer.

## What is explicitly NOT done in Phase 1

- No new Customer fields, no schema change to `Customer` at all.
- No write path from Inquiry back into `Customer` (e.g. Inquiry creation never touches `Customer.totalBookings` or any cached stat — those remain exclusively owned by `recomputeCustomerStats()` as today).
- No Customer 360 drawer/quick-view component yet — Phase 1's Inquiry list links out to the existing Customer Dashboard via the customer's existing profile route/dialog rather than building a new embedded drawer; a dedicated lightweight "quick view" drawer (spec §13) is scoped for the Lead phase, where it gets reused across Inquiry, Lead, and Quotation forms as the spec requires.

## Timeline / Customer 360 update

Not applicable in Phase 1 — an Inquiry that hasn't converted to a Lead/Customer/Booking generates no Customer-side timeline event (there is no linked Customer yet in the common case). Once Lead→Customer conversion is built (later phase), that conversion step is the one place a Customer timeline entry gets written, consistent with spec §41's "Add Customer Timeline event" instruction and the existing codebase's general pattern of writing timeline-relevant events at the point a real business fact changes, not speculatively.
