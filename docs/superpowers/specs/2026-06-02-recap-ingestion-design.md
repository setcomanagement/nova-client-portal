# Recap Ingestion — skill → portal

- **Date:** 2026-06-02
- **Status:** Approved (design), implementing
- **Goal:** Real call recaps produced by `nova-recap-publish` get **logged into the portal's `call_recaps`** so they appear in the client's Recaps tab (interactive checklist + recording deep link), in addition to the existing hosted page + Discord/Gmail delivery.

## Decisions (locked with user)
1. **Log structured fields** (not just a link). Portal renders its own interactive recap from the fields.
2. **Identity = portal users table.** The call's non-Matt invitee email is matched against `users.email`; that user's `client_id` is the recap owner. No dependency on clients.json for the portal write.

## Portal side
- **Query** `createRecap(clientId, { title, tldr, fathomUrl, callDate, decisions, actionItems })` → inserts into `call_recaps`. `actionItems` stored as `{text, owner?, done:false}[]`; `decisions` as `string[]`.
- **Route** `POST /api/recaps` (`app/api/recaps/route.ts`, `runtime = "nodejs"`):
  - Auth: `Authorization: Bearer <token>` compared to `process.env.RECAP_INGEST_TOKEN`. If the env var is unset AND `NODE_ENV !== "production"`, accept the dev fallback `"dev-recap-token"` (local PGlite only). Production with no token configured → 500 (refuse to run open).
  - Body (JSON): `clientEmail` (required), `title` (required), `callDate?`, `tldr?`, `fathomUrl?`, `decisions?: string[]`, `actionItems?: {text, owner?}[]`.
  - Resolve client: `getUserByEmail(clientEmail)` → must have `clientId` → else `422 {error:"no portal client for <email>"}` (never guess).
  - Insert; return `201 {id, slug, url}` where `url = /<slug>/recaps/<id>`.
  - Errors: 401 bad token, 400 bad body, 422 unresolved client. Never echo the token.
- No new env required for local dev (fallback token); document `RECAP_INGEST_TOKEN` for prod.

## Skill side (`nova-recap-publish`)
- After Step 6 (self-verify) and before/with Step 7 delivery, add **Step 6.5 — log to portal**:
  - Read portal target from a new gitignored `config/clients.json` top-level `_portal` block: `{ ingest_url, ingest_token }` (documented in clients.example.json). If absent, skip with a flagged note (don't fail the deploy).
  - `POST {ingest_url}` with `Authorization: Bearer {ingest_token}`, body = the structured fields + `clientEmail` (the Fathom non-Matt invitee email).
  - On 201, include the portal recap URL in the Step 8 report. On non-2xx, surface it but don't block delivery.
  - Never print the token.

## Field mapping (skill → call_recaps)
`CALL_TITLE→title · TLDR→tldr · RECORDING_URL→fathomUrl · CALL_DATE→callDate · DECISIONS[]→decisions · CLIENT_TASKS[](text+owner)→actionItems`. `COVERED/NOVA_TASKS/NEXT_CALL_EXPECTATIONS` are not stored (page-only) — acceptable; revisit if the portal recap view should show them.

## Verification
- `tsc` + `next build` clean.
- Playwright/curl: `POST /api/recaps` with the dev token + `clientEmail: owner@tone.co` → 201; the recap then appears on `/tone/recaps` and its detail renders the action items as a checklist. Bad token → 401. Unknown email → 422.

## Out of scope
- Backfilling the 7 already-deployed recaps (manual or a later script).
- Storing COVERED/NOVA_TASKS in the portal.
- Real prod token provisioning (documented, set at deploy).
