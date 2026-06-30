"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import {
  disconnectSocialAccount,
  resolveClientAccess,
  upsertSocialAccount,
} from "@/lib/db/queries";
import type { UserRole } from "@/lib/auth/jwt";
import { resolveChannel, syncYoutube, youtubeConfigured } from "@/lib/youtube";

// Connecting a channel mirrors integrations access (client + ops), not the
// broader managerial set.
const ALLOWED: UserRole[] = ["client", "admin", "super_admin"];

export interface YoutubeConnectState {
  ok?: boolean;
  error?: string;
  channel?: string;
}

async function authClient(slug: string) {
  const session = await requireSession();
  if (!ALLOWED.includes(session.role)) return null;
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  return client;
}

/** Paste a channel URL/@handle → resolve via the public API → store the channel.
 *  Kicks off a first sync so the page has data immediately. */
export async function connectYoutubeAction(
  slug: string,
  _prev: YoutubeConnectState,
  formData: FormData,
): Promise<YoutubeConnectState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  if (!youtubeConfigured()) return { error: "YouTube isn't configured on the server yet." };

  const handle = (formData.get("handle")?.toString() ?? "").trim();
  if (!handle) return { error: "Enter your channel URL or @handle." };

  let channel;
  try {
    channel = await resolveChannel(handle);
  } catch (e) {
    return { error: e instanceof Error ? `Couldn't reach YouTube: ${e.message}` : "Couldn't reach YouTube." };
  }
  if (!channel) return { error: "Couldn't find that channel. Try the full channel URL." };

  await upsertSocialAccount({
    clientId: client.id,
    platform: "youtube",
    handle,
    channelId: channel.channelId,
    uploadsPlaylistId: channel.uploadsPlaylistId,
    displayName: channel.displayName,
    meta: channel.thumbnail ? { thumbnail: channel.thumbnail } : null,
  });
  // First pull (best-effort — connection still succeeds if the sync hiccups).
  await syncYoutube(client.id);

  revalidatePath(`/${slug}/integrations`);
  revalidatePath(`/${slug}/social`);
  return { ok: true, channel: channel.displayName };
}

export async function disconnectYoutubeAction(
  slug: string,
  _prev: YoutubeConnectState,
  _formData: FormData,
): Promise<YoutubeConnectState> {
  const client = await authClient(slug);
  if (!client) return { error: "Not authorised." };
  await disconnectSocialAccount(client.id, "youtube");
  revalidatePath(`/${slug}/integrations`);
  revalidatePath(`/${slug}/social`);
  return { ok: true };
}
