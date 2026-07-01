import { requireSuperAdmin } from "@/lib/auth/session";
import { getLatestBriefing } from "@/lib/db/queries";
import { Card } from "@/components/ui/card";

type KpisSlice = {
  status: string;
  setters?: { name: string; callsBooked: number; showUps: number; closes: number; cash: number }[];
  topBottlenecks?: { label: string; count: number }[];
};

export default async function CommandCenter() {
  await requireSuperAdmin();
  const briefing = await getLatestBriefing();
  const sections = (briefing?.sections ?? {}) as Record<string, ({ status?: string; reason?: string } & Record<string, unknown>) | undefined>;
  const kpis = sections.kpis as KpisSlice | undefined;

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow">NOVA · command center</p>
        <h1 className="mt-2 text-4xl font-semibold">Morning briefing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {briefing ? briefing.briefingDate : "No briefing yet — runs each morning."}
        </p>
      </header>

      <Card className="p-6">
        <h3 className="mb-4 font-sans text-[15px] font-semibold">Yesterday — setters</h3>
        {kpis?.status === "ok" ? (
          <>
            {(kpis.setters ?? []).length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {(kpis.setters ?? []).map((s) => (
                  <li
                    key={s.name}
                    className="flex justify-between border-b border-[color:var(--line)] py-1.5 last:border-0"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.callsBooked} booked · {s.showUps} showed · {s.closes} closed · ${s.cash.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No setter EODs for yesterday.</p>
            )}
            <div className="mt-4">
              <span className="eyebrow">Top bottlenecks</span>
              <div className="mt-1 text-sm">
                {(kpis.topBottlenecks ?? []).map((b) => `${b.label} (${b.count})`).join(" · ") || "none"}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No setter KPIs available.</p>
        )}
      </Card>

      {(["content", "audience", "calendar", "actions"] as const).map((key) => (
        <Card key={key} className="p-6 opacity-70">
          <h3 className="font-sans text-[15px] font-semibold capitalize">{key}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {sections[key]?.reason ?? "Not connected yet."}
          </p>
        </Card>
      ))}
    </div>
  );
}
