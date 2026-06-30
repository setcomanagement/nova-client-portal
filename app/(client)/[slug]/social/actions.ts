"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  deleteManualContent,
  insertManualContent,
  resolveClientAccess,
  setContentLeadsGained,
  upsertFollowerSnapshot,
} from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";
import { syncYoutube } from "@/lib/youtube";

const MANAGERIAL: UserRole[] = ["client", "manager", "admin", "super_admin"];

export interface SocialState {
  ok?: boolean;
  error?: string;
  note?: string;
}

async function authClient(slug: string) {
  const session = await requireSession();
  if (!MANAGERIAL.includes(session.role)) return null;
  return resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
}

const num = (formData: FormData, k: string): number =>
  Math.max(0, Math.round(Number(formData.get(k)) || 0));

/** Pull fresh YouTube stats on demand (managerial). */
export async function refreshYoutubeAction(
  slug: string,
  _prev: SocialState,
  _formData: FormData,
): Promise<SocialState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  const res = await syncYoutube(client.id);
  revalidatePath(`/${slug}/social`);
  if (!res.ok) return { error: res.error ?? "Sync failed." };
  return { ok: true, note: `Synced — ${res.created} new, ${res.updated} updated.` };
}

/** Inline edit of the manual "leads gained" overlay on any content row. */
export async function setLeadsGainedAction(
  slug: string,
  _prev: SocialState,
  formData: FormData,
): Promise<SocialState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  const contentId = formData.get("contentId")?.toString() ?? "";
  if (!contentId) return { error: "Missing content." };
  await setContentLeadsGained(contentId, client.id, num(formData, "leadsGained"));
  revalidatePath(`/${slug}/social`);
  return { ok: true };
}

/** Log a manual Instagram post. */
export async function addInstagramPostAction(
  slug: string,
  _prev: SocialState,
  formData: FormData,
): Promise<SocialState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };

  const title = (formData.get("title")?.toString() ?? "").trim() || null;
  const url = (formData.get("url")?.toString() ?? "").trim() || null;
  const dateStr = formData.get("publishedAt")?.toString() ?? "";
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00Z`) : null;

  await insertManualContent({
    clientId: client.id,
    platform: "instagram",
    title,
    url,
    publishedAt,
    views: num(formData, "views"),
    likes: num(formData, "likes"),
    comments: num(formData, "comments"),
    reach: num(formData, "reach"),
    leadsGained: num(formData, "leadsGained"),
  });
  revalidatePath(`/${slug}/social`);
  return { ok: true };
}

export async function deleteInstagramPostAction(
  slug: string,
  _prev: SocialState,
  formData: FormData,
): Promise<SocialState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  const contentId = formData.get("contentId")?.toString() ?? "";
  if (contentId) await deleteManualContent(contentId, client.id);
  revalidatePath(`/${slug}/social`);
  return { ok: true };
}

/** Record today's Instagram follower count (drives the growth chart). */
export async function setFollowerCountAction(
  slug: string,
  _prev: SocialState,
  formData: FormData,
): Promise<SocialState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  const dateStr = formData.get("capturedOn")?.toString() ?? "";
  const capturedOn = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10);
  await upsertFollowerSnapshot({
    clientId: client.id,
    platform: "instagram",
    capturedOn,
    count: num(formData, "count"),
    source: "manual",
  });
  revalidatePath(`/${slug}/social`);
  return { ok: true };
}
