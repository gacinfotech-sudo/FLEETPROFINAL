# External Configuration Required

## Route/Distance Estimation Provider

- **Missing item**: a configured Maps/routing provider (e.g. Google Routes API) with real credentials.
- **Why required**: spec §17 asks for estimated route KM/duration/toll before a booking is confirmed.
- **Feature affected**: "Estimated Route KM" display in the Frequent Routes / Add Booking flow. Everything else (Frequent Routes themselves, Route Templates, the 4-distance-value model, odometer/GPS reconciliation, billable KM approval) works fully without this — only the *automatic* estimate lookup is blocked.
- **Code already completed**: a provider-independent `RouteEstimationService` adapter interface, so swapping in a real provider later is a credentials/config change, not a code change (mirrors the existing `WhatsAppProvider` adapter pattern already used successfully in this codebase for Baileys/Mock).
- **Exact configuration step remaining**: set `MAPS_PROVIDER=google_routes` and `GOOGLE_ROUTES_API_KEY=...` (or equivalent) in the environment.
- **How to test after configuration**: create a booking with a route that has no manual `estimatedRouteKm` override; confirm the estimate populates automatically instead of showing "Configuration Required."
- **Current behavior without it**: the UI shows `Configuration Required` next to the estimate field and allows a manual entry — never a fabricated number.

## Database backup tooling

- No managed backup/snapshot tooling is configured for the local development MongoDB instance used in this environment. All schema changes in this initiative are additive-only (new optional fields, new collections) — genuinely reversible without a backup by simply not populating the new fields, and no destructive migration is performed at any point. Documented here per the spec's own checklist item, not treated as a blocker for additive work.
