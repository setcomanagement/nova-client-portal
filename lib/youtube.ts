import "server-only";
import {
  getSocialAccount,
  touchSocialAccountSync,
  upsertFollowerSnapshot,
  upsertYoutubeVideo,
} from "@/lib/db/queries";

// Public YouTube Data API v3 — server-side API key only (no OAuth). Reads
// public channel + video statistics. Configure YOUTUBE_API_KEY in the env.
const API_BASE = "https://www.googleapis.com/youtube/v3";

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

function key(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY is not set");
  return k;
}

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: key() });
  const res = await fetch(`${API_BASE}/${path}?${qs}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/* ---- Channel input parsing ----
   Accept a raw channel id (UC…), an @handle, a full channel/handle URL, or a
   legacy /c//user/ vanity name. Returns the best selector for channels.list. */
type ChannelSelector =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

export function parseChannelInput(raw: string): ChannelSelector | null {
  const s = raw.trim();
  if (!s) return null;

  // Raw channel id
  if (/^UC[\w-]{20,}$/.test(s)) return { kind: "id", value: s };
  // Bare @handle
  if (s.startsWith("@")) return { kind: "handle", value: s };

  // URL forms
  const m = s.match(/youtube\.com\/(channel\/(UC[\w-]+)|(@[\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
  if (m) {
    if (m[2]) return { kind: "id", value: m[2] };
    if (m[3]) return { kind: "handle", value: m[3] };
    if (m[4]) return { kind: "username", value: m[4] };
    if (m[5]) return { kind: "username", value: m[5] };
  }
  // Fallback: treat a bare word as a handle (the common case for "@name" typed
  // without the @, or a custom name).
  return { kind: "handle", value: s.startsWith("@") ? s : `@${s}` };
}

interface ChannelListResponse {
  items?: {
    id: string;
    snippet?: { title?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

export interface ResolvedChannel {
  channelId: string;
  displayName: string;
  uploadsPlaylistId: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  thumbnail: string | null;
}

function mapChannel(r: ChannelListResponse): ResolvedChannel | null {
  const it = r.items?.[0];
  if (!it) return null;
  return {
    channelId: it.id,
    displayName: it.snippet?.title ?? "",
    uploadsPlaylistId: it.contentDetails?.relatedPlaylists?.uploads ?? null,
    subscriberCount: Number(it.statistics?.subscriberCount ?? 0),
    viewCount: Number(it.statistics?.viewCount ?? 0),
    videoCount: Number(it.statistics?.videoCount ?? 0),
    thumbnail: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
  };
}

const PARTS = "snippet,statistics,contentDetails";

/** Resolve a pasted channel URL/handle/id to a channel (1 quota unit, or 100
 *  if we must fall back to search for an unresolvable vanity name). */
export async function resolveChannel(raw: string): Promise<ResolvedChannel | null> {
  const sel = parseChannelInput(raw);
  if (!sel) return null;

  if (sel.kind === "id") {
    return mapChannel(await apiGet<ChannelListResponse>("channels", { part: PARTS, id: sel.value }));
  }
  if (sel.kind === "handle") {
    const byHandle = mapChannel(
      await apiGet<ChannelListResponse>("channels", { part: PARTS, forHandle: sel.value }),
    );
    if (byHandle) return byHandle;
  }
  if (sel.kind === "username") {
    const byUser = mapChannel(
      await apiGet<ChannelListResponse>("channels", { part: PARTS, forUsername: sel.value }),
    );
    if (byUser) return byUser;
  }

  // Last resort: search (100 units). Resolve the id, then re-fetch full parts.
  const q = sel.value.replace(/^@/, "");
  const search = await apiGet<{ items?: { id?: { channelId?: string } }[] }>("search", {
    part: "snippet",
    type: "channel",
    maxResults: "1",
    q,
  });
  const cid = search.items?.[0]?.id?.channelId;
  if (!cid) return null;
  return mapChannel(await apiGet<ChannelListResponse>("channels", { part: PARTS, id: cid }));
}

export async function fetchChannelStats(
  channelId: string,
): Promise<{ subscriberCount: number; viewCount: number; videoCount: number; uploadsPlaylistId: string | null }> {
  const ch = mapChannel(await apiGet<ChannelListResponse>("channels", { part: PARTS, id: channelId }));
  if (!ch) throw new Error("Channel not found");
  return {
    subscriberCount: ch.subscriberCount,
    viewCount: ch.viewCount,
    videoCount: ch.videoCount,
    uploadsPlaylistId: ch.uploadsPlaylistId,
  };
}

export interface YoutubeVideo {
  videoId: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  views: number;
  likes: number;
  comments: number;
}

interface PlaylistItemsResponse {
  nextPageToken?: string;
  items?: { contentDetails?: { videoId?: string } }[];
}
interface VideosResponse {
  items?: {
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
}

/** Pull recent uploads with per-video stats. Caps pages to respect quota
 *  (default 100 videos = 2 playlistItems pages + 2 videos batches ≈ 4 units). */
export async function fetchChannelVideos(uploadsPlaylistId: string, max = 100): Promise<YoutubeVideo[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  while (ids.length < max && pages < 4) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const page = await apiGet<PlaylistItemsResponse>("playlistItems", params);
    for (const it of page.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = page.nextPageToken;
    pages++;
    if (!pageToken) break;
  }

  const videos: YoutubeVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await apiGet<VideosResponse>("videos", { part: "snippet,statistics", id: batch.join(",") });
    for (const v of res.items ?? []) {
      videos.push({
        videoId: v.id,
        title: v.snippet?.title ?? "",
        url: `https://www.youtube.com/watch?v=${v.id}`,
        publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
      });
    }
  }
  return videos;
}

export interface SyncResult {
  ok: boolean;
  created: number;
  updated: number;
  error?: string;
}

/** Refresh a client's YouTube data: subscriber snapshot + per-video stats.
 *  Always reads config from social_accounts; never throws — returns a result. */
export async function syncYoutube(clientId: string): Promise<SyncResult> {
  try {
    if (!youtubeConfigured()) return { ok: false, created: 0, updated: 0, error: "YouTube API key not configured." };
    const account = await getSocialAccount(clientId, "youtube");
    if (!account?.channelId) return { ok: false, created: 0, updated: 0, error: "No channel connected." };

    const stats = await fetchChannelStats(account.channelId);
    const uploads = account.uploadsPlaylistId ?? stats.uploadsPlaylistId;
    const today = new Date().toISOString().slice(0, 10);
    await upsertFollowerSnapshot({
      clientId,
      platform: "youtube",
      capturedOn: today,
      count: stats.subscriberCount,
      source: "youtube_api",
    });

    let created = 0;
    let updated = 0;
    if (uploads) {
      const videos = await fetchChannelVideos(uploads);
      for (const v of videos) {
        const r = await upsertYoutubeVideo({
          clientId,
          externalId: v.videoId,
          title: v.title,
          url: v.url,
          publishedAt: v.publishedAt,
          views: v.views,
          likes: v.likes,
          comments: v.comments,
        });
        if (r === "inserted") created++;
        else updated++;
      }
    }
    await touchSocialAccountSync(clientId, "youtube", new Date());
    return { ok: true, created, updated };
  } catch (e) {
    return { ok: false, created: 0, updated: 0, error: e instanceof Error ? e.message : "Sync failed." };
  }
}
