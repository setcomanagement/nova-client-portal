import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import {
  listClientDailyKpis,
  listClientEodEntries,
  listClientMembers,
  resolveClientAccess,
  type DailyKpi,
} from "@/lib/db/queries";
import { StatisticsCharts, type TrendPoint } from "./statistics-charts";
import { CommissionForm } from "./commission-form";
import { AddEntryForm } from "./add-entry-form";

/* ---- Range selector (drives the window for every metric on the page) ---- */
const RANGES = [
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "365", label: "12m", days: 365 },
  { key: "all", label: "All", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** YYYY-MM-DD for `days` ago in UTC (the EOD submission_date grain). */
function sinceISO(days: number | null): string {
  if (days == null) return "2000-01-01";
  const now = new Date();
  const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/* ---- Formatting ---- */
function commas(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}
function money(v: number): string {
  return `$${commas(v)}`;
}
function moneyK(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 2)}k` : `$${commas(v)}`;
}
function pct(num: number, den: number): string {
  return den ? `${((num / den) * 100).toFixed(num % den === 0 ? 0 : 2)}%` : "0%";
}
function avg(total: number, den: number): string {
  return den ? (total / den).toFixed(2) : "0";
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function StatisticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const { range: rangeParam } = await searchParams;
  const session = await requireSession();
  const client = await resolveClientAccess({
    slug,
    role: session.role,
    clientId: session.clientId,
  });
  if (!client) notFound();

  const range: RangeKey =
    (RANGES.find((r) => r.key === rangeParam)?.key as RangeKey) ?? "90";
  const days = RANGES.find((r) => r.key === range)!.days;

  // Segregation: a sales rep sees ONLY their own numbers; client/manager/ops
  // see every setter's numbers combined.
  const isRep = session.role === "sales_rep";
  const canManage = ["client", "manager", "admin", "super_admin"].includes(
    session.role,
  );
  const scopedSetter = isRep ? session.userId : undefined;

  const [daily, entries, members] = await Promise.all([
    listClientDailyKpis(client.id, sinceISO(days), scopedSetter),
    listClientEodEntries(client.id, sinceISO(days), scopedSetter),
    canManage ? listClientMembers(client.id) : Promise.resolve([]),
  ]);

  // Window totals, summed across every day in range.
  const z: Omit<DailyKpi, "date"> = {
    submissions: 0, outbound: 0, inbound: 0, followUps: 0, totalConvos: 0,
    callsPitched: 0, callsBooked: 0, qualifiedBooked: 0, showUps: 0, closes: 0,
    cashCollected: 0,
  };
  const sum = daily.reduce(
    (acc, d) => ({
      submissions: acc.submissions + d.submissions,
      outbound: acc.outbound + d.outbound,
      inbound: acc.inbound + d.inbound,
      followUps: acc.followUps + d.followUps,
      totalConvos: acc.totalConvos + d.totalConvos,
      callsPitched: acc.callsPitched + d.callsPitched,
      callsBooked: acc.callsBooked + d.callsBooked,
      qualifiedBooked: acc.qualifiedBooked + d.qualifiedBooked,
      showUps: acc.showUps + d.showUps,
      closes: acc.closes + d.closes,
      cashCollected: acc.cashCollected + d.cashCollected,
    }),
    { ...z },
  );
  const activeDays = daily.length;
  const commissionRate = Number(client.commissionPct) || 0; // fraction, e.g. 0.05
  const commission = sum.cashCollected * commissionRate;

  // KPI scorecards (mirror the Looker report's top grid).
  const scorecards: { label: string; value: string }[] = [
    { label: "Calls Booked", value: commas(sum.callsBooked) },
    { label: "Calls Pitched", value: commas(sum.callsPitched) },
    { label: "Conversations Had", value: commas(sum.totalConvos) },
    { label: "Pitch → Book", value: pct(sum.callsBooked, sum.callsPitched) },
    { label: "Avg # of Outreach", value: avg(sum.outbound, sum.submissions) },
    { label: "Calls Had", value: commas(sum.showUps) },
    { label: "SUM of Calls Booked", value: commas(sum.callsBooked) },
    { label: "Commission", value: moneyK(commission) },
    { label: "Convo → Booked Call", value: pct(sum.callsBooked, sum.totalConvos) },
    { label: "Avg # of Follow-ups", value: avg(sum.followUps, sum.submissions) },
  ];

  // Aggregate statistics (bottom grid).
  const aggregates: { label: string; value: string }[] = [
    { label: "Show-Up Rate", value: pct(sum.showUps, sum.callsBooked) },
    { label: "Cash Collected", value: money(sum.cashCollected) },
    { label: "AOV", value: money(sum.closes ? sum.cashCollected / sum.closes : 0) },
    { label: "Close Rate", value: pct(sum.closes, sum.showUps) },
    { label: "Average Daily Conversations", value: avg(sum.totalConvos, activeDays) },
    { label: "Total Commissions", value: money(commission) },
  ];

  // Funnel: each stage with its conversion off the previous stage.
  const funnel = [
    { label: "Conversations Had", value: sum.totalConvos, conv: null as string | null },
    { label: "Calls Booked", value: sum.callsBooked, conv: pct(sum.callsBooked, sum.totalConvos) },
    { label: "Showed Up", value: sum.showUps, conv: pct(sum.showUps, sum.callsBooked) },
    { label: "Closed", value: sum.closes, conv: pct(sum.closes, sum.showUps) },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  // Per-day series for the trend charts.
  const trend: TrendPoint[] = daily.map((d) => ({
    date: d.date,
    convos: d.totalConvos,
    booked: d.callsBooked,
    pitchToBook: d.callsPitched ? Math.round((d.callsBooked / d.callsPitched) * 100) : 0,
    convoToBook: d.totalConvos ? Math.round((d.callsBooked / d.totalConvos) * 100) : 0,
  }));

  const hasData = activeDays > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-6">
        <div>
          <p className="eyebrow">NOVA · analytics</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {isRep ? "Your statistics" : `${client.name} statistics`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRep
              ? "Your own performance, trends and conversion — from your daily EODs."
              : "Combined setter performance, trends and conversion — from daily EOD submissions."}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/${slug}/statistics?range=${r.key}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                r.key === range
                  ? "bg-accent text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      {!hasData && (
        <Card className="p-6 text-sm text-muted-foreground">
          No EOD data in this range yet. As setters submit their end-of-day, these
          numbers, trends and the funnel below fill in automatically.
        </Card>
      )}

      {/* KPI scorecards */}
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {scorecards.map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
              <div className="num mt-2 font-serif text-3xl font-semibold leading-none">
                {s.value}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Progressive Data */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[color:var(--border)]" />
          <h2 className="font-serif text-2xl font-semibold">Progressive Data</h2>
          <span className="h-px flex-1 bg-[color:var(--border)]" />
        </div>
        <StatisticsCharts data={trend} />
      </section>

      {/* Lead funnel */}
      <section>
        <Card className="p-6">
          <h3 className="mb-5 font-sans text-[15px] font-semibold">Conversion funnel</h3>
          <div className="flex flex-col gap-4">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{f.label}</span>
                  <span className="text-muted-foreground">
                    <b className="text-foreground tabular-nums">{commas(f.value)}</b>
                    {f.conv != null && (
                      <span className="ml-2 text-xs">({f.conv} of prev.)</span>
                    )}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#ede2cf]">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-700"
                    style={{ width: `${(f.value / funnelMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Aggregate Statistics */}
      <section className="flex flex-col gap-5">
        <h2 className="font-serif text-2xl font-semibold">
          <span className="text-accent">{client.name}&apos;s</span> Aggregate Statistics
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {aggregates.map((s) => (
            <Card key={s.label} className="p-6 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
              <div className="num mt-3 font-serif text-4xl font-semibold leading-none">
                {s.value}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Every individual EOD entry in range */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold">
            {isRep ? "Your entries" : "Every entry"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} in range
          </span>
        </div>
        <Card className="overflow-hidden p-0">
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No EOD submissions in this range yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!isRep && <TableHead>Setter</TableHead>}
                  <TableHead className="text-right">Convos</TableHead>
                  <TableHead className="text-right">Pitched</TableHead>
                  <TableHead className="text-right">Booked</TableHead>
                  <TableHead className="text-right">Showed</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {fmtDate(e.date)}
                    </TableCell>
                    {!isRep && <TableCell>{e.setterName}</TableCell>}
                    <TableCell className="text-right tabular-nums">{commas(e.totalConvos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{commas(e.callsPitched)}</TableCell>
                    <TableCell className="text-right tabular-nums">{commas(e.callsBooked)}</TableCell>
                    <TableCell className="text-right tabular-nums">{commas(e.showUps)}</TableCell>
                    <TableCell className="text-right tabular-nums">{commas(e.closes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(e.cashCollected)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>

      {/* Add to statistics (managerial) */}
      {canManage && (
        <Card className="p-6">
          <h3 className="mb-1 font-sans text-[15px] font-semibold">Add to statistics</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Log numbers for a team member. This feeds the combined view above and
            that member&apos;s own segregated stats.
          </p>
          <AddEntryForm
            slug={slug}
            members={members.map((m) => ({ id: m.id, name: m.name }))}
            today={new Date().toISOString().slice(0, 10)}
          />
        </Card>
      )}

      {/* Commission settings */}
      {canManage && (
        <Card className="p-6">
          <h3 className="mb-1 font-sans text-[15px] font-semibold">Commission rate</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            What {client.name} pays the appointment setter, as a percentage of cash
            collected. Drives the Commission and Total Commissions figures above.
          </p>
          <CommissionForm slug={slug} pct={Number((commissionRate * 100).toFixed(2))} />
        </Card>
      )}
    </div>
  );
}
