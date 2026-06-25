import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Ring } from "@/components/ui/ring";
import { buttonVariants } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getUserById, listEodForUser, resolveClientAccess } from "@/lib/db/queries";

function money(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`;
}
function rate(num: number, den: number): number {
  return den ? Math.round((num / den) * 100) : 0;
}

export default async function RepHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ logged?: string }>;
}) {
  const { slug } = await params;
  const { logged } = await searchParams;
  const session = await requireSession();
  const client = await resolveClientAccess({ slug, role: session.role, clientId: session.clientId });
  if (!client) notFound();
  const user = await getUserById(session.userId);
  const rows = await listEodForUser(session.userId);

  // "This week" = within 6 days of the most recent EOD; "month" = same year-month.
  const latest = rows[0]?.submissionDate ?? null;
  const inWeek = (d: string) =>
    latest ? new Date(d) >= new Date(new Date(latest).getTime() - 6 * 864e5) : false;
  const week = rows.filter((r) => inWeek(r.submissionDate));
  const month = latest
    ? rows.filter((r) => r.submissionDate.slice(0, 7) === latest.slice(0, 7))
    : [];
  const sum = (arr: typeof rows, f: (r: (typeof rows)[number]) => number) =>
    arr.reduce((s, r) => s + f(r), 0);

  const booked = sum(week, (r) => r.callsBooked);
  const pitched = sum(week, (r) => r.callsPitched);
  const convos = sum(week, (r) => r.totalConvos);
  const qualified = sum(week, (r) => r.qualifiedBooked);
  const cashWeek = sum(week, (r) => Number(r.cashCollected) || 0);
  const today = rows[0];
  const days = week.length || 1;

  const rings = [
    { pct: rate(booked, convos), label: "convos → booked", tone: "caramel" as const, sub: `${booked} booked from ${convos} convos` },
    { pct: rate(booked, pitched), label: "pitch → book", tone: "sage" as const, sub: `${booked} of ${pitched} pitched` },
    { pct: rate(qualified, booked), label: "qualified", tone: "caramel" as const, sub: `${qualified} of ${booked} booked` },
  ];
  const ledgerA = [
    { l: "Daily outbounds", v: String(today?.outbound ?? 0), s: "latest day" },
    { l: "Daily follow-ups", v: String(today?.followUps ?? 0), s: "latest day" },
    { l: "Avg calls booked / day", v: (booked / days).toFixed(1), s: "this week" },
    { l: "Conversations", v: String(convos), s: "this week" },
  ];
  const ledgerB = [
    { l: "Calls booked · week", v: String(booked), s: `${week.length} EODs logged` },
    { l: "Calls booked · month", v: String(sum(month, (r) => r.callsBooked)), s: `${month.length} days` },
    { l: "Qualified booked", v: String(qualified), s: "this week" },
    { l: "Cash · week", v: money(cashWeek), s: "from your sets" },
  ];

  return (
    <div className="flex flex-col gap-7">
      {logged && (
        <div className="rounded-xl border border-[#ecd9ad] px-4 py-3 text-sm text-[#6d4f17]" style={{ background: "var(--honey-bg)" }}>
          EOD logged — nice work. Your board is updated below.
        </div>
      )}
      <div className="border-b-2 border-ink pb-6">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>{user?.name ?? "Setter"} · Setter</span>
          <span>This week</span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold">Your sales board.</h1>
        <p className="mt-2 font-serif text-lg text-[color:var(--ink)]/80">
          Where your numbers stand — and what's left to log before you clock off.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {rings.map((r) => (
          <Card key={r.label} className="flex flex-col items-center p-6 text-center">
            <Ring pct={r.pct} label={r.label} tone={r.tone} size={130} />
            <p className="mt-2 text-[13px] text-muted-foreground">{r.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="grid grid-cols-2 gap-0 p-0 sm:grid-cols-4">
        {ledgerA.map((s, i) => (
          <div key={s.l} className={`p-5 ${i ? "border-l border-[color:var(--border)]" : ""}`}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
            <div className="num mt-2 font-serif text-3xl font-semibold">{s.v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.s}</div>
          </div>
        ))}
      </Card>
      <Card className="grid grid-cols-2 gap-0 p-0 sm:grid-cols-4">
        {ledgerB.map((s, i) => (
          <div key={s.l} className={`p-5 ${i ? "border-l border-[color:var(--border)]" : ""}`}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</div>
            <div className="num mt-2 font-serif text-3xl font-semibold">{s.v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.s}</div>
          </div>
        ))}
      </Card>

      <Card className="flex items-center justify-between gap-4 p-6">
        <div>
          <h3 className="font-sans text-[15px] font-semibold">Log today&apos;s EOD</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Two minutes · keeps your streak alive and feeds your manager&apos;s review.
          </p>
        </div>
        <Link href={`/${slug}/eod`} className={buttonVariants({ variant: "accent" })}>
          Open EOD form
        </Link>
      </Card>
    </div>
  );
}
