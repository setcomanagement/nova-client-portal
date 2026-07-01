import { listAllEod, listAllUsers, listFeedback } from "@/lib/db/queries";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#e6e3dd] bg-[#ffffff] ${className}`}>{children}</div>
  );
}
function pct(num: number, den: number): number {
  return den ? Math.round((num / den) * 100) : 0;
}
function Bar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? "bg-[#8fb36a]" : value >= 55 ? "bg-caramel" : "bg-[#d6a94e]";
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-[#2f2f33]">{label}</span>
        <span className="text-[#2f2f33]">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#e6e3dd]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ago(d: Date): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export default async function InsightsPage() {
  const [users, eods, feedback] = await Promise.all([
    listAllUsers(),
    listAllEod(),
    listFeedback(),
  ]);
  const setters = users.filter((u) => u.role === "sales_rep");
  const latest = eods[0]?.submissionDate ?? null;
  const week = latest
    ? eods.filter(
        (e) => new Date(e.submissionDate) >= new Date(new Date(latest).getTime() - 6 * 864e5),
      )
    : [];
  const activeSetters = new Set(week.map((e) => e.setterUserId)).size;
  const total = eods.length || 1;
  const objectionCaptured = pct(eods.filter((e) => e.topObjection).length, total);
  const reflectionFilled = pct(eods.filter((e) => e.wentWell).length, total);
  const accuracy = pct(eods.filter((e) => e.accuracyConfirmed).length, total);
  const eodCompletion = pct(week.length, Math.max(1, setters.length * 5));
  const perfVals = eods.filter((e) => e.performanceRating);
  const avgPerf = perfVals.length
    ? (perfVals.reduce((s, e) => s + (e.performanceRating ?? 0), 0) / perfVals.length).toFixed(1)
    : "—";

  const strip = [
    { l: "active setters (wk)", v: `${activeSetters}/${setters.length}` },
    { l: "eods this week", v: String(week.length) },
    { l: "eod completion", v: `${eodCompletion}%` },
    { l: "avg performance", v: avgPerf },
    { l: "objection capture", v: `${objectionCaptured}%` },
    { l: "feedback", v: `${feedback.length} new` },
  ];

  // Derived improvement signals
  const lowLoggers = setters.filter(
    (s) => week.filter((e) => e.setterUserId === s.id).length < 5,
  ).length;
  const signals: { tone: "r" | "a" | "g"; text: string }[] = [];
  if (100 - objectionCaptured > 25)
    signals.push({ tone: "a", text: `Objection field blank on ${100 - objectionCaptured}% of EODs — make it a quick-pick.` });
  if (lowLoggers > 0)
    signals.push({ tone: "a", text: `${lowLoggers} of ${setters.length} setters logged fewer than 5 EODs this week.` });
  if (Number(avgPerf) >= 7)
    signals.push({ tone: "g", text: `Average self-rated performance is ${avgPerf}/10 — healthy.` });
  if (eodCompletion < 80)
    signals.push({ tone: "r", text: `EOD completion is ${eodCompletion}% — below the 80% target.` });
  if (signals.length === 0)
    signals.push({ tone: "g", text: "No issues flagged this week." });
  const lampCls = { r: "bg-[#d6764e]", a: "bg-[#d6a94e]", g: "bg-[#8fb36a]" };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-caramel">nova / insights</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Usage &amp; insights</h1>
        <p className="mt-1 text-sm text-[#6b6b70]">How the portal is used — and what to improve next.</p>
      </div>

      <Panel className="grid grid-cols-2 overflow-hidden sm:grid-cols-6">
        {strip.map((s, i) => (
          <div key={s.l} className={`p-4 ${i ? "border-l border-[#e6e3dd]" : ""}`}>
            <div className="text-[10px] uppercase tracking-wide text-[#6b6b70]">{s.l}</div>
            <div className="mt-1.5 text-2xl font-bold text-ink">{s.v}</div>
          </div>
        ))}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Panel className="p-5">
            <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-caramel">
              EOD quality · all submissions
            </p>
            <Bar label="EOD completion (this week)" value={eodCompletion} />
            <Bar label="Objection captured" value={objectionCaptured} />
            <Bar label="Reflection filled in" value={reflectionFilled} />
            <Bar label="Accuracy confirmed" value={accuracy} />
          </Panel>
          <Panel className="p-5">
            <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-caramel">
              improvement signals · auto-flagged
            </p>
            <div className="flex flex-col">
              {signals.map((s, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-[#e6e3dd] py-3 text-sm text-[#2f2f33] last:border-0">
                  <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${lampCls[s.tone]}`} />
                  {s.text}
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel className="h-fit p-5">
          <p className="mb-4 text-[11px] uppercase tracking-[0.14em] text-caramel">
            feedback inbox
          </p>
          <div className="flex flex-col gap-4">
            {feedback.length === 0 ? (
              <p className="text-sm text-[#6b6b70]">No feedback yet.</p>
            ) : (
              feedback.map((f) => (
                <div key={f.id} className="text-sm">
                  <b className="text-[#2f2f33]">&ldquo;{f.message}&rdquo;</b>
                  <div className="mt-0.5 text-xs text-[#6b6b70]">
                    {f.userName} · {ago(f.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
