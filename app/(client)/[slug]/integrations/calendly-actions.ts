"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireIntegrationsAccess } from "@/lib/auth/session";
import {
  deactivateTrackedEvents,
  getIntegration,
  insertAudit,
  listTrackedEvents,
  resolveClientAccess,
  setTrackedEventCategory,
  upsertTrackedEvent,
} from "@/lib/db/queries";
import {
  disconnectCalendly,
  ensureCalendlyWebhook,
  getConnectedAccount,
  listCalendlyEventTypes,
  syncCalendly,
  type ConnectedAccount,
  type EventType,
} from "@/lib/calendly";

async function ctx(slug: string) {
  const session = await requireIntegrationsAccess();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const integration = await getIntegration(client.id, "calendly");
  if (!integration) notFound();
  return { session, client, integration };
}

/* ---- CALENDLY_MOCK: dev-only fixtures for visual/stress testing the modal
   without a live Calendly connection. Dormant in prod (env-gated). ---- */
const MOCK = process.env.CALENDLY_MOCK === "1";
const mockAccount: ConnectedAccount = {
  name: "Tone Owner",
  email: "owner@tone.co",
  organizationUri: "https://api.calendly.com/organizations/MOCKORG",
  organizationSlug: "tone-co",
};
const et = (n: string, kind: string, d: number, category?: string): EventType => ({
  uri: `https://api.calendly.com/event_types/${n.toLowerCase().replace(/\s+/g, "-")}`,
  name: n,
  kind,
  duration: d,
  schedulingUrl: `https://calendly.com/tone/${n.toLowerCase().replace(/\s+/g, "-")}`,
  ...(category ? { category } : {}),
});
let mockTracked: EventType[] = [
  et("Discovery call", "solo", 30, "sales_call"),
  et("Strategy session", "collective", 45, "client_call"),
];
let mockAvailable: EventType[] = [
  et("Discovery 15", "solo", 15),
  et("Onboarding call", "solo", 60),
  et("Quarterly review", "collective", 45),
  et("Quick sync", "solo", 15),
  et("Team standup", "group", 30),
  et("Closing call", "solo", 30),
];

export interface SyncState {
  ok?: boolean;
  msg?: string;
}
export async function syncCalendlyAction(slug: string, _prev: SyncState, _fd: FormData): Promise<SyncState> {
  if (MOCK) {
    await requireIntegrationsAccess();
    return { ok: true, msg: "Synced 4 events · 2 new, 2 updated. (mock)" };
  }
  const { client } = await ctx(slug);
  await ensureCalendlyWebhook(client.id); // keep real-time sync wired (no UI)
  const r = await syncCalendly(client.id);
  revalidatePath(`/${slug}/integrations`);
  revalidatePath(`/${slug}/calendar`);
  revalidatePath(`/${slug}/leads`);
  return r.ok ? { ok: true, msg: `Synced ${r.events} events · ${r.created} new, ${r.updated} updated.` } : { ok: false, msg: r.error ?? "Sync failed." };
}

export interface ManageData {
  ok: boolean;
  reauth?: boolean;
  error?: string;
  account?: ConnectedAccount;
  tracked?: EventType[];
  available?: EventType[];
}
function toEventType(t: { eventTypeUri: string; name: string; kind: string; duration: number; schedulingUrl: string; category: string }): EventType {
  return { uri: t.eventTypeUri, name: t.name, kind: t.kind, duration: t.duration, schedulingUrl: t.schedulingUrl, category: t.category };
}
/** Loaded when the manage dialog opens (skeletons until it resolves). */
export async function loadCalendlyManageData(slug: string): Promise<ManageData> {
  if (MOCK) {
    await requireIntegrationsAccess();
    return { ok: true, account: mockAccount, tracked: mockTracked, available: mockAvailable };
  }
  const { client, integration } = await ctx(slug);
  if (integration.status === "disconnected") return { ok: false, error: "Calendly is not connected." };
  if (integration.status === "reauth_required") return { ok: true, reauth: true, tracked: [], available: [] };
  try {
    void ensureCalendlyWebhook(client.id); // best-effort, non-blocking
    const [account, trackedRows, allTypes] = await Promise.all([
      getConnectedAccount(client.id),
      listTrackedEvents(integration.id),
      listCalendlyEventTypes(client.id),
    ]);
    const tracked = trackedRows.map(toEventType);
    const trackedUris = new Set(tracked.map((t) => t.uri));
    const available = allTypes.filter((t) => !trackedUris.has(t.uri));
    return { ok: true, account: account ?? undefined, tracked, available };
  } catch (e) {
    if (e instanceof Error && e.message === "reauth_required")
      return { ok: true, reauth: true, tracked: [], available: [] };
    return { ok: false, error: "Could not load Calendly data." };
  }
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface UpdateTrackedResult extends ActionResult {
  tracked?: EventType[];
}
export async function updateTrackedEventsAction(
  slug: string,
  additions: EventType[],
  removals: string[],
): Promise<UpdateTrackedResult> {
  if (MOCK) {
    await requireIntegrationsAccess();
    const addUris = new Set(additions.map((a) => a.uri));
    const removeSet = new Set(removals);
    const movedBack = mockTracked.filter((t) => removeSet.has(t.uri));
    mockTracked = mockTracked
      .filter((t) => !removeSet.has(t.uri))
      .concat(additions.map((a) => ({ ...a, category: a.category ?? "sales_call" })));
    mockAvailable = mockAvailable.filter((a) => !addUris.has(a.uri)).concat(movedBack.map(({ category: _c, ...rest }) => rest));
    return { ok: true, tracked: mockTracked };
  }
  const { session, client, integration } = await ctx(slug);
  try {
    for (const a of additions) {
      await upsertTrackedEvent(integration.id, {
        eventTypeUri: a.uri,
        name: a.name,
        kind: a.kind,
        duration: a.duration,
        schedulingUrl: a.schedulingUrl,
        category: a.category ?? "sales_call",
      });
    }
    if (removals.length) await deactivateTrackedEvents(integration.id, removals);
    await insertAudit({
      clientId: client.id,
      userId: session.userId,
      action: "calendly.tracked_events.update",
      detail: { added: additions.map((a) => a.uri), removed: removals },
    });
    const rows = await listTrackedEvents(integration.id);
    revalidatePath(`/${slug}/integrations`);
    return { ok: true, tracked: rows.map(toEventType) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save tracked events." };
  }
}

/** Set a single tracked event's category (sales_call | client_call | other). */
export async function setTrackedCategoryAction(
  slug: string,
  eventTypeUri: string,
  category: string,
): Promise<ActionResult> {
  if (!["sales_call", "client_call", "other"].includes(category)) return { ok: false, error: "Invalid category." };
  if (MOCK) {
    await requireIntegrationsAccess();
    mockTracked = mockTracked.map((t) => (t.uri === eventTypeUri ? { ...t, category } : t));
    return { ok: true };
  }
  const { session, client, integration } = await ctx(slug);
  try {
    await setTrackedEventCategory(integration.id, eventTypeUri, category);
    await insertAudit({ clientId: client.id, userId: session.userId, action: "calendly.tracked_events.category", detail: { eventTypeUri, category } });
    revalidatePath(`/${slug}/integrations`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update category." };
  }
}

export async function disconnectCalendlyAction(slug: string): Promise<ActionResult> {
  if (MOCK) {
    await requireIntegrationsAccess();
    return { ok: true };
  }
  const { session, client, integration } = await ctx(slug);
  try {
    const tracked = await listTrackedEvents(integration.id);
    await deactivateTrackedEvents(integration.id, tracked.map((t) => t.eventTypeUri));
    await disconnectCalendly(client.id); // deletes webhook + clears tokens/status
    await insertAudit({ clientId: client.id, userId: session.userId, action: "calendly.disconnect" });
    revalidatePath(`/${slug}/integrations`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not disconnect." };
  }
}
