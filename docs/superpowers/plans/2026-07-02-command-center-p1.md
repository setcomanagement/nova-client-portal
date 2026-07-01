# Command Center — P1 (Spine + KPIs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Matt-only "Command Center" morning briefing in the NOVA portal that assembles a daily briefing (starting with yesterday's setter KPIs + top-3 bottlenecks), stores it, renders it on a page, and pushes a digest to Discord — with modules 2–5 as clean "not connected yet" placeholders.

**Architecture:** Portal-native. A Vercel Cron calls a bearer-guarded `POST /api/briefing/run` that runs isolated briefing modules, upserts one `daily_briefing` row (sections JSON), and posts a Discord digest. A `super_admin`-only page renders the latest briefing. Each module returns one slice and fails independently.

**Tech Stack:** Next.js 16 (App Router, RSC, TS strict), Drizzle ORM (schema `lib/db/schema.ts`, queries `lib/db/queries.ts`), Neon/PGlite pluggable, Vercel Cron, Discord webhook (raw fetch), existing `lib/crypto.ts` / `lib/auth/session.ts`.

## Global Constraints

- TS strict; no `any`; no raw SQL outside `lib/db/`.
- Server actions/routes resolve session first; Command Center is `super_admin` only.
- DB access only through `lib/db/queries.ts`. Schema change → `npx drizzle-kit generate --name <x>` → review `drizzle/NNNN_*.sql` → `npm run db:setup` (stop dev server first; PGlite is single-process).
- Verify against a PRODUCTION build (`pnpm build` + `pnpm exec next start`), not `next dev`. Assert zero console errors via Playwright.
- Secrets never logged. New env: `BRIEFING_RUN_TOKEN` (bearer for the cron route), `DISCORD_BRIEFING_WEBHOOK` (optional; no-op if unset).
- Deploy = commit + push to `main` (GitHub→Vercel). Keep `main` in sync (fetch+rebase before push).
- Modules 2–5 (content/audience/calendar/actions) return `{ status: "not_connected", reason: string }` in P1 — no external API calls yet.

---

### Task 1: `daily_briefing` table + migration

**Files:**
- Modify: `lib/db/schema.ts` (add table near the social tables, ~line 460+)
- Modify: `lib/db/queries.ts` (add types + upsert/read)
- Generate: `drizzle/NNNN_*.sql`

**Interfaces:**
- Produces: `dailyBriefing` table; `BriefingRow = typeof dailyBriefing.$inferSelect`; `BriefingSections` type; `upsertDailyBriefing(date: string, sections: BriefingSections): Promise<void>`; `getLatestBriefing(): Promise<BriefingRow | null>`; `getBriefingByDate(date: string): Promise<BriefingRow | null>`.

- [ ] **Step 1: Add the schema table.** In `lib/db/schema.ts`, after the social tables:

```ts
export const dailyBriefing = pgTable("daily_briefing", {
  id: uuid("id").defaultRandom().primaryKey(),
  briefingDate: date("briefing_date").notNull().unique(),
  sections: jsonb("sections").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("ok"), // ok | partial
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Add types + queries.** In `lib/db/queries.ts`, import `dailyBriefing` from `./schema`, then add:

```ts
export type BriefingRow = typeof dailyBriefing.$inferSelect;
/** One slice per module; unconnected modules carry {status:"not_connected"}. */
export interface BriefingSections {
  kpis?: unknown;
  content?: unknown;
  audience?: unknown;
  calendar?: unknown;
  actions?: unknown;
}
export async function upsertDailyBriefing(
  briefingDate: string,
  sections: BriefingSections,
  status: "ok" | "partial",
): Promise<void> {
  await db
    .insert(dailyBriefing)
    .values({ briefingDate, sections: sections as Record<string, unknown>, status })
    .onConflictDoUpdate({
      target: dailyBriefing.briefingDate,
      set: { sections: sections as Record<string, unknown>, status, generatedAt: new Date() },
    });
}
export async function getLatestBriefing(): Promise<BriefingRow | null> {
  const rows = await db.select().from(dailyBriefing).orderBy(desc(dailyBriefing.briefingDate)).limit(1);
  return rows[0] ?? null;
}
export async function getBriefingByDate(briefingDate: string): Promise<BriefingRow | null> {
  const rows = await db.select().from(dailyBriefing).where(eq(dailyBriefing.briefingDate, briefingDate)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 3: Generate + apply migration.**

Run: `npx drizzle-kit generate --name daily_briefing` then review the SQL, then (stop any dev server) `pnpm db:setup`
Expected: new `drizzle/NNNN_*.sql` creating `daily_briefing`; `db:setup` prints "Database ready."

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add lib/db/schema.ts lib/db/queries.ts drizzle/
git commit -m "feat(briefing): daily_briefing table + upsert/read queries"
```

---

### Task 2: KPI module (yesterday's setter KPIs + top-3 bottlenecks)

**Files:**
- Create: `lib/briefing/kpis.ts`
- Modify: `lib/db/queries.ts` (add `listBottlenecksSince`)

**Interfaces:**
- Consumes: existing `listSetterWeekKpis` / EOD access; `eodSubmissions`, `users` from schema.
- Produces: `buildKpisSlice(): Promise<KpisSlice>` where `KpisSlice = { status: "ok"; date: string; setters: {name:string; callsBooked:number; showUps:number; closes:number; cash:number}[]; topBottlenecks: {label:string; count:number}[] } | { status:"error"; reason:string }`.

- [ ] **Step 1: Add the bottleneck query.** In `lib/db/queries.ts`:

```ts
/** Bottleneck frequency across all setters' EODs on/after `since` (YYYY-MM-DD). */
export async function listBottlenecksSince(
  since: string,
): Promise<{ label: string; count: number }[]> {
  const rows = await db
    .select({ label: eodSubmissions.bottleneck, count: sql<number>`count(*)::int` })
    .from(eodSubmissions)
    .where(and(gte(eodSubmissions.submissionDate, since), sql`${eodSubmissions.bottleneck} is not null`))
    .groupBy(eodSubmissions.bottleneck)
    .orderBy(desc(sql`count(*)`));
  return rows.filter((r) => r.label).map((r) => ({ label: r.label as string, count: r.count }));
}
```

- [ ] **Step 2: Write the KPI slice builder.** Create `lib/briefing/kpis.ts`:

```ts
import "server-only";
import { listAllEod, listBottlenecksSince, listAllUsers } from "@/lib/db/queries";

export type KpisSlice =
  | { status: "ok"; date: string; setters: { name: string; callsBooked: number; showUps: number; closes: number; cash: number }[]; topBottlenecks: { label: string; count: number }[] }
  | { status: "error"; reason: string };

/** Yesterday's per-setter KPIs + top-3 bottlenecks, summed from EOD submissions. */
export async function buildKpisSlice(yesterday: string): Promise<KpisSlice> {
  try {
    const [eods, users, bottlenecks] = await Promise.all([
      listAllEod(),
      listAllUsers(),
      listBottlenecksSince(yesterday),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const acc = new Map<string, { callsBooked: number; showUps: number; closes: number; cash: number }>();
    for (const e of eods) {
      if (e.submissionDate !== yesterday) continue;
      const cur = acc.get(e.setterUserId) ?? { callsBooked: 0, showUps: 0, closes: 0, cash: 0 };
      cur.callsBooked += e.callsBooked;
      cur.showUps += e.showUps;
      cur.closes += e.closes;
      cur.cash += Number(e.cashCollected);
      acc.set(e.setterUserId, cur);
    }
    const setters = [...acc.entries()].map(([id, v]) => ({ name: nameById.get(id) ?? "Unknown", ...v }));
    return { status: "ok", date: yesterday, setters, topBottlenecks: bottlenecks.slice(0, 3) };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add lib/briefing/kpis.ts lib/db/queries.ts
git commit -m "feat(briefing): KPI + top-3 bottleneck slice"
```

---

### Task 3: Briefing assembler (KPI live, modules 2–5 stubbed)

**Files:**
- Create: `lib/briefing/assemble.ts`
- Create: `lib/week.ts` reuse (already exists — use `weekStartISO`? No — need yesterday). Add `lib/briefing/dates.ts`.

**Interfaces:**
- Consumes: `buildKpisSlice`.
- Produces: `assembleBriefing(): Promise<{ date: string; sections: BriefingSections; status: "ok"|"partial" }>`; `yesterdayISO(): string`.

- [ ] **Step 1: Date helper.** Create `lib/briefing/dates.ts`:

```ts
/** Yesterday in UTC as YYYY-MM-DD (briefing covers the prior day). */
export function yesterdayISO(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Assembler.** Create `lib/briefing/assemble.ts`:

```ts
import "server-only";
import type { BriefingSections } from "@/lib/db/queries";
import { buildKpisSlice } from "./kpis";
import { yesterdayISO } from "./dates";

const NOT_CONNECTED = (reason: string) => ({ status: "not_connected" as const, reason });

/** Runs each module best-effort; a failing module never breaks the briefing. */
export async function assembleBriefing(): Promise<{ date: string; sections: BriefingSections; status: "ok" | "partial" }> {
  const date = yesterdayISO();
  const kpis = await buildKpisSlice(date);
  const sections: BriefingSections = {
    kpis,
    content: NOT_CONNECTED("Instagram/YouTube not connected (P2)"),
    audience: NOT_CONNECTED("Follower sources not connected (P2)"),
    calendar: NOT_CONNECTED("Google Calendar not connected (P2)"),
    actions: NOT_CONNECTED("Fathom not connected (P3)"),
  };
  const anyError = kpis.status !== "ok";
  return { date, sections, status: anyError ? "partial" : "ok" };
}
```

- [ ] **Step 3: Typecheck + commit.**

Run: `npx tsc --noEmit` (Expected: exit 0)

```bash
git add lib/briefing/
git commit -m "feat(briefing): assembler with KPI live + stubbed modules 2-5"
```

---

### Task 4: `POST /api/briefing/run` (bearer) + Vercel cron

**Files:**
- Create: `app/api/briefing/run/route.ts`
- Modify: `vercel.json` (add `crons`)
- Modify: `.env.example` (document `BRIEFING_RUN_TOKEN`, `DISCORD_BRIEFING_WEBHOOK`)

**Interfaces:**
- Consumes: `assembleBriefing`, `upsertDailyBriefing`, `postBriefingDigest` (Task 5).
- Produces: route that assembles → upserts → pushes; `?dry=1` returns JSON without writing.

- [ ] **Step 1: Route.** Create `app/api/briefing/run/route.ts` (follow the bearer pattern in `app/api/recaps/route.ts`):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { assembleBriefing } from "@/lib/briefing/assemble";
import { upsertDailyBriefing } from "@/lib/db/queries";
import { postBriefingDigest } from "@/lib/briefing/report";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  // Vercel Cron sends its own header; also accept our shared token.
  const isCron = req.headers.get("x-vercel-cron") != null;
  if (!isCron && token !== process.env.BRIEFING_RUN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const { date, sections, status } = await assembleBriefing();
  if (dry) return NextResponse.json({ date, sections, status, dry: true });
  await upsertDailyBriefing(date, sections, status);
  await postBriefingDigest({ date, sections, status });
  return NextResponse.json({ date, status, ok: true });
}
```

- [ ] **Step 2: Cron config.** In `vercel.json`, add (keep existing keys):

```json
"crons": [{ "path": "/api/briefing/run", "schedule": "0 6 * * *" }]
```

- [ ] **Step 3: Document env.** Append to `.env.example`:

```
# Command Center morning briefing
BRIEFING_RUN_TOKEN=            # bearer for POST /api/briefing/run (manual triggers)
DISCORD_BRIEFING_WEBHOOK=      # optional; morning digest/alert
```

- [ ] **Step 4: Build + dry-run test.**

Run: `pnpm build` then `pnpm exec next start -p 3000 &` then `curl -s -XPOST 'http://localhost:3000/api/briefing/run?dry=1' -H "authorization: Bearer $BRIEFING_RUN_TOKEN" | node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log(d.status, Object.keys(d.sections))"`
Expected: prints a status + `[ 'kpis', 'content', 'audience', 'calendar', 'actions' ]`.

- [ ] **Step 5: Commit.**

```bash
git add app/api/briefing/run/route.ts vercel.json .env.example
git commit -m "feat(briefing): /api/briefing/run route + daily vercel cron"
```

---

### Task 5: Discord digest

**Files:**
- Create: `lib/briefing/report.ts`

**Interfaces:**
- Consumes: the assembled `{date, sections, status}`.
- Produces: `postBriefingDigest(r: {date:string; sections:BriefingSections; status:string}): Promise<void>` — posts to `DISCORD_BRIEFING_WEBHOOK`; no-op if unset.

- [ ] **Step 1: Reporter.** Create `lib/briefing/report.ts` (mirror `scripts/sentinel/report.mjs` embed format):

```ts
import "server-only";
import type { BriefingSections } from "@/lib/db/queries";

export async function postBriefingDigest(r: { date: string; sections: BriefingSections; status: string }): Promise<void> {
  const webhook = process.env.DISCORD_BRIEFING_WEBHOOK;
  if (!webhook) return;
  const k = r.sections.kpis as { status: string; setters?: unknown[]; topBottlenecks?: { label: string; count: number }[] } | undefined;
  const lines: string[] = [];
  if (k?.status === "ok") {
    lines.push(`• Setters logged: ${k.setters?.length ?? 0}`);
    const bn = (k.topBottlenecks ?? []).map((b) => `${b.label} (${b.count})`).join(", ");
    lines.push(`• Top bottlenecks: ${bn || "none"}`);
  } else {
    lines.push(`• KPIs: ${k?.status ?? "unavailable"}`);
  }
  lines.push(`• Content/Audience/Calendar/Actions: not connected yet`);
  const body = {
    embeds: [{
      title: `☀️ Morning briefing — ${r.date}`,
      description: lines.join("\n"),
      color: r.status === "ok" ? 0x3ba55d : 0xe0a53b,
      timestamp: new Date().toISOString(),
    }],
  };
  await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}
```

- [ ] **Step 2: Typecheck + commit.**

Run: `npx tsc --noEmit` (Expected: exit 0)

```bash
git add lib/briefing/report.ts
git commit -m "feat(briefing): Discord morning digest (no-op without webhook)"
```

---

### Task 6: Command Center page (super_admin only)

**Files:**
- Create: `app/(admin)/command-center/page.tsx`
- Verify nav/route group matches existing admin pages under `app/(admin)/`.

**Interfaces:**
- Consumes: `requireSuperAdmin` (`lib/auth/session.ts`), `getLatestBriefing`.

- [ ] **Step 1: Page.** Create `app/(admin)/command-center/page.tsx`:

```tsx
import { requireSuperAdmin } from "@/lib/auth/session";
import { getLatestBriefing } from "@/lib/db/queries";
import { Card } from "@/components/ui/card";

export default async function CommandCenter() {
  await requireSuperAdmin();
  const briefing = await getLatestBriefing();
  const sections = (briefing?.sections ?? {}) as Record<string, { status?: string } & Record<string, unknown>>;
  const kpis = sections.kpis as { status: string; setters?: { name: string; callsBooked: number; showUps: number; closes: number; cash: number }[]; topBottlenecks?: { label: string; count: number }[] } | undefined;
  return (
    <div className="flex flex-col gap-8">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow">NOVA · command center</p>
        <h1 className="mt-2 text-4xl font-semibold">Morning briefing</h1>
        <p className="mt-1 text-sm text-muted-foreground">{briefing ? briefing.briefingDate : "No briefing yet — runs each morning."}</p>
      </header>

      <Card className="p-6">
        <h3 className="mb-4 font-sans text-[15px] font-semibold">Yesterday — setters</h3>
        {kpis?.status === "ok" ? (
          <>
            <ul className="flex flex-col gap-1 text-sm">
              {(kpis.setters ?? []).map((s) => (
                <li key={s.name} className="flex justify-between border-b border-[color:var(--line)] py-1.5 last:border-0">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">{s.callsBooked} booked · {s.showUps} showed · {s.closes} closed · ${s.cash.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <span className="eyebrow">Top bottlenecks</span>
              <div className="mt-1 text-sm">{(kpis.topBottlenecks ?? []).map((b) => `${b.label} (${b.count})`).join(" · ") || "none"}</div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No setter EODs for yesterday.</p>
        )}
      </Card>

      {(["content", "audience", "calendar", "actions"] as const).map((key) => (
        <Card key={key} className="p-6 opacity-70">
          <h3 className="font-sans text-[15px] font-semibold capitalize">{key}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{(sections[key]?.reason as string) ?? "Not connected yet."}</p>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Confirm the admin route group renders** (compare to a sibling under `app/(admin)/`; ensure the layout wraps it). Add a nav entry if the admin shell has a nav list.

- [ ] **Step 3: Typecheck + commit.**

Run: `npx tsc --noEmit` (Expected: exit 0)

```bash
git add "app/(admin)/command-center/page.tsx"
git commit -m "feat(briefing): Command Center page (super_admin) rendering latest briefing"
```

---

### Task 7: Verify (prod build + Playwright) + deploy

**Files:** none (verification).

- [ ] **Step 1: Full local verify.** Stop stray servers, then:

Run: `pnpm build && pnpm exec next start -p 3000 &` — then seed a real trigger: `curl -s -XPOST 'http://localhost:3000/api/briefing/run' -H "authorization: Bearer $BRIEFING_RUN_TOKEN"` (writes a row), then drive Playwright as `super_admin` to `/command-center` asserting the "Morning briefing" heading renders and **zero console errors**.
Expected: 200 from the route; page shows yesterday's setters (or the empty state) + four "not connected" cards.

- [ ] **Step 2: Sentinel regression.** Run `node scripts/sentinel/audit.mjs` and `node scripts/sentinel/run.mjs --no-build`.
Expected: audit ok; stress suites still pass (no tenant/role regressions introduced).

- [ ] **Step 3: Deploy.** Set `BRIEFING_RUN_TOKEN` (and optionally `DISCORD_BRIEFING_WEBHOOK`) in Vercel prod env. Then commit anything pending, fetch+rebase, `git push origin main`. Wait for READY; `curl -XPOST https://www.setco.pro/api/briefing/run -H "authorization: Bearer $BRIEFING_RUN_TOKEN"` → 200; open `/command-center` as super_admin.

- [ ] **Step 4: Final commit (if needed).**

```bash
git commit -am "chore(briefing): P1 verified + deployed" || true
```

---

## Self-Review

- **Spec coverage:** P1 covers the spine (cron + route + assembler), storage (`daily_briefing`), module 1 (KPIs + top-3 bottlenecks), the Command Center page, and the Discord push. Modules 2–5 are explicit placeholders per the spec's phasing (they need the OAuth/API setup in P2/P3). ICP is out of P1 scope (P3). ✔
- **Placeholders:** none — every step has concrete code or an exact command. The module 2–5 "not_connected" slices are intentional runtime values, not plan gaps. ✔
- **Type consistency:** `BriefingSections`, `KpisSlice`, `upsertDailyBriefing`, `getLatestBriefing`, `assembleBriefing`, `postBriefingDigest`, `yesterdayISO` are defined once and referenced consistently across tasks. ✔
- **Verify-at-build note:** `eodSubmissions.bottleneck` column name + `listAllEod`/`listAllUsers` signatures should be confirmed against `lib/db/queries.ts` at Task 2 (they exist as of this writing). ✔

## Follow-on plans (not this plan)

- **P2** — Google OAuth (YouTube Analytics + Calendar, published to Production) + Meta Instagram Login; `lib/instagram.ts`; extend `lib/youtube.ts`; modules `content`, `audience`, `calendar`. Gated on Matt creating the Meta app + Google Cloud project.
- **P3** — Fathom API `actions` module + ICP best-effort lane (`ig-dm-analyst`).
