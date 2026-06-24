import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { getSession } from "@/lib/auth/session";
import {
  countMembersByRole,
  getClientBySlug,
  getCompletedModuleIds,
  getLatestKpi,
  listBookings,
  listGlobalModules,
  listIntegrations,
  listLeads,
  listRecaps,
  listSetterWeekKpis,
} from "@/lib/db/queries";
import type { ActionItem } from "@/lib/db/queries";
import { weekLabel, weekStartISO } from "@/lib/week";

function n(v: unknown, d = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}
function money(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type LampTone = "good" | "warn" | "bad";
const LAMP_COLOR: Record<LampTone, string> = {
  good: "var(--sage)",
  warn: "var(--honey)",
  bad: "var(--clay)",
};

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const session = await getSession();

  const [kpi, recaps, modules, bookings, leads, integrations, completedIds, reps, managers, setterRows] =
    await Promise.all([
      getLatestKpi(client.id),
      listRecaps(client.id),
      listGlobalModules(),
      listBookings(client.id),
      listLeads(client.id),
      listIntegrations(client.id),
      session ? getCompletedModuleIds(session.userId) : Promise.resolve(new Set<string>()),
      countMembersByRole(client.id, "sales_rep"),
      countMembersByRole(client.id, "manager"),
      listSetterWeekKpis(client.id, weekStartISO()),
    ]);
  // Agenda shows the person's name, not the event title.
  const personName = (b: (typeof bookings)[number]) =>
    b.inviteeName || leads.find((l) => l.id === b.leadId)?.name || b.callType || "Call";

  // Live weekly actuals summed from the team's EOD submissions (kpi_weekly only
  // stores targets; actuals are derived so the ledger actually fills up).
  const a: Record<string, number> = setterRows.reduce(
    (acc, r) => ({
      callsBooked: acc.callsBooked + r.callsBooked,
      showUps: acc.showUps + r.showUps,
      closes: acc.closes + r.closes,
      cash: acc.cash + r.cash,
    }),
    { callsBooked: 0, showUps: 0, closes: 0, cash: 0 },
  );
  const t = (kpi?.targets ?? {}) as Record<string, number>;
  const booked = n(a.callsBooked);
  const bookedTarget = n(t.callsBooked, 20);
  const weeklyPct = bookedTarget ? Math.round((booked / bookedTarget) * 100) : 0;
  const showUpRate = booked ? Math.round((n(a.showUps) / booked) * 100) : 0;
  const closes = n(a.closes);
  const cash = n(a.cash);
  const cashTarget = n(t.cash, 0);
  const avgDeal = closes ? Math.round(cash / closes) : 0;
  const onPace = weeklyPct >= 60;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  // Upcoming + attention bookings.
  const upcoming = bookings
    .filter((b) => b.status === "scheduled" && new Date(b.scheduledAt) >= now)
    .sort((x, y) => +new Date(x.scheduledAt) - +new Date(y.scheduledAt));
  const nextCall = upcoming[0] ?? null;
  const awaitingOutcome = bookings.filter(
    (b) => b.status === "scheduled" && new Date(b.scheduledAt) < now,
  );
  const noShowsThisWeek = bookings.filter(
    (b) => b.status === "no_show" && new Date(b.scheduledAt) >= weekAgo,
  ).length;

  // Action items across all recaps.
  const recapStats = recaps.map((r) => {
    const items = (r.actionItems ?? []) as ActionItem[];
    const done = items.filter((i) => i.done).length;
    return { recap: r, total: items.length, done, open: items.length - done };
  });
  const openActionItems = recapStats.reduce((s, r) => s + r.open, 0);
  const doneActionItems = recapStats.reduce((s, r) => s + r.done, 0);
  const totalActionItems = recapStats.reduce((s, r) => s + r.total, 0);
  const aiPct = totalActionItems ? Math.round((doneActionItems / totalActionItems) * 100) : 0;

  // Training (global catalog × this user's completion).
  const modulesDone = modules.filter((m) => completedIds.has(m.id)).length;

  const calendly = integrations.find((i) => i.provider === "calendly");
  const calendlyLive = calendly?.status === "connected";

  const latest = recaps[0];
  const latestItems = (latest?.actionItems ?? []) as ActionItem[];
  const latestDone = latestItems.filter((i) => i.done).length;
  const recapPct = latestItems.length ? Math.round((latestDone / latestItems.length) * 100) : 0;

  const stats = [
    { label: "Calls booked", value: String(booked), sub: `target ${bookedTarget}` },
    { label: "Show-up rate", value: `${showUpRate}%`, sub: `${n(a.showUps)} of ${booked} showed` },
    { label: "Closed", value: String(closes), sub: `${money(cash)} cash` },
    { label: "Avg deal", value: money(avgDeal), sub: `${closes} deals` },
  ];

  const lamps: { label: string; status: string; tone: LampTone }[] = [
    {
      label: "Calendly sync",
      status: calendlyLive ? "Live" : "Off",
      tone: calendlyLive ? "good" : "bad",
    },
    {
      label: "Show-up rate",
      status: showUpRate >= 70 ? "Healthy" : showUpRate >= 50 ? "Watch" : "Low",
      tone: showUpRate >= 70 ? "good" : showUpRate >= 50 ? "warn" : "bad",
    },
    {
      label: "Cash vs goal",
      status: cashTarget
        ? `${Math.round((cash / cashTarget) * 100)}%`
        : money(cash),
      tone: cashTarget && cash / cashTarget >= 0.8 ? "good" : cashTarget && cash / cashTarget >= 0.5 ? "warn" : "bad",
    },
    {
      label: "No-shows this week",
      status: String(noShowsThisWeek),
      tone: noShowsThisWeek === 0 ? "good" : noShowsThisWeek <= 2 ? "warn" : "bad",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b-2 border-ink pb-6">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>The {client.name} Briefing</span>
          <span>{weekLabel()}</span>
        </div>
        <h1 className="mt-4 text-5xl font-semibold">Welcome back, {client.name}.</h1>
        <p className="mt-2 max-w-xl font-serif text-lg text-[color:var(--ink)]/80">
          {onPace
            ? "You're on pace this week — here's where every number stands."
            : "Here's where your numbers stand this week."}
        </p>
      </header>

      {/* Mission control: needs you now + systems */}
      <Card className="grid gap-0 overflow-hidden p-0 md:grid-cols-2">
        <div className="border-b border-[color:var(--border)] p-6 md:border-b-0 md:border-r">
          <h3 className="eyebrow mb-4 block">Needs you now</h3>
          <div className="flex flex-col gap-3">
            {nextCall && (
              <NeedRow
                title={`${personName(nextCall)} — ${fmtTime(new Date(nextCall.scheduledAt))}`}
                sub={`Next call · ${fmtDay(new Date(nextCall.scheduledAt))}`}
                href={`/${slug}/calendar/${nextCall.id}`}
                cta="Open"
              />
            )}
            {awaitingOutcome.length > 0 && (
              <NeedRow
                title={`Log ${awaitingOutcome.length} call outcome${awaitingOutcome.length === 1 ? "" : "s"}`}
                sub="Calls ended · disposition pending"
                href={`/${slug}/calendar`}
                cta="Log"
              />
            )}
            {openActionItems > 0 && (
              <NeedRow
                title={`${openActionItems} action item${openActionItems === 1 ? "" : "s"} open`}
                sub="From your call recaps"
                href={`/${slug}/recaps`}
                cta="Open"
              />
            )}
            {!nextCall && awaitingOutcome.length === 0 && openActionItems === 0 && (
              <p className="text-sm text-muted-foreground">All caught up — nothing needs you right now.</p>
            )}
          </div>
        </div>
        <div className="p-6">
          <h3 className="eyebrow mb-4 block">Systems</h3>
          <div className="flex flex-col gap-3">
            {lamps.map((l) => (
              <div key={l.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: LAMP_COLOR[l.tone] }} />
                  {l.label}
                </span>
                <span className="text-sm font-medium" style={{ color: LAMP_COLOR[l.tone] }}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Ledger + weekly ring */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <div className="text-[13px] text-muted-foreground">{s.label}</div>
              <div className="num mt-3 font-serif text-[42px] font-semibold leading-none">{s.value}</div>
              <div className="mt-2 text-xs text-muted-foreground">{s.sub}</div>
            </Card>
          ))}
        </div>
        <Card className="flex flex-col items-center p-6 text-center">
          <div className="mb-1 flex w-full items-center justify-between">
            <h3 className="font-sans text-[15px] font-semibold">Weekly goal</h3>
            <span className={onPace ? "badge badge-good" : "badge badge-warn"}>
              {onPace ? "On pace" : "Behind"}
            </span>
          </div>
          <Ring pct={weeklyPct} label="of goal" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            {booked} of {bookedTarget} calls booked
          </p>
          <div className="mt-3 flex items-center gap-4">
            <Link href={`/${slug}/milestones`} className="text-sm font-medium text-accent hover:underline">
              Milestone tracker →
            </Link>
            <Link href={`/${slug}/statistics`} className="text-sm font-medium text-accent hover:underline">
              Statistics →
            </Link>
          </div>
        </Card>
      </div>

      {/* Agenda + action items + training */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6">
          <h3 className="mb-4 font-sans text-[15px] font-semibold">This week&apos;s agenda</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming calls scheduled.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.slice(0, 5).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between border-b border-[color:var(--line)] py-2.5 text-sm last:border-0"
                >
                  <Link href={`/${slug}/calendar/${b.id}`} className="font-medium hover:underline">
                    {personName(b)}
                  </Link>
                  <span className="text-muted-foreground">
                    {fmtDay(new Date(b.scheduledAt))} · {fmtTime(new Date(b.scheduledAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-sans text-[15px] font-semibold">Action items in flight</h3>
            <span className={openActionItems ? "badge badge-warn" : "badge badge-good"}>
              {openActionItems} open
            </span>
          </div>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#ece1cf]">
              <div className="h-full rounded-full bg-sage transition-[width] duration-700" style={{ width: `${aiPct}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-sage">
              {doneActionItems}/{totalActionItems}
            </span>
          </div>
          <ul className="flex flex-col">
            {recapStats.slice(0, 4).map((r) => (
              <li
                key={r.recap.id}
                className="flex items-center justify-between border-b border-[color:var(--line)] py-2 text-sm last:border-0"
              >
                <span className="truncate pr-2 text-muted-foreground">{r.recap.title}</span>
                <span className={r.open === 0 ? "font-medium text-sage" : "font-medium"}>
                  {r.done}/{r.total}
                </span>
              </li>
            ))}
          </ul>
          <Link href={`/${slug}/recaps`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
            Open all recaps →
          </Link>
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-sans text-[15px] font-semibold">Training progress</h3>
            <span className="badge badge-up">
              {modulesDone} of {modules.length}
            </span>
          </div>
          <ul className="flex flex-col">
            {modules.slice(0, 5).map((m) => {
              const done = completedIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between border-b border-[color:var(--line)] py-2 text-sm last:border-0"
                >
                  <Link href={`/${slug}/modules/${m.id}`} className="truncate pr-2 hover:underline">
                    {m.title}
                  </Link>
                  <span className={done ? "badge badge-good" : "badge badge-neutral"}>
                    {done ? "Done" : "Start"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href={`/${slug}/modules`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
            Open modules →
          </Link>
        </Card>
      </div>

      {/* Latest recap + team */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[15px] font-semibold">Latest recap</h3>
            <Link href={`/${slug}/recaps`} className="text-sm font-medium text-accent hover:underline">
              All recaps
            </Link>
          </div>
          {latest ? (
            <>
              <div className="font-serif text-xl font-semibold">{latest.title}</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {latest.callDate} · {latestDone} of {latestItems.length} action items done
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#ece1cf]">
                  <div className="h-full rounded-full bg-sage transition-[width] duration-700" style={{ width: `${recapPct}%` }} />
                </div>
                <span className="text-[13px] font-semibold text-sage">{recapPct}%</span>
              </div>
              <p className="mt-4 text-sm text-[color:var(--ink)]/75">{latest.tldr}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No recaps yet.</p>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="mb-4 font-sans text-[15px] font-semibold">Your team</h3>
          <div className="flex items-center justify-between border-b border-[color:var(--border)] py-2 text-sm">
            <span className="text-muted-foreground">Sales reps</span>
            <b>{reps}</b>
          </div>
          <div className="flex items-center justify-between border-b border-[color:var(--border)] py-2 text-sm">
            <span className="text-muted-foreground">Managers</span>
            <b>{managers}</b>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Modules published</span>
            <b>{modules.length}</b>
          </div>
        </Card>
      </div>
    </div>
  );
}

function NeedRow({
  title,
  sub,
  href,
  cta,
}: {
  title: string;
  sub: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--line)] p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      <Link
        href={href}
        className="inline-flex h-8 shrink-0 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}
