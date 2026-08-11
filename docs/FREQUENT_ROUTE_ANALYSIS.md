# Frequent Route Analysis

## Current state

No reusable route-template/package/frequent-route entity exists anywhere in the codebase (confirmed by repo-wide grep for `routeTemplate`, `frequentRoute`, `savedRoute`, `package` as a domain concept — zero hits). The only adjacent thing is `Customer.preferredRoute`, a read-only, per-customer, plain-frequency-count string with no pricing attached, never surfaced in the booking form.

## Design (additive — new model, new service, new UI section)

### New model: `RouteTemplate`

Tenant-scoped, mirrors the style of existing simple models in this codebase (e.g. `LeadFollowUp`):

```
tenantId, name, tripType, pickupLocation, dropoffLocation, defaultStops[],
defaultItinerary?, suggestedVehicleCategories[], suggestedDurationMinutes?,
pricingType, minimumKm?, extraKmRate?, driverAllowance?, nightHalt?,
tollTreatment, parkingTreatment, inclusions[], exclusions[],
isPinned, isActive, brand?, branch?, validFrom?, validTo?,
createdBy, createdAt, updatedAt
```

Booking never stores a live reference to a `RouteTemplate` — clicking a preset copies a **snapshot** of its fields into the booking draft (per spec §7: "Booking must preserve a template snapshot" / "Do not modify historical Bookings when a template changes").

### New service: tenant-usage-derived frequent routes

A read-only aggregation over the tenant's own real `Booking` collection (never another tenant's, never cancelled/no_show, never test/deleted records — matches the existing `recomputeCustomerStats()` precedent of excluding those same statuses):

```js
Booking.aggregate([
  { $match: { tenantId, status: { $nin: ['cancelled', 'no_show'] }, createdAt: { $gte: periodStart } } },
  { $group: { _id: { pickup: '$pickupLocation', dropoff: '$dropoffLocation' },
      count: { $sum: 1 }, lastUsed: { $max: '$createdAt' },
      confirmedCount: { $sum: { $cond: [{ $in: ['$status', CONFIRMED_STATUSES] }, 1, 0] } } } },
  { $sort: { count: -1 } },
])
```

Score = weighted combination of `count` (frequency), recency of `lastUsed`, `confirmedCount` share, and a manual pin flag — exactly as spec §5 describes, computed at request time (not a stored, staleness-prone cache), configurable analysis period (30/90/180/365 days) as a query param with a sensible default (90 days).

### UI

A new "Frequently Used Routes and Packages" card at the top of Add Booking (`enhanced-booking-form.tsx`), additive — existing Step 1-4 structure and every existing field untouched. Cards show route, trip type, suggested duration/vehicle categories, last-used date, usage count, pinned badge. Clicking one calls `form.reset({...form.getValues(), ...snapshotFields})` — the exact same additive-merge pattern already used for the Lead-conversion `initialValues` prefill — filling only route/trip-type/duration/vehicle-category/pricing-method fields. **Never** auto-assigns a physical driver/vehicle, never auto-confirms a price, never copies another customer's private data (the aggregation only ever groups on `pickupLocation`/`dropoffLocation` strings, never on `customerId`/`customerName`).

### Route Template Master (Settings)

New page under Settings → Booking Settings → Route and Package Templates, tenant-scoped CRUD (create/edit/pin/unpin/activate/deactivate) over the `RouteTemplate` model above, gated behind a new permission (`route_template.manage`), read access behind `route_template.view`.

### Fallback order (per spec §6)

1. Tenant-pinned `RouteTemplate` rows (`isPinned: true`, `isActive: true`).
2. Database-derived frequent routes (the aggregation above).
3. A small system fallback list (the same illustrative categories the spec names — Indore↔Ujjain, Airport Transfer, etc.) shown only when neither of the above returns any rows, so a brand-new tenant with zero booking history still sees something actionable rather than an empty section.
