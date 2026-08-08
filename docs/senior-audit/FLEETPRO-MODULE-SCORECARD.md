# FleetPro Module Scorecard

Scores reflect **this audit pass's actual evidence only**. A module with mostly "N/A —
not verified this pass" is not a low score by default — it's an unscored gap. Only
dimensions with real evidence get a number; everything else is marked N/A rather than
guessed. Do not read N/A as 0 or as 10.

| Module | Functional Correctness | Data Integrity | Tenant Isolation | Security | UX | Performance | Observability | Test Coverage Confidence |
|---|---|---|---|---|---|---|---|---|
| Core/Auth | N/A (login/logout not re-tested this pass) | N/A | N/A | 6/10 — session-death defect (SA-01) found | N/A | N/A | N/A | N/A |
| Booking (create) | 9/10 — 6/6 exact money, error UX fixed | 9/10 — DB values match input exactly | 9/10 — write blocked cross-tenant | N/A — not security-audited beyond isolation | N/A | N/A | N/A | 6/10 — reused existing suites, no full click-through |
| Customer | 8/10 — isolation test used this route successfully | N/A | 9/10 — read blocked cross-tenant | N/A | N/A | N/A | N/A | N/A |
| Driver | 8/10 — 360/onboarding e2e passed live | N/A | N/A — not specifically tested | N/A | 8/10 — zero-block confirmed working as designed | N/A | N/A | 7/10 — 3/3 relevant e2e passed |
| Vehicle | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Vendor | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| GPS | 7/10 — UI reachability directly confirmed, backend routes live | N/A | N/A | N/A | 7/10 — directly verified render | N/A | 7/10 — scheduler logs clearly, fails closed correctly | 5/10 — automated suite flaked on infra, not content |
| Telephony | N/A this commit (evidence exists on a different lineage) | N/A | N/A this commit | N/A | N/A | N/A | N/A | N/A |
| WhatsApp | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Reports | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Root Control Plane | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Tenant Isolation (cross-cutting) | N/A | N/A | 9/10 — 2/2 real attempts blocked | 9/10 | N/A | N/A | N/A | 4/10 — only 2 endpoints tested, not the full brief's list |

Overall: this pass provides high-confidence evidence for a narrow, high-priority slice
(booking money, booking error UX, tenant isolation on 2 endpoints, driver onboarding, GPS
visibility). It does not score the majority of the application, by design — scoring
unverified modules would misrepresent confidence that doesn't exist.
