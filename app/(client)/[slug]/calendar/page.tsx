import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getClientBySlug, getUserById, listBookings, listLeads } from "@/lib/db/queries";

const STATUS: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: "badge-up", label: "Scheduled" },
  completed: { cls: "badge-good", label: "Completed" },
  no_show: { cls: "badge-bad", label: "No-show" },
  canceled: { cls: "badge-neutral", label: "Canceled" },
};

/** y/m/d (m: 1-12) for a date rendered in a specific IANA timezone. */
function ymdInTz(date: Date, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ym?: string }>;
}) {
  const { slug } = await params;
  const { ym } = await searchParams;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;
  const tz = user?.timezone || "America/New_York";

  const [bookings, leads] = await Promise.all([listBookings(client.id), listLeads(client.id)]);
  const leadName = (id: string | null) => leads.find((l) => l.id === id)?.name ?? null;
  const personName = (b: (typeof bookings)[number]) =>
    b.inviteeName || leadName(b.leadId) || b.callType || "Unknown";

  const now = new Date();
  const today = ymdInTz(now, tz);
  const [vy, vm] = (() => {
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      const [a, b] = ym.split("-").map(Number);
      return [a, b] as const;
    }
    return [today.y, today.m] as const;
  })();

  const daysInMonth = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = new Date(Date.UTC(vy, vm - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const ymOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const prevYm = vm === 1 ? ymOf(vy - 1, 12) : ymOf(vy, vm - 1);
  const nextYm = vm === 12 ? ymOf(vy + 1, 1) : ymOf(vy, vm + 1);
  const todayYm = ymOf(today.y, today.m);
  const isThisMonth = vy === today.y && vm === today.m;

  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const dayMonth = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
  const nowLabel = now.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });

  const eventsByDay = new Map<number, typeof bookings>();
  for (const b of bookings) {
    const k = ymdInTz(new Date(b.scheduledAt), tz);
    if (k.y === vy && k.m === vm) eventsByDay.set(k.d, [...(eventsByDay.get(k.d) ?? []), b]);
  }

  const upcoming = bookings.filter((b) => b.status === "scheduled");
  const past = bookings.filter((b) => b.status !== "scheduled");
  const noShows = bookings.filter((b) => b.status === "no_show").length;

  function Row({ items }: { items: typeof bookings }) {
    if (items.length === 0)
      return <p className="px-1 py-3 text-sm text-muted-foreground">Nothing here.</p>;
    return (
      <div className="divide-y divide-[color:var(--line)]">
        {items.map((b) => {
          const s = STATUS[b.status] ?? STATUS.scheduled;
          const out = b.outcome as { closed?: boolean; dealValue?: number } | null;
          return (
            <Link key={b.id} href={`/${slug}/calendar/${b.id}`} className="flex items-center gap-3 px-1 py-3.5 hover:bg-[#faf4ea]">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-espresso text-[11px] font-semibold text-cream">
                {personName(b).slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 font-medium">{personName(b)}</span>
              <span className="text-sm text-muted-foreground">{dayMonth(new Date(b.scheduledAt))} · {time(new Date(b.scheduledAt))}</span>
              <span className={`badge ${s.cls}`}>{s.label}</span>
              <span className="w-16 text-right text-sm text-muted-foreground">{out?.closed ? `$${(out.dealValue ?? 0).toLocaleString()}` : ""}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">NOVA · setter</p>
          <h1 className="mt-2 text-3xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your calls, synced from Calendly · your time now: {nowLabel} ({tz.split("/").pop()?.replace("_", " ")})
          </p>
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-0 p-0 sm:grid-cols-4">
        {[
          ["Scheduled", String(upcoming.length)],
          ["Completed", String(past.filter((b) => b.status === "completed").length)],
          ["No-shows", String(noShows)],
          ["Total leads", String(leads.length)],
        ].map(([l, v], i) => (
          <div key={l} className={`p-5 ${i ? "border-l border-[color:var(--border)]" : ""}`}>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="num mt-2 font-serif text-3xl font-semibold">{v}</div>
          </div>
        ))}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">{monthLabel}</h2>
        <div className="flex items-center gap-1.5">
          <Link href={`/${slug}/calendar?ym=${prevYm}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={`/${slug}/calendar?ym=${todayYm}`} className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium hover:bg-secondary ${isThisMonth ? "border-accent bg-accent text-white hover:opacity-90" : "border-border"}`}>
            Today
          </Link>
          <Link href={`/${slug}/calendar?ym=${nextYm}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-secondary" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
          {cells.map((day, i) => {
            const isToday = day !== null && isThisMonth && day === today.d;
            return (
              <div key={i} className={`min-h-[104px] border-l border-t border-[color:var(--line)] p-2 ${i % 7 === 0 ? "border-l-0" : ""} ${day === null ? "bg-[#faf5ec]" : ""} ${isToday ? "bg-[#fbf3e6]" : ""}`}>
                {day !== null && (
                  <>
                    <span className={`grid h-6 w-6 place-items-center rounded-md text-[13px] font-semibold ${isToday ? "bg-accent text-white" : ""}`}>{day}</span>
                    <div className="mt-1 flex flex-col gap-1">
                      {(eventsByDay.get(day) ?? []).map((b) => {
                        const cls =
                          b.status === "completed" ? "border-sage bg-[#e9eedc] text-sage"
                          : b.status === "no_show" ? "border-clay bg-[#f4e2d6] text-clay"
                          : "border-accent bg-[#f0e3cf] text-[color:var(--caramel-d)]";
                        return (
                          <Link key={b.id} href={`/${slug}/calendar/${b.id}`} className={`truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
                            {time(new Date(b.scheduledAt))} {personName(b).split(" ")[0]}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-3 block">Upcoming</p>
          <Card className="px-4 py-1"><Row items={upcoming} /></Card>
        </div>
        <div>
          <p className="eyebrow mb-3 block">Past</p>
          <Card className="px-4 py-1"><Row items={past} /></Card>
        </div>
      </div>
    </div>
  );
}
