# nova-sentinel

An autonomous "backend admin" for the NOVA Portal: monitors prod, stress-tests a
production build, audits code invariants, and (via the daily cloud routine)
auto-fixes + deploys — testing before shipping, never leaving prod broken.

Design spec: `docs/superpowers/specs/2026-06-30-nova-sentinel-design.md`.

## The suite (`scripts/sentinel/`)

Every script prints structured JSON to stdout and exits non-zero on failure.

| Script | What it does | Needs |
| --- | --- | --- |
| `health.mjs` | Read-only prod probes (routes, auth gate, latest Vercel deploy READY, latency). | `VERCEL_TOKEN` (optional; degrades to SKIP without it) |
| `audit.mjs` | Static invariant checks: tenant resolver, EOD revalidatePath, `isUuid` guards, secret-logging, raw-DB-outside-lib. | — |
| `seed.ts` | Wipes `eod_submissions`, inserts a deterministic multi-client/multi-setter dataset, mints role tokens. Emits JSON. | local PGlite, `.env.local` with `JWT_SECRET` |
| `stress.mjs` | Seeds → builds → `next start` → Playwright: statistics aggregation, cross-tenant leak, role/route sweep, EOD→stats flow. | `@playwright/test` + chromium |
| `report.mjs` | Posts a run summary/alert to Discord. Reads a run-result on stdin. | `DISCORD_SENTINEL_WEBHOOK` (no-op without it) |
| `run.mjs` | Orchestrates health + audit + stress into one result. | — |

## Run it locally

```bash
# one-time
pnpm install
npx playwright install chromium
printf 'JWT_SECRET=local-dev-secret\n' > .env.local   # no DATABASE_URL -> local PGlite
pnpm db:setup                                          # seed Tone/Akira/Alex + super_admin

# full sweep (builds, stress-tests, audits, probes prod)
node scripts/sentinel/run.mjs
# fast (no build/Playwright): health + audit only
node scripts/sentinel/run.mjs --light
# stress without rebuilding, and post the result to Discord
node scripts/sentinel/run.mjs --no-build --report
```

`pnpm sentinel` / `pnpm sentinel:light` are shortcuts.

> The stress suite wipes and reseeds local `eod_submissions`. It never touches
> the production database (Neon creds are sealed; tests use synthetic local data).

## Daily cloud routine (autonomous)

A `/schedule` routine runs once a day and:

1. `git pull`, `pnpm install`, `npx playwright install chromium`, ensure a local
   `.env.local` `JWT_SECRET`.
2. `node scripts/sentinel/run.mjs`.
3. **All green** → post a green Discord summary.
4. **Findings** → for each fixable one: apply the fix on a branch → **re-run the
   full gate** (`tsc` + eslint + `next build` + `run.mjs`) → only if green, push
   to `main` (GitHub→Vercel auto-deploys) → wait for `READY` → re-run
   `health.mjs` against prod.
5. **Deploy regresses health** → revert the commit + push the revert (rollback) →
   Discord-alert "rolled back, needs you."
6. **Unfixable / gate won't go green** → do NOT push → Discord-alert with the
   diagnosis.
7. Always post a per-run Discord summary.

### Secrets the routine needs (in the cloud env)

- `VERCEL_TOKEN` — deploy status / health API.
- `DISCORD_SENTINEL_WEBHOOK` — reporting.
- A GitHub push credential for `main`.

### Safety rails (non-negotiable)

Nothing reaches `main` without a green gate on a production build; every push is
followed by a live prod re-probe with automatic rollback on regression. Autofix
is "diagnose → fix → prove green → ship," never "push and hope."
