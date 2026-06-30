# nova-sentinel — autonomous monitor / stress-tester / auto-fixer

**Status:** approved 2026-06-30
**Scope:** a daily, autonomous "backend admin" for the NOVA Portal (repo
`setcomanagement/nova-client-portal`, live at https://www.setco.pro, deploys
GitHub→Vercel).

## Goal

Continuously (daily) verify the portal is healthy and correct, find bugs,
auto-fix them, and ship the fix to production — testing before shipping, never
leaving prod broken.

## Decisions (from brainstorming)

- **Fix autonomy:** fully autonomous fix + deploy, **gated** — nothing reaches
  `main` without passing the full verification gate on a production build; every
  push is followed by a live re-probe with automatic rollback on regression.
- **Runtime:** a `/schedule` cloud routine.
- **Cadence:** once a day. Each run does the full sweep.
- **Reporting:** Discord webhook (raw `curl`, works headless). Env var
  `DISCORD_SENTINEL_WEBHOOK`.

## Architecture — committed suite + thin daily routine

Deterministic checks live in committed scripts under `scripts/sentinel/`; the
daily routine (an LLM agent) runs them, reasons about autofixes, gates, deploys,
and reports. The suite is also reusable on-demand as a pre-deploy gate.

### Components (`scripts/sentinel/`)

Each is independently runnable and emits structured JSON to stdout.

1. **`health.mjs`** — read-only prod probes (no repo build needed):
   - Public routes: `/login` 200, `/` 200.
   - Auth gate: unauthenticated `/<slug>/dashboard` → 307 (redirect to login).
   - Latest Vercel production deployment is `READY` (Vercel API).
   - No route returns 5xx; each response within a latency budget (default 5s).
   - Output: `{ ok, checks:[{name, ok, detail}], deploymentReady, latestSha }`.

2. **`audit.mjs`** — static invariant checks over the repo (grep/AST, no build):
   - No `getClientBySlug` used in any `app/(client)/[slug]/**/page.tsx`
     (must use `resolveClientAccess`). [cross-tenant invariant]
   - Every EOD-writing server action (`submitEod`, `addStatsEntryAction`) calls
     `revalidatePath`. [live-refresh invariant]
   - Every dynamic `[id]` page guards with `isUuid(...)`. [uuid-cast-crash guard]
   - No `: any` and no `from "postgres"`/raw SQL outside `lib/db/`.
   - No `console.log` of JWT/token/passwordHash identifiers.
   - Output: `{ ok, findings:[{rule, file, line, snippet, severity, fix?}] }`.
   - Each finding may carry a `fix` hint (known remediation) the routine can apply.

3. **`stress.mjs`** — regression/stress on a production build (heavy):
   - Seeds a deterministic multi-client/multi-setter EOD dataset into local
     PGlite (`seed.mjs`), runs `next build`, `next start`, then Playwright:
     - **Cross-tenant leak probe:** every client page for org A as an org-B user
       → HTTP 404, zero org-A name/UUID in HTML *and* RSC flight payload.
     - **EOD→stats flow:** submit an EOD via the form → statistics delta, the
       per-entry log, milestones, dashboard all update.
     - **Statistics aggregation:** recompute every scorecard/aggregate/funnel +
       per-entry rows from the seeded data and assert the page matches, across
       all clients × ranges; segregation (rep sees only self); cross-client
       isolation.
     - **All-roles route sweep:** each role × route → no 5xx, role gates hold,
       malformed UUID → clean 404, zero real console errors.
   - Output: `{ ok, suites:[{name, passed, failed, failures:[...] }] }`.

4. **`report.mjs`** — posts a summary/alert to `DISCORD_SENTINEL_WEBHOOK` via
   `curl`. Takes a JSON run-result on stdin. Severity-aware (green summary vs
   red alert). No-op with a warning if the webhook env var is unset.

5. **`run.mjs`** — orchestrator: runs health → audit → stress (skips heavy
   stress if `--light`), aggregates into one run-result JSON. Exit non-zero if
   any check fails. Writes the result to `docs/sentinel/runs/<ts>.json` for a
   durable trail.

### Daily routine (the `/schedule` agent prompt)

1. `cd` repo, `git pull`, `pnpm install`.
2. Run `node scripts/sentinel/run.mjs`.
3. **All green** → `report.mjs` a short "all healthy" summary. Done.
4. **Findings** → for each fixable finding (audit `fix` hint, or a regression the
   agent can diagnose):
   a. Apply the fix on a branch.
   b. **Re-run the full gate**: `tsc --noEmit` + scoped eslint + `next build` +
      `stress.mjs` + `health.mjs` (post-deploy step uses prod).
   c. If green → commit + push to `main` (GitHub→Vercel auto-deploys) → wait for
      Vercel `READY` → re-run `health.mjs` against prod.
   d. If the deploy regresses health → **revert the commit, push the revert**
      (roll back), and Discord-alert "rolled back, needs you."
5. **Unfixable / gate won't go green** → do NOT push. Discord-alert with the
   finding + diagnosis.
6. Always post a per-run Discord summary (checked / fixed+deployed / needs-you).

### Safety rails (non-negotiable)

- No push to `main` without a green gate on a production build.
- Every push is followed by a live prod re-probe; regression → automatic
  rollback (revert) + alert.
- Autofix is "diagnose → fix → prove green → ship," never "push and hope."
- The routine touches only code; it cannot read prod data (Neon creds sealed).

## Required secrets (in the cloud routine env)

- `GITHUB` push credential (push to `main`).
- `VERCEL_TOKEN` (deploy status / health API).
- `DISCORD_SENTINEL_WEBHOOK` (reporting).

## Out of scope

- Prod database / row-level data-integrity audits (Neon env vars are sealed
  "sensitive" — unreadable). Stress tests use synthetic local data only.
- Performance profiling beyond a coarse latency budget.

## Feasibility fallback

If the cloud cron environment cannot run `pnpm build` + Playwright browsers or
lacks push creds, the daily routine degrades to `health.mjs` + `audit.mjs` +
Discord alert (still catches outages, deploy failures, and invariant
regressions), and the full `stress.mjs` + autofix runs on-demand from a session.
