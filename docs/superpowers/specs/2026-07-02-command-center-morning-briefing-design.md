# Command Center — First Morning Briefing

**Status:** design approved 2026-07-02 (brainstorming + deep-research + first-principles)
**Repo:** setcomanagement/nova-client-portal (Next.js 16, Vercel, Neon). Live www.setco.pro.

## Goal

One personal daily artifact that collapses Matt's morning orientation to near-zero:
what happened yesterday (performance signals), what today holds (commitments), and
the derived actions — assembled automatically each morning into a **Command Center**
page in the portal plus a morning push.

## Decisions (from brainstorming)

- **Sequencing:** research-first (done), then design the full system, build in phases.
- **Delivery:** a Matt-only **Command Center** page in the NOVA portal + a morning
  push (Discord, reusing the sentinel webhook pattern).
- **Orchestration:** portal-native (Vercel Cron → API route), NOT a cloud agent —
  the data feeds a portal page and needs the portal's OAuth tokens + DB.
- **ICP-qualified followers:** best-effort / semi-attended lane, not a guaranteed
  metric (API cannot provide it — see research).

## Research verdicts (deep-research 2026-07-02, cited, adversarially verified)

| Briefing need | Path | Reliability |
| --- | --- | --- |
| Last **Reel** metrics (views/likes/comments/saves/shares/reach) | **Instagram API with Instagram Login** (Business Login OAuth) — **no Facebook Page needed**; scopes `instagram_business_basic` + `instagram_business_manage_insights`; `/{media-id}/insights`; 60-day refreshable token | Good; token can be silently invalidated (password change / suspicious activity) → needs failure-detection + re-auth alert |
| Last **YouTube** post metrics + **subs gained/lost** | **YouTube Data API v3** (latest upload via uploads playlist — avoid `search.list`) + **YouTube Analytics API** (`reports.query`, `subscribersGained/Lost`, per-video via `video` filter); OAuth offline; scope `yt-analytics.readonly` (+ `youtube.readonly`); ~2–3 units/day vs 10,000 | High; **must publish OAuth app to Production** (Testing mode kills refresh tokens after 7 days) |
| **Followers gained/lost (daily)** | YouTube: exact via Analytics. Instagram: **net** `follower_count` delta reliable; precise daily gained-vs-lost on the Instagram-Login path **unverified** — check live docs, may be net-only | Mixed |
| **ICP-qualified follower classification** | **No official API** (IG never returns a follower list or per-follower identity). Only path = logged-in browser session (existing `ig-dm-analyst` CDP approach) | Low / not unattended-safe → best-effort lane |

Open items to verify against **live Meta docs at build time**: exact 2026 Reel
insight metric names (watch time; whether `impressions` was renamed/removed) and
whether daily gained-vs-lost is exposed on the Instagram-Login path.

## Reuse — what already exists in the portal

A prior effort already built a per-client `/social` feature we build on, not around:
- **`socialPlatform`** enum (`youtube`, `instagram`).
- **`socialAccounts`** — `platform`, `channelId`, **`uploadsPlaylistId`** (exactly the
  research's cheap latest-video approach), `handle`, `displayName`, `lastSyncedAt`,
  unique on `(clientId, platform)`.
- **`socialContent`** — `externalId`, `title`, `url`, `publishedAt`, `views` (bigint),
  `likes`, `comments`, `reach`, `source` (`youtube_api`|`manual`).
- **`socialFollowerSnapshots`** — `platform`, `capturedOn`, `count`, `source`, unique
  per `(clientId, platform, day)` → daily deltas already modelable.
- **`app/(client)/[slug]/social/`** — page + charts + forms (YouTube auto via
  `lib/youtube.ts` using a public `YOUTUBE_API_KEY`; Instagram currently **manual**).

Gaps this project fills: Instagram becomes **API-driven** (Instagram Login); YouTube
gains **Analytics** (subs gained/lost, currently only public counts); plus the new
Calendar, Fathom, and briefing-assembly layers.

## Architecture

**Portal-native daily pipeline.** A **Vercel Cron** (`vercel.json` `crons`, early AM)
hits **`POST /api/briefing/run`** (bearer-guarded). It calls six isolated modules,
each returning one JSON slice, assembles a `daily_briefing` row, and fires the push.
The **Command Center page** renders the latest briefing. Each module is independently
testable with a clean input/output.

### Modules (each → one briefing slice)

1. **`kpis`** — yesterday's setter KPIs + **top-3 bottlenecks**. Reads existing EOD /
   stats queries (`listClientDailyKpis` / EOD rows); `bottleneck` is already an EOD
   field — rank by frequency. *(Zero new external access.)*
2. **`content`** — last IG Reel (new `lib/instagram.ts`, Instagram Login API) + last
   YouTube video (extend `lib/youtube.ts`). Writes/updates `socialContent`.
3. **`audience`** — YouTube subs gained/lost (Analytics) + IG follower net-delta;
   writes `socialFollowerSnapshots`. **ICP line** = best-effort from the `ig-dm-analyst`
   lane when a recent run exists, else "net growth + note."
4. **`calendar`** — today's events via the **Google Calendar API** (same Google OAuth
   project as YouTube Analytics).
5. **`actions`** — yesterday's Fathom recordings → action items via the **Fathom API**
   (summaries already surface action items; optional Claude-API enrichment from the
   transcript for looser "to-dos").
6. **Command Center page + push** — Matt-only surface rendering all slices; morning
   Discord push with the digest + a link.

### Whose accounts

The briefing is personal, but the social tables are client-scoped. Matt's own
IG/YouTube are registered as a `socialAccounts` row under a dedicated **internal
"NOVA" client** (or an admin-owned account id). The Command Center is gated to
`super_admin` and reads that internal account + the roll-up across real clients for
the setter-KPI slice.

## Data model

Reuse `socialAccounts` / `socialContent` / `socialFollowerSnapshots` as-is. Add:

- **`social_oauth_tokens`** — per `(accountId, provider)`: encrypted `access_token`,
  `refresh_token`, `expires_at`, `scope`, `status` (`active`|`needs_reauth`). Encrypted
  at rest via existing `lib/crypto.ts` (AES-GCM keyed off `JWT_SECRET`).
- **`daily_briefing`** — `id`, `briefingDate` (unique), `sections` jsonb (the six
  slices), `generatedAt`, `status`. The page reads the latest row; the cron upserts.

## Auth / secrets (one-time setup Matt owns)

- **Meta app** (Instagram Login): app id/secret in env; one-time OAuth consent →
  60-day token stored in `social_oauth_tokens`; cron refreshes when >24h old.
- **Google Cloud project** (YouTube Analytics + Calendar): OAuth **published to
  Production**; offline consent → refresh token stored encrypted.
- **Fathom API key** in env.
- Reuse `DISCORD_SENTINEL_WEBHOOK` pattern → a `DISCORD_BRIEFING_WEBHOOK`.
- Token-invalidation handling: on a 190/`invalid_grant`, mark `needs_reauth`, skip that
  slice gracefully, and alert via the push with a re-auth link.

## Error handling

Every module is best-effort and isolated: a module that fails (expired token, API
down, no data) yields a `null`/`error` slice with a reason; the briefing still
assembles and renders the slices that succeeded, and the push notes what was missing.
The cron never throws as a whole.

## Testing

- Per-module unit tests with fixtures (mock IG/YouTube/Calendar/Fathom responses).
- A `--dry-run` mode for `/api/briefing/run` that assembles from fixtures without
  external calls (for CI + the sentinel to regression-guard).
- Manual: one-time OAuth connect flows verified against live APIs; the exact IG Reel
  metric names verified against live Meta docs before wiring `content`.

## Phasing

- **P1 — Spine + page + zero-setup modules.** `daily_briefing` table, `/api/briefing/run`
  cron, Command Center page, push, and module **1 (KPIs)**. Modules 2–5 render as
  "not connected yet" placeholders. → a working briefing immediately.
- **P2 — Content + audience.** Google OAuth (YouTube Analytics + Calendar) + Meta
  Instagram Login; `lib/instagram.ts`; extend `lib/youtube.ts`; modules **2, 3, 4**.
- **P3 — Fathom + ICP.** Module **5** (Fathom actions) and the **ICP best-effort** lane
  (`ig-dm-analyst` integration).

Each phase is independently shippable and guarded by the existing sentinel suite.

## Risks & mitigations

- **YouTube 7-day token death** → publish OAuth to Production (P2 checklist item).
- **IG token silent invalidation** → detect + `needs_reauth` + push alert + easy re-auth.
- **IG metric-name drift** → verify against live docs before coding `content`.
- **MCP absence in cron** → use direct Calendar/Fathom REST APIs, not claude.ai MCP.
- **ICP unreliability** → explicitly best-effort; never block the briefing on it.

## Out of scope

- Per-client morning briefings (this is Matt-personal; the pattern could generalize later).
- Real-time/streaming updates (daily batch only).
- Historical backfill of pre-existing IG content beyond the latest post(s).
