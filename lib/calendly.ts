import "server-only";
import { SignJWT, jwtVerify } from "jose";
import {
  createLead,
  findLeadByEmail,
  getIntegration,
  listTrackedEvents,
  setIntegrationConnection,
  setIntegrationReauth,
  updateIntegrationMeta,
  upsertCalendlyBooking,
} from "@/lib/db/queries";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { IntegrationRow } from "@/lib/db/queries";
import type { CalendlyAnswer } from "@/lib/db/schema";

const AUTH_BASE = "https://auth.calendly.com";
const API_BASE = "https://api.calendly.com";

// Signed, short-lived OAuth state carrying the client slug (CSRF + routing).
function stateSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");
}
export async function signState(slug: string): Promise<string> {
  return new SignJWT({ slug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret());
}
export async function verifyState(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    return typeof payload.slug === "string" ? payload.slug : null;
  } catch {
    return null;
  }
}

export function calendlyConfigured(): boolean {
  return !!(process.env.CALENDLY_CLIENT_ID && process.env.CALENDLY_CLIENT_SECRET);
}
function clientId(): string {
  return process.env.CALENDLY_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.CALENDLY_CLIENT_SECRET ?? "";
}

/** Step 1: where to send the user to authorize. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_BASE}/oauth/authorize?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  owner: string; // user URI
  organization: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...body,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Calendly token ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Step 2: exchange the auth code for tokens. */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

type Meta = Record<string, string>;
function tokenMeta(t: TokenResponse, prev: Meta = {}): Meta {
  return {
    ...prev,
    at: encryptSecret(t.access_token),
    rt: encryptSecret(t.refresh_token),
    exp: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    userUri: t.owner,
    orgUri: t.organization,
  };
}

/** Persist tokens (encrypted) + user/org — merges with existing meta so
 *  cached user_name/email/webhook_uri survive a reconnect. */
export async function storeTokens(clientDbId: string, t: TokenResponse): Promise<void> {
  const existing = await getIntegration(clientDbId, "calendly");
  const prev = (existing?.meta ?? {}) as Meta;
  await setIntegrationConnection(clientDbId, "calendly", "connected", tokenMeta(t, prev));
}

/**
 * Resolve a usable access token + current meta, refreshing if expired. On
 * refresh failure the integration is flagged reauth_required and this throws.
 */
export async function ensureToken(
  clientDbId: string,
): Promise<{ token: string; m: Meta } | null> {
  const integration = await getIntegration(clientDbId, "calendly");
  if (!integration) return null;
  const m = (integration.meta ?? {}) as Meta;
  if (!m.at || !m.rt) return null;
  const expired = !m.exp || new Date(m.exp).getTime() < Date.now();
  if (!expired) return { token: decryptSecret(m.at), m };
  try {
    const r = await refreshTokens(decryptSecret(m.rt));
    const merged = tokenMeta(r, m);
    await updateIntegrationMeta(clientDbId, "calendly", merged);
    return { token: r.access_token, m: merged };
  } catch {
    await setIntegrationReauth(clientDbId);
    throw new Error("reauth_required");
  }
}

async function validToken(
  clientDbId: string,
  integration: IntegrationRow,
): Promise<{ token: string; userUri: string } | null> {
  const t = await ensureToken(clientDbId).catch(() => null);
  void integration;
  return t ? { token: t.token, userUri: t.m.userUri } : null;
}

async function apiGet<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Calendly API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function apiPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendly API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}
async function apiDelete(token: string, url: string): Promise<void> {
  const res = await fetch(url.startsWith("http") ? url : `${API_BASE}${url}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Calendly API ${res.status}: ${await res.text()}`);
}

interface EventResource {
  uri: string;
  name: string | null;
  status: string;
  start_time: string;
  event_type?: string; // event type URI — gated against tracked events
  location?: { join_url?: string; location?: string } | null;
}
interface InviteeResource {
  uri: string;
  email: string;
  name: string;
  status: string;
  no_show?: { uri: string } | null;
  questions_and_answers?: { question: string; answer: string }[];
}

interface EventsPage {
  collection: EventResource[];
  pagination: { next_page: string | null };
}

export interface SyncResult {
  ok: boolean;
  created: number;
  updated: number;
  events: number;
  error?: string;
}

/** Pull the client's Calendly scheduled events + invitees → bookings + leads. */
export async function syncCalendly(clientDbId: string): Promise<SyncResult> {
  if (!calendlyConfigured())
    return { ok: false, created: 0, updated: 0, events: 0, error: "Calendly not configured on the server." };
  const integration = await getIntegration(clientDbId, "calendly");
  if (!integration || integration.status !== "connected")
    return { ok: false, created: 0, updated: 0, events: 0, error: "Calendly not connected." };

  try {
    const tok = await validToken(clientDbId, integration);
    if (!tok) return { ok: false, created: 0, updated: 0, events: 0, error: "Missing tokens — reconnect." };

    // Only tracked event types create bookings. Empty set = track everything
    // (so a freshly-connected account still syncs before any selection).
    const trackedRows = await listTrackedEvents(integration.id);
    const trackedMap = new Map(trackedRows.map((r) => [r.eventTypeUri, r]));
    const gated = trackedMap.size > 0;

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    let created = 0,
      updated = 0,
      events = 0;
    let cursor: string | null =
      `${API_BASE}/scheduled_events?user=${encodeURIComponent(tok.userUri)}&count=100&sort=start_time:asc&min_start_time=${encodeURIComponent(since)}`;
    let pages = 0;
    while (cursor && pages < 5) {
      const url: string = cursor;
      const page = await apiGet<EventsPage>(tok.token, url);
      for (const ev of page.collection) {
        if (gated && ev.event_type && !trackedMap.has(ev.event_type)) continue;
        events++;
        const category = (ev.event_type && trackedMap.get(ev.event_type)?.category) ?? "sales_call";
        const invitees = await apiGet<{ collection: InviteeResource[] }>(tok.token, `${ev.uri}/invitees`);
        const past = new Date(ev.start_time).getTime() < Date.now();
        const meetingUrl = ev.location?.join_url ?? ev.location?.location ?? null;
        for (const inv of invitees.collection) {
          const canceled = ev.status === "canceled" || inv.status === "canceled";
          const status = canceled ? "canceled" : inv.no_show ? "no_show" : past ? "completed" : "scheduled";
          const answers: CalendlyAnswer[] = (inv.questions_and_answers ?? [])
            .filter((qa) => qa.answer)
            .map((qa) => ({ q: qa.question, a: qa.answer }));
          // Only SALES calls become leads. Client calls / others are bookings only.
          let leadId: string | null = null;
          if (category === "sales_call" && inv.email) {
            const existing = await findLeadByEmail(clientDbId, inv.email);
            if (existing) leadId = existing.id;
            else {
              const lead = await createLead(clientDbId, {
                name: inv.name || inv.email,
                email: inv.email,
                source: "Calendly",
                stage: status === "completed" ? "showed" : canceled ? "lost" : "booked",
              });
              leadId = lead.id;
            }
          }
          const r = await upsertCalendlyBooking({
            clientId: clientDbId,
            leadId,
            calendlyEventUri: ev.uri,
            calendlyInviteeUri: inv.uri,
            callType: ev.name,
            scheduledAt: new Date(ev.start_time),
            status,
            meetingUrl,
            calendlyAnswers: answers,
            inviteeName: inv.name ?? null,
            inviteeEmail: inv.email ?? null,
          });
          r === "inserted" ? created++ : updated++;
        }
      }
      cursor = page.pagination?.next_page ?? null;
      pages++;
    }
    return { ok: true, created, updated, events };
  } catch (e) {
    return { ok: false, created: 0, updated: 0, events: 0, error: e instanceof Error ? e.message : "sync failed" };
  }
}

/* ---- Management API (used by the manage-dialog server actions) ---- */

export interface ConnectedAccount {
  name: string;
  email: string;
  organizationUri: string;
  organizationSlug: string;
}
export async function getConnectedAccount(clientDbId: string): Promise<ConnectedAccount | null> {
  const t = await ensureToken(clientDbId);
  if (!t) return null;
  let m = t.m;
  if (!m.userName || !m.userEmail) {
    const me = await apiGet<{
      resource: { name: string; email: string; uri: string; current_organization: string };
    }>(t.token, "/users/me");
    m = { ...m, userName: me.resource.name, userEmail: me.resource.email, userUri: me.resource.uri, orgUri: me.resource.current_organization };
    await updateIntegrationMeta(clientDbId, "calendly", m);
  }
  return {
    name: m.userName,
    email: m.userEmail,
    organizationUri: m.orgUri ?? "",
    organizationSlug: (m.orgUri ?? "").split("/").pop() ?? "",
  };
}

export interface WebhookSubscription {
  uri: string;
  callbackUrl: string;
  events: string[];
  scope: string;
  state: string;
}
export async function listCalendlyWebhooks(clientDbId: string): Promise<WebhookSubscription[]> {
  const t = await ensureToken(clientDbId);
  if (!t || !t.m.orgUri) return [];
  const data = await apiGet<{ collection: Array<{ uri: string; callback_url: string; events: string[]; scope: string; state: string }> }>(
    t.token,
    `/webhook_subscriptions?organization=${encodeURIComponent(t.m.orgUri)}&scope=organization&count=20`,
  );
  return data.collection.map((w) => ({
    uri: w.uri,
    callbackUrl: w.callback_url,
    events: w.events,
    scope: w.scope,
    state: w.state,
  }));
}
export async function createCalendlyWebhook(clientDbId: string): Promise<{ uri: string }> {
  const t = await ensureToken(clientDbId);
  if (!t || !t.m.orgUri) throw new Error("Calendly not connected.");
  const base = process.env.WEBHOOK_BASE_URL;
  if (!base) throw new Error("WEBHOOK_BASE_URL is not set.");
  const signing = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!signing) throw new Error("CALENDLY_WEBHOOK_SECRET is not set.");
  const res = await apiPost<{ resource: { uri: string } }>(t.token, "/webhook_subscriptions", {
    url: `${base}/api/webhooks/calendly`,
    events: ["invitee.created", "invitee.canceled"],
    organization: t.m.orgUri,
    scope: "organization",
    signing_key: signing,
  });
  await updateIntegrationMeta(clientDbId, "calendly", { ...t.m, webhookUri: res.resource.uri });
  return { uri: res.resource.uri };
}
/** Ensure a webhook exists for our endpoint (auto-managed; no UI). Best-effort. */
export async function ensureCalendlyWebhook(clientDbId: string): Promise<void> {
  const base = process.env.WEBHOOK_BASE_URL;
  if (!base || !process.env.CALENDLY_WEBHOOK_SECRET) return;
  const target = `${base}/api/webhooks/calendly`;
  try {
    const hooks = await listCalendlyWebhooks(clientDbId);
    if (!hooks.some((h) => h.callbackUrl === target)) {
      await createCalendlyWebhook(clientDbId);
    }
  } catch {
    /* non-fatal — webhook can be retried on next sync */
  }
}

export async function deleteCalendlyWebhook(clientDbId: string, uri: string): Promise<void> {
  const t = await ensureToken(clientDbId);
  if (!t) return;
  await apiDelete(t.token, uri);
  const m = { ...t.m };
  if (m.webhookUri === uri) delete m.webhookUri;
  await updateIntegrationMeta(clientDbId, "calendly", m);
}

export interface EventType {
  uri: string;
  name: string;
  kind: string; // solo | group | collective
  duration: number;
  schedulingUrl: string;
  category?: string; // sales_call | client_call | other (tracked events only)
}
export async function listCalendlyEventTypes(clientDbId: string): Promise<EventType[]> {
  const t = await ensureToken(clientDbId);
  if (!t || !t.m.orgUri) return [];
  const data = await apiGet<{
    collection: Array<{ uri: string; name: string; kind?: string; pooling_type?: string | null; duration: number; scheduling_url: string }>;
  }>(t.token, `/event_types?organization=${encodeURIComponent(t.m.orgUri)}&active=true&count=100`);
  return data.collection.map((et) => ({
    uri: et.uri,
    name: et.name,
    kind: et.pooling_type === "collective" ? "collective" : (et.kind ?? (et.pooling_type ? "group" : "solo")),
    duration: et.duration,
    schedulingUrl: et.scheduling_url,
  }));
}

/** Disconnect: best-effort delete the webhook, then clear tokens + status. */
export async function disconnectCalendly(clientDbId: string): Promise<void> {
  const integration = await getIntegration(clientDbId, "calendly");
  const webhookUri = (integration?.meta as Meta | null)?.webhookUri;
  if (webhookUri) {
    await deleteCalendlyWebhook(clientDbId, webhookUri).catch(() => {});
  }
  await setIntegrationConnection(clientDbId, "calendly", "disconnected", null);
}
