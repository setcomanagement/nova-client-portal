# NOVA Portal — Feature Completion Design

- **Date:** 2026-06-01
- **Author:** Matt + Claude (superpowers brainstorming)
- **Status:** Approved (design), pending implementation
- **Scope:** Close the gap between the HTML prototype (`~/Desktop/ux-designs/nova-portal/index.html`) and the real Next.js app (`~/Claude Code warp/nova-portal`).

## Problem

The real app shipped the skeleton of every screen, but several prototype features are missing or thinner than designed. A prototype↔app cross-match flagged four areas: **modules model**, **integrations**, **lead editor**, and **client dashboard depth**, plus minor admin/settings gaps.

## Decisions (locked with user)

1. **Modules are GLOBAL** — one shared catalog every client sees in their feed (not per-client).
2. Build all four areas this pass: integrations, lead editor (full CRUD), dashboard enrichment, admin funnel + settings extras.
3. **Integrations = UI + persisted state** now; real Calendly/Google OAuth deferred to the domain-deploy phase (needs secrets + public callback).
4. **Lead editor = full CRUD** — add/edit/delete + stage + owner + notes. Editable by client + manager + ops; setters read-only.

## Data model (migration `0004`)

- `modules.client_id` → **nullable**. `NULL` = global. Collapse seeded per-client modules into one shared set. `moduleProgress` stays per-user (unchanged).
- `leads` → add `owner_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL`.
- New `integrations` table:
  - `id`, `client_id` (FK, cascade), `provider` text (`calendly|discord|notion|google`),
    `status` text (`connected|disconnected|coming_soon`), `connected_at` timestamptz NULL, `meta` jsonb NULL, `created_at`.
  - Unique on (`client_id`, `provider`).
- New `feedback` table:
  - `id`, `user_id` (FK, cascade), `client_id` (FK NULL, set null), `message` text, `created_at`.

### New/changed queries (`lib/db/queries.ts`)
- Modules: `listGlobalModules()`, `getGlobalModuleById(id)`; `createModule` drops `clientId` (writes NULL); admin builder lists/edits the global catalog. Client feed + dashboard read `listGlobalModules()`.
- Leads: `createLead`, `updateLead`, `deleteLead` (all client-scoped).
- Integrations: `listIntegrations(clientId)`, `setIntegrationStatus(clientId, provider, status)`, `listAllIntegrations()` (admin, grouped by client).
- Feedback: `insertFeedback(userId, clientId, message)`, `listFeedback()` (admin/insights).

## Feature units

### 1. Modules → global
- Schema + queries above. Course-builder (`/admin/modules/new`, `/admin/modules/[id]`) drops the client picker; manages one catalog.
- `/admin/modules` shows a single global list (no per-client grouping).
- Client `/[slug]/modules` + dashboard training widget read the global catalog; per-user completion preserved.

### 2. Integrations *(UI + persisted state)*
- **`/[slug]/integrations`** — gated to **client + ops** (managers excluded). Cards: Calendly (Connected ↔ Disconnect, toggles DB status + `connected_at`), Discord & Notion ("Coming Phase 2", disabled connect). Server action `setIntegrationStatusAction`.
- **Settings** — "Connect Google" card (client + admin); toggles the `google` integration row.
- **`/admin/integrations`** — cross-client status table from `listAllIntegrations()`.
- Nav: add "Integrations" to client layout (client + ops only) and to admin nav.

### 3. Lead editor *(full CRUD)*
- `/[slug]/leads`: **+ Add lead** → form (name, email, source, stage, owner [org members], notes). `createLeadAction`.
- `/[slug]/leads/[id]`: **Edit** form (all fields + stage + owner + notes) + **Delete** (confirm). `updateLeadAction`, `deleteLeadAction`.
- Mutations gated to client + manager + ops; setters keep read-only timeline.

### 4. Client dashboard enrichment (real data only)
- **Mission Control** panel:
  - *Needs you now*: next upcoming booking (join), bookings with `status` needing disposition (log), open action-item count (open recap).
  - *Systems* lamps: Calendly sync (from integrations status), show-up health (from KPI), cash vs goal (KPI actuals/targets), no-shows this week (bookings).
- **This week's agenda**: upcoming bookings this ISO week.
- **Action items in flight**: aggregate open/done across all recaps' `actionItems`.
- **Training progress**: global modules × this user's `moduleProgress`.
- Existing ledger / weekly ring / latest recap / team counts retained.

### 5. Admin Funnel + Settings extras
- **`/admin/funnel`** — setter leaderboard: per-setter leads→booked→showed→closed + win%, derived from `bookings` (+ EOD where useful). Nav item "Funnel".
- **Settings** — feedback box (`insertFeedback`) + **Add member** form (reuses `createMember`) for client/manager. Feedback surfaces in `/admin/insights` inbox.

## Access-control matrix (additions)
- Integrations pages: reuse a client+ops gate (managers 404), like `requireClientContentAccess` but allowing the integrations set. New helper `requireIntegrationsAccess` (client + admin + super_admin).
- Lead mutations: server actions assert role ∈ {client, manager, admin, super_admin}.
- Modules global: course-builder stays `requireAdmin`.

## Build sequence (each independently verified with Playwright)
1. Data layer (migration 0004 + queries + reseed).
2. Modules → global.
3. Integrations (client + settings + admin).
4. Lead CRUD.
5. Dashboard enrichment.
6. Funnel + settings extras.

## Out of scope (this pass)
- Real OAuth for Calendly/Google (deploy phase).
- Real video hosting for modules (placeholder player kept).
- Calendly webhook ingestion (leads still seeded/manual).

## Verification
After each phase: `tsc --noEmit`, `next build`, and a Playwright pass asserting the feature works end-to-end with zero console errors. Final: full 6-role stress test re-run.

## Notes
- `nova-portal` is **not** a git repo, so this spec is saved but not committed (no VCS). Flag if you want one initialized.
