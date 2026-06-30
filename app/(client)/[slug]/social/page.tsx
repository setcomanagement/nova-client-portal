import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import {
  getSocialAccount,
  listFollowerSnapshots,
  listSocialContent,
  resolveClientAccess,
} from "@/lib/db/queries";
import type { SocialContentRow, SocialFollowerSnapshotRow } from "@/lib/db/schema";
import { youtubeConfigured } from "@/lib/youtube";
import { FollowerTrend, type CountPoint } from "./social-charts";
import { RefreshButton } from "./refresh-button";
import { LeadsGainedCell } from "./leads-gained-cell";
import { AddInstagramForm } from "./add-instagram-form";
import { FollowerCountForm } from "./follower-count-form";

const MANAGERIAL = ["client", "manager", "admin", "super_admin"];
const ALL_TIME = "2000-01-01";

function commas(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function snapsToPoints(rows: SocialFollowerSnapshotRow[]): CountPoint[] {
  return rows.map((r) => ({ date: r.capturedOn, count: r.count }));
}
function latest(rows: SocialFollowerSnapshotRow[]): number {
  return rows.length ? rows[rows.length - 1].count : 0;
}
function growth(rows: SocialFollowerSnapshotRow[]): number {
  return rows.length ? rows[rows.length - 1].count - rows[0].count : 0;
}

function Scorecard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${commas(n)}`;
}

export default async function SocialPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const { slug } = await params;
  const { platform: platformParam } = await searchParams;
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const canManage = MANAGERIAL.includes(session.role);
  const platform: "youtube" | "instagram" = platformParam === "instagram" ? "instagram" : "youtube";
  const today = new Date().toISOString().slice(0, 10);

  const [ytAccount, ytContent, ytSnaps, igContent, igSnaps] = await Promise.all([
    getSocialAccount(client.id, "youtube"),
    listSocialContent(client.id, "youtube"),
    listFollowerSnapshots(client.id, "youtube", ALL_TIME),
    listSocialContent(client.id, "instagram"),
    listFollowerSnapshots(client.id, "instagram", ALL_TIME),
  ]);

  const tabs: { key: "youtube" | "instagram"; label: string }[] = [
    { key: "youtube", label: "YouTube" },
    { key: "instagram", label: "Instagram" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · social</p>
        <h1 className="mt-2 text-3xl font-semibold">Social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track channel growth and how each piece of content performs.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/${slug}/social?platform=${t.key}`}
            className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors ${
              platform === t.key
                ? "bg-accent text-white"
                : "border border-border text-muted-foreground hover:bg-card"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {platform === "youtube"
        ? renderYoutube()
        : renderInstagram()}
    </div>
  );

  function renderYoutube() {
    if (!ytAccount?.channelId) {
      return (
        <Card className="flex flex-col items-start gap-3 p-8">
          <h3 className="text-lg font-semibold">Connect your YouTube channel</h3>
          <p className="max-w-prose text-sm text-muted-foreground">
            {youtubeConfigured()
              ? "Head to Integrations and paste your channel link to start tracking subscribers and per-video performance."
              : "YouTube tracking isn’t configured on the server yet. Once an API key is set, connect your channel from Integrations."}
          </p>
          <Link
            href={`/${slug}/integrations`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            Go to Integrations
          </Link>
        </Card>
      );
    }

    const subs = latest(ytSnaps);
    const totalViews = ytContent.reduce((a, c) => a + c.views, 0);
    const totalLeads = ytContent.reduce((a, c) => a + c.leadsGained, 0);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {ytAccount.displayName ?? "Channel"}
            {ytAccount.lastSyncedAt
              ? ` · synced ${fmtDate(ytAccount.lastSyncedAt)}`
              : " · not synced yet"}
          </p>
          {canManage && <RefreshButton slug={slug} />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Scorecard label="Subscribers" value={commas(subs)} />
          <Scorecard label="Subscriber growth" value={signed(growth(ytSnaps))} hint="since first tracked" />
          <Scorecard label="Total views" value={commas(totalViews)} hint={`${ytContent.length} videos`} />
          <Scorecard label="Leads from videos" value={commas(totalLeads)} />
        </div>

        <FollowerTrend title="Subscribers over time" data={snapsToPoints(ytSnaps)} />

        <Card className="p-0">
          <ContentTable rows={ytContent} platform="youtube" canManage={canManage} slug={slug} />
        </Card>
      </div>
    );
  }

  function renderInstagram() {
    const followers = latest(igSnaps);
    const totalLeads = igContent.reduce((a, c) => a + c.leadsGained, 0);

    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Scorecard label="Followers" value={commas(followers)} />
          <Scorecard label="Follower growth" value={signed(growth(igSnaps))} hint="since first logged" />
          <Scorecard label="Posts tracked" value={commas(igContent.length)} />
          <Scorecard label="Leads from posts" value={commas(totalLeads)} />
        </div>

        <FollowerTrend title="Followers over time" data={snapsToPoints(igSnaps)} />

        {canManage && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-4 text-[15px] font-semibold">Log follower count</h3>
              <FollowerCountForm slug={slug} today={today} />
            </Card>
            <Card className="p-6">
              <h3 className="mb-4 text-[15px] font-semibold">Add a post</h3>
              <AddInstagramForm slug={slug} today={today} />
            </Card>
          </div>
        )}

        <Card className="p-0">
          <ContentTable rows={igContent} platform="instagram" canManage={canManage} slug={slug} />
        </Card>
      </div>
    );
  }
}

function ContentTable({
  rows,
  platform,
  canManage,
  slug,
}: {
  rows: SocialContentRow[];
  platform: "youtube" | "instagram";
  canManage: boolean;
  slug: string;
}) {
  const reachCol = platform === "instagram";
  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        {platform === "youtube"
          ? "No videos yet — hit Refresh to pull them from YouTube."
          : "No posts logged yet."}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{platform === "youtube" ? "Video" : "Post"}</TableHead>
          <TableHead>Published</TableHead>
          <TableHead className="text-right">{reachCol ? "Reach" : "Views"}</TableHead>
          <TableHead className="text-right">Likes</TableHead>
          <TableHead className="text-right">Comments</TableHead>
          <TableHead className="text-right">Leads gained</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="max-w-[280px]">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {r.title || "Untitled"}
                </a>
              ) : (
                <span className="font-medium">{r.title || "Untitled"}</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{fmtDate(r.publishedAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{commas(reachCol ? r.reach : r.views)}</TableCell>
            <TableCell className="text-right tabular-nums">{commas(r.likes)}</TableCell>
            <TableCell className="text-right tabular-nums">{commas(r.comments)}</TableCell>
            <TableCell className="text-right">
              <LeadsGainedCell slug={slug} contentId={r.id} value={r.leadsGained} editable={canManage} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
