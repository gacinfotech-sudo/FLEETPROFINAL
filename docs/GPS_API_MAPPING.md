# FleetPro GPS Provider API Mapping

## Current mapping status

No provider API is mapped in Phase 1 because no official provider documentation was supplied. FleetPro does not guess endpoints or payload fields.

| FleetPro capability | Provider endpoint | Status |
| --- | --- | --- |
| Test connection | Not supplied | Configuration required |
| List devices | Not supplied | Configuration required |
| Get device | Not supplied | Configuration required |
| Latest position | Not supplied | Configuration required |
| Position history | Not supplied | Configuration required |
| Trip history | Not supplied | Configuration required |
| Signed webhook | Not supplied | Configuration required |
| Live stream | Not supplied | Configuration required |

## Exact provider information required

- Provider/product name and official documentation URL or supplied document.
- API version, production/test base URLs and account/company scoping rules.
- Authentication grant/login request, refresh/expiry behavior and logout behavior.
- Device list/detail request and response schemas, pagination and stable device identifier.
- Latest position/history request parameters, timezone semantics and units.
- Trip-history semantics and odometer/distance reliability guarantees.
- Webhook event schema, event ID, retry policy and raw-body signature algorithm.
- WebSocket/MQTT endpoint, authentication, subscribe/unsubscribe and reconnect rules.
- HTTP 429 headers, documented rate limits, error schema and provider maintenance behavior.

## FleetPro internal contract

`server/gps/providers/adapter.ts` is the only provider-facing business boundary. UI, telemetry storage and trip services will consume normalized FleetPro types from `server/gps/types.ts`.
