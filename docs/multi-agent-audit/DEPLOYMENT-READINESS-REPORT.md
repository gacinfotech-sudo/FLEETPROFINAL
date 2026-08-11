# Deployment Readiness Report

Generated: 2026-08-07 02:35 UTC (updated — deployment-architecture scan complete)

## Status: PRODUCTION DEPLOYMENT — EXTERNAL CONFIGURATION REQUIRED

Integration (TASK-05) hasn't started — Wave 1 has 1/3 done (TASK-01 verified
`READY_FOR_INTEGRATION`; TASK-02/TASK-03 not started) and Wave 2 (TASK-04) is blocked on it.
The Section 25 production gate checklist cannot be fully evaluated until an integrated
combined diff exists. The deployment-architecture scan, however, is now done — see findings
below.

## Deployment architecture scan (new this cycle)

- **No Docker/Compose, no CI/CD** (`.github/workflows`, `.gitlab-ci`, `.circleci` all
  absent).
- **`vercel.json` present** — configures `dist/index.js` as a `@vercel/node` serverless
  function and `dist/public/**` as static output, `/api/*` routed to the function.
- **`.replit` present** — configures a Replit "autoscale" deployment target
  (`npm run build` → `npm run start`). Its `postgresql-16` Nix module is stale boilerplate,
  not a real dependency — confirmed no Postgres/Drizzle package anywhere in `package.json`;
  this app is MongoDB-only.
- **Neither is actually wired up**: `git remote -v` is empty (fully local repo, nothing to
  push to), no `.vercel/` link directory, no `vercel` CLI installed locally.
- **Conclusion**: two deployment shapes are configured on paper, zero are live. This is
  squarely "external configuration required," not a near-ready pipeline.

## Required production environment variables (from `.env.example`)

`MONGODB_URI`, `SESSION_SECRET` (≥32 chars, server refuses to boot without it),
`GPS_CREDENTIAL_ENCRYPTION_KEY` (only if GPS provider credentials are used), `NODE_ENV`,
`TRUST_PROXY_HOPS`, `HOST`. None of these should be inferred or defaulted for production —
surface the checklist to the user at deploy time.

## What's confirmed so far

- Local dev runtime is healthy (see LOCAL-RUNTIME-REPORT.md).
- No deployment attempted, no tunnel, no public exposure — nothing to roll back.

## Blockers to close before this can move past "external configuration required"

1. Wave 1 workers TASK-02, TASK-03 report done (TASK-01 already has).
2. Wave 2 (TASK-04) cross-cutting tests pass.
3. TASK-05 integration completes: shared-file patches applied, full suite run once,
   combined diff reviewed.
4. **User decision needed**: deploy via Vercel or Replit autoscale — both are configured,
   neither is chosen/linked. Not a call to make automatically.
5. Git remote added and the chosen platform's project linked.
6. The 6 env vars above set on the chosen platform (never guessed or fabricated).
