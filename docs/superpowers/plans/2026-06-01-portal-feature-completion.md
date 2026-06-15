# NOVA Portal Feature Completion — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Verification model (this repo):** no git, no unit-test runner. Each task's gate = `npx tsc --noEmit` clean, and where a screen/flow changes, a Playwright script against `localhost:3000` asserting the behavior + **zero console errors**. `next build` runs at the end of each phase.

**Goal:** Close the prototype↔app gap: global modules, integrations, full lead CRUD, an enriched client dashboard, and admin funnel + settings extras.

**Architecture:** Next.js 16 App Router, Drizzle + PGlite (local). New migration `0004` adds nullable `modules.client_id`, `leads.owner_user_id`, and `integrations` + `feedback` tables. Server components read via `lib/db/queries.ts`; mutations via server actions gated by role helpers in `lib/auth/session.ts`. UI follows the existing Concierge×Briefing tokens (light client / dark admin).

**Tech Stack:** TypeScript strict, Drizzle ORM, jose JWT, Tailwind v4, Playwright (verification).

---

## Phase 1 — Data layer (migration 0004 + queries + reseed)

**Files:**
- Modify: `lib/db/schema.ts` (nullable modules.clientId; add `ownerUserId` to leads; add `integrations`, `feedback` tables + types)
- Create: `drizzle/0004_feature_completion.sql` (generated via drizzle-kit)
- Modify: `lib/db/queries.ts` (new queries below)
- Modify: `scripts/setup-db.ts` (seed one global module set; seed integrations rows; lead owners; a feedback row)

- [ ] **1.1** Make `modules.clientId` nullable in schema; add `leads.ownerUserId uuid` (FK users, set null).
- [ ] **1.2** Add `integrations` table: `id, clientId(FK cascade), provider text, status text, connectedAt timestamptz null, meta jsonb null, createdAt`; unique (clientId, provider). Add `feedback` table: `id, userId(FK cascade), clientId(FK null set null), message text, createdAt`. Export `IntegrationRow`, `FeedbackRow` types and `IntegrationProvider`/`IntegrationStatus` string unions.
- [ ] **1.3** Generate migration: `npx drizzle-kit generate --name feature_completion`. Confirm `drizzle/0004_*.sql` created.
- [ ] **1.4** Add queries to `lib/db/queries.ts`:
  - `listGlobalModules()` → modules where `clientId IS NULL` ordered by orderIndex.
  - `getGlobalModuleById(id)`.
  - `createModule` → write `clientId: null` (drop the param's clientId; keep title/description/chapters).
  - `createLead({clientId,name,email,source,stage,ownerUserId,notes})`, `updateLead(id, clientId, patch)`, `deleteLead(id, clientId)`.
  - `listIntegrations(clientId)`, `setIntegrationStatus(clientId, provider, status)` (upsert), `listAllIntegrations()` (join clients).
  - `insertFeedback(userId, clientId, message)`, `listFeedback()` (newest first, join user).
- [ ] **1.5** Update `setup-db.ts`: replace per-client module seeds with ONE global set (3 modules, clientId null); seed `integrations` (tone: calendly=connected, discord/notion=coming_soon, google=disconnected; akira: calendly=connected); set lead owners to rep1; seed one feedback row. Guard remains "skip if tone exists".
- [ ] **1.6 GATE:** `npx tsc --noEmit` clean. Reset + reseed: stop dev server, `rm -rf .pglite`, `npm run db:setup`, confirm log shows global modules + integrations + feedback seeded.

---

## Phase 2 — Modules → global

**Files:**
- Modify: `app/(admin)/admin/modules/page.tsx` (single global list, no per-client grouping)
- Modify: `app/(admin)/admin/modules/new/page.tsx` + `create-module-form.tsx` (drop client picker)
- Modify: `app/(admin)/admin/modules/actions.ts` (createModuleAction: no clientId)
- Modify: `app/(admin)/admin/modules/[id]/page.tsx` (use `getGlobalModuleById`; drop client context)
- Modify: `app/(client)/[slug]/modules/page.tsx` + `[id]/page.tsx` (read `listGlobalModules` / `getGlobalModuleById`)
- Modify: `app/(client)/[slug]/dashboard/page.tsx` (training widget reads global modules) — note: dashboard fully rebuilt in Phase 5; minimal touch here.

- [ ] **2.1** Admin modules list: one "NOVA playbook" global catalog, `+ New module`, cards link to `/admin/modules/[id]`.
- [ ] **2.2** Create-module form: remove client `<select>`; action creates global module; redirect to builder.
- [ ] **2.3** Builder page + client modules pages read global queries; client/[id] uses `getGlobalModuleById` (still scoped by membership via layout, but module itself is global).
- [ ] **2.4 GATE:** tsc clean; Playwright: super-admin creates a module (no client picker) → appears once in `/admin/modules` → visible identically on `/tone/modules` AND `/akira/modules`. Zero console errors.

---

## Phase 3 — Integrations (UI + persisted state)

**Files:**
- Create: `lib/auth/session.ts` → add `requireIntegrationsAccess` (client + admin + super_admin; else notFound).
- Create: `app/(client)/[slug]/integrations/page.tsx`, `integration-card.tsx`, `actions.ts` (`setIntegrationStatusAction`).
- Create: `app/(admin)/admin/integrations/page.tsx` (cross-client table).
- Modify: `app/(admin)/layout.tsx` (add "Integrations" nav), `app/(client)/[slug]/layout.tsx` (add "Integrations" for client + ops).
- Modify: `app/(client)/[slug]/settings/*` (add "Connect Google" card → toggles google integration).

- [ ] **3.1** Add `requireIntegrationsAccess`.
- [ ] **3.2** Client integrations page: cards for Calendly (Connected ↔ Disconnect), Discord/Notion (coming_soon, disabled). Connect/disconnect persists via `setIntegrationStatusAction` (asserts integrations access) + `revalidatePath`.
- [ ] **3.3** Settings "Connect Google" card toggles the `google` row.
- [ ] **3.4** Admin `/admin/integrations`: table client × {Calendly, Discord, Notion, Google} status + last sync (connectedAt). Nav items added both layouts.
- [ ] **3.5 GATE:** tsc clean; Playwright: client connects/disconnects Calendly → status persists across reload; manager hitting `/tone/integrations` → 404; admin table reflects state. Zero console errors.

---

## Phase 4 — Lead CRUD

**Files:**
- Create: `app/(client)/[slug]/leads/actions.ts` (`createLeadAction`, `updateLeadAction`, `deleteLeadAction` — assert role ∈ {client,manager,admin,super_admin}).
- Create: `app/(client)/[slug]/leads/lead-form.tsx` (shared add/edit client component).
- Modify: `app/(client)/[slug]/leads/page.tsx` (+ Add lead → form; gate the button by role).
- Create: `app/(client)/[slug]/leads/new/page.tsx`.
- Modify: `app/(client)/[slug]/leads/[id]/page.tsx` (Edit + Delete for editor roles; setters read-only).

- [ ] **4.1** Lead form component: name, email, source, stage (`new|booked|showed|closed|lost`), owner (org members select), notes.
- [ ] **4.2** Actions: create/update/delete, client-scoped, role-asserted; `revalidatePath` leads list + detail.
- [ ] **4.3** Leads list `+ Add lead` (editor roles only) → `/leads/new`. Lead detail: Edit panel + Delete (confirm). Setter view unchanged (read-only).
- [ ] **4.4 GATE:** tsc clean; Playwright: client adds a lead → shows in list; edits stage→closed + owner + notes → persists on detail; deletes → gone; setter sees no Add/Edit/Delete controls. Zero console errors.

---

## Phase 5 — Client dashboard enrichment

**Files:**
- Modify: `app/(client)/[slug]/dashboard/page.tsx` (fetch bookings, integrations, all recaps, global modules + completion).
- Create: `components/dashboard/mission-control.tsx`, `systems-lamps.tsx`, `agenda.tsx`, `action-items-flight.tsx`, `training-progress.tsx` (presentational, real data passed in).

- [ ] **5.1** Dashboard data fetch: `listBookings`, `listIntegrations`, `listRecaps`(all), `listGlobalModules` + `getCompletedModuleIds(session.userId)`, plus existing KPI/team.
- [ ] **5.2** Mission Control: needs-you-now (next upcoming booking; bookings with status scheduled+past-due / awaiting outcome; total open action items across recaps) + Systems lamps (calendly status, show-up health vs 70%, cash vs goal, no-shows this week count).
- [ ] **5.3** Agenda (upcoming bookings this week), Action items in flight (open/done aggregated per recap), Training progress (global modules × completion). Keep ledger/ring/recap/team.
- [ ] **5.4 GATE:** tsc clean; Playwright: client dashboard renders Mission Control + lamps + agenda + action-items + training, numbers match seed; links navigate. Zero console errors.

---

## Phase 6 — Admin Funnel + Settings extras

**Files:**
- Create: `app/(admin)/admin/funnel/page.tsx` (setter leaderboard from bookings).
- Modify: `app/(admin)/layout.tsx` (add "Funnel" nav).
- Modify: `app/(admin)/admin/insights/page.tsx` (feedback inbox reads `listFeedback`).
- Create: `app/(client)/[slug]/settings/feedback-form.tsx` + add `sendFeedbackAction` to settings actions.
- Create: `app/(client)/[slug]/settings/add-member-form.tsx` + `addMemberAction` (reuse `createMember`; client/manager only).
- Modify: `app/(client)/[slug]/settings/page.tsx` (mount feedback + add-member, role-gated).

- [ ] **6.1** Funnel page: per-setter leads→booked→showed→closed + win%, ledger totals. Nav item.
- [ ] **6.2** Insights feedback inbox from real `feedback` table.
- [ ] **6.3** Settings: feedback box (→ insertFeedback) + Add member form (client/manager) reusing createMember.
- [ ] **6.4 GATE:** tsc clean; `next build` clean; Playwright: funnel renders leaderboard; client sends feedback → appears in admin insights; client adds a member → appears in team. Zero console errors.

---

## Final verification
- [ ] **F.1** Re-run the full 6-role stress test (login + nav crawl + access-control matrix incl. manager 404 on integrations + new lead/integration routes). Zero console errors.
- [ ] **F.2** `next build` clean; report cumulative status.

## Self-review notes
- **Spec coverage:** every spec section maps to a phase (modules→P2, integrations→P3, leads→P4, dashboard→P5, funnel/settings→P6, data→P1). ✓
- **Type consistency:** `listGlobalModules`/`getGlobalModuleById`, `createLead/updateLead/deleteLead`, `setIntegrationStatus`/`listIntegrations`/`listAllIntegrations`, `insertFeedback`/`listFeedback`, `requireIntegrationsAccess` — names used consistently across phases. ✓
- **No placeholders:** each task names exact files + concrete behavior + a Playwright gate. ✓
