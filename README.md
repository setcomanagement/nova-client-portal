# NOVA Portal

Unified client + setter portal for NOVA Consulting and Setters Collaborative.

Next.js 16 (App Router, RSC) · TypeScript strict · Tailwind v4 · Drizzle ORM ·
custom `jose` JWT auth · Postgres (PGlite locally, Neon in production).

## Roles

| Role          | Lands on            | Can do                                            |
| ------------- | ------------------- | ------------------------------------------------- |
| `admin`       | `/admin`            | Everything: create clients, add members, view all |
| `client`      | `/<slug>/dashboard` | Their own client org only                          |
| `sales_rep`   | `/<slug>/rep`       | Their own client; EOD (coming Day 2)              |
| `team_member` | `/<slug>/team`      | Their own client                                  |

Every non-admin user belongs to exactly one client (`users.client_id`).
Cross-client access returns **404** (existence is never revealed) — enforced in
`app/(client)/[slug]/layout.tsx` against the DB, and at the edge in `proxy.ts`.

## Local setup

```bash
pnpm install
pnpm db:setup   # creates ./.pglite, runs migrations, seeds the admin
pnpm dev        # http://localhost:3000
```

No database server is required locally: with `DATABASE_URL` unset the app runs
an in-process Postgres (PGlite) persisted to `./.pglite`.

### Seeded admin

- Email: `matthewbryanchuang@gmail.com`
- Password: `admin123` (development only — change before any real use)

## Environment variables

| Var            | Required      | Notes                                                  |
| -------------- | ------------- | ------------------------------------------------------ |
| `JWT_SECRET`   | yes           | HS256 signing secret for session cookies               |
| `DATABASE_URL` | prod / deploy | Neon Postgres connection string. Unset = local PGlite. |
| `PROVISION_API_KEY` | for `POST /api/clients` | Shared Bearer secret for the external client-provisioning endpoint (Make.com). Unset = endpoint refuses all calls. |

`.env.local` holds these locally (gitignored). A `JWT_SECRET` is generated for
you on first setup.

## Scripts

| Command            | Does                                                  |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Dev server                                            |
| `pnpm build`       | Production build                                      |
| `pnpm start`       | Run the production build                              |
| `pnpm db:generate` | Generate a new Drizzle migration from the schema      |
| `pnpm db:setup`    | Run migrations + seed (PGlite or Neon, auto-detected) |
| `pnpm typecheck`   | `tsc --noEmit`                                         |
| `pnpm check`       | typecheck + lint                                      |

## Deploying to Neon + Vercel

1. Create a Neon project; copy the pooled connection string.
2. Set `DATABASE_URL` and `JWT_SECRET` in Vercel project env vars.
3. Run migrations against Neon once: `DATABASE_URL=... pnpm db:setup`.
4. Deploy. The same Drizzle schema and queries run unchanged on Neon.

## Status

Done: auth (login/logout, JWT, role middleware), admin client CRUD, per-client
member management (sales reps / team members / client owner), role-aware
landing pages, NOVA brand system, 404 client isolation.

Next (per the 5-day plan): EOD form + history + leaderboard (Day 2), call
recaps (Day 3), modules + dashboards + objection analytics (Day 4), deploy +
hardening (Day 5). Schema for all of these already ships in migration `0000`.
