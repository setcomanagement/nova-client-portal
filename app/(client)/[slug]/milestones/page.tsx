import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { requireSession } from "@/lib/auth/session";
import { getLatestKpi, listSetterWeekKpis, resolveClientAccess } from "@/lib/db/queries";
import { weekLabel, weekStartISO } from "@/lib/week";
import { SetMilestonesForm } from "./set-milestones-form";

function n(v: unknown, d = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

const BARS: { key: string; label: string; money?: boolean }[] = [
  { key: "callsBooked", label: "Calls booked" },
  { key: "showUps", label: "Show-ups" },
  { key: "closes", label: "Closes" },
  { key: "cash", label: "Cash collected", money: true },
];

export default async function MilestonesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const weekStart = weekStartISO();
  const [kpi, setterRows] = await Promise.all([
    getLatestKpi(client.id),
    listSetterWeekKpis(client.id, weekStart),
  ]);

  // Actuals are summed LIVE from this week's setter EODs — not from a stored
  // kpi_weekly.actuals (which nothing populates). Targets still come from kpi.
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
  const weeklyPct = n(t.callsBooked)
    ? Math.round((n(a.callsBooked) / n(t.callsBooked)) * 100)
    : 0;
  const canSet =
    session != null &&
    ["client", "manager", "admin", "super_admin"].includes(session.role);

  const fmt = (v: number, money?: boolean) =>
    money ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">NOVA · gamified</p>
        <h1 className="mt-2 text-3xl font-semibold">Milestone tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {weekLabel()} · KPI goals for the {client.name} sales team.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[15px] font-semibold">
              This week&apos;s targets
            </h3>
            <span className="text-xs text-muted-foreground">
              Resets Sunday 11:59pm
            </span>
          </div>
          <div className="flex flex-col gap-5">
            {BARS.map((b) => {
              const actual = n(a[b.key]);
              const target = n(t[b.key]);
              const pct = target ? Math.min(100, (actual / target) * 100) : 0;
              const tone =
                pct >= 80 ? "bg-sage" : pct >= 55 ? "bg-accent" : "bg-honey";
              return (
                <div key={b.key}>
                  <div className="mb-2 flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{b.label}</span>
                    <span className="text-muted-foreground">
                      <b className="text-foreground">{fmt(actual, b.money)}</b> /{" "}
                      {fmt(target, b.money)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#ede2cf]">
                    <div
                      className={`h-full rounded-full ${tone} transition-[width] duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="flex flex-col items-center p-6 text-center">
          <h3 className="mb-1 w-full text-left font-sans text-[15px] font-semibold">
            This week
          </h3>
          <Ring pct={weeklyPct} label="to goal" />
          <p className="mt-3 text-[13px] text-muted-foreground">
            {n(a.callsBooked)} of {n(t.callsBooked)} calls booked
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-sans text-[15px] font-semibold">
            By setter — this week
          </h3>
          <span className="text-xs text-muted-foreground">from daily EODs</span>
        </div>
        {setterRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No EODs logged this week yet. Each setter&apos;s numbers appear here as
            they submit their end-of-day.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[color:var(--border)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Setter</th>
                  <th className="py-2 px-3 text-right font-medium">Booked</th>
                  <th className="py-2 px-3 text-right font-medium">Show-ups</th>
                  <th className="py-2 px-3 text-right font-medium">Closes</th>
                  <th className="py-2 pl-3 text-right font-medium">Cash</th>
                </tr>
              </thead>
              <tbody>
                {setterRows.map((r) => (
                  <tr key={r.setterUserId} className="border-b border-[color:var(--line)] last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{r.setterName}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{r.callsBooked}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{r.showUps}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{r.closes}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{fmt(r.cash, true)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink font-semibold">
                  <td className="py-2.5 pr-3">Team total</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{n(a.callsBooked)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{n(a.showUps)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{n(a.closes)}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{fmt(n(a.cash), true)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {canSet && (
        <Card className="p-6">
          <h3 className="mb-4 font-sans text-[15px] font-semibold">
            Set this week&apos;s milestones
          </h3>
          <SetMilestonesForm slug={slug} targets={t} />
        </Card>
      )}
    </div>
  );
}
