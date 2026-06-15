import Link from "next/link";
import {
  getActiveAnnouncement,
  listAllEod,
  listAllUsers,
  listClients,
} from "@/lib/db/queries";
import { AnnouncementComposer } from "./announcement-composer";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#3a2a1c] bg-[#251910] ${className}`}>
      {children}
    </div>
  );
}

export default async function AdminOverview() {
  const [clients, users, eods, announcement] = await Promise.all([
    listClients(),
    listAllUsers(),
    listAllEod(),
    getActiveAnnouncement(),
  ]);

  const setters = users.filter((u) => u.role === "sales_rep");
  const managers = users.filter((u) => u.role === "manager");
  const latest = eods[0]?.submissionDate ?? null;
  const weekEods = latest
    ? eods.filter(
        (e) => new Date(e.submissionDate) >= new Date(new Date(latest).getTime() - 6 * 864e5),
      )
    : [];
  const avgPerf =
    eods.length && eods.some((e) => e.performanceRating)
      ? (
          eods.reduce((s, e) => s + (e.performanceRating ?? 0), 0) /
          eods.filter((e) => e.performanceRating).length
        ).toFixed(1)
      : "—";

  const strip = [
    { l: "client orgs", v: String(clients.length) },
    { l: "setters", v: String(setters.length) },
    { l: "managers", v: String(managers.length) },
    { l: "eods logged", v: String(eods.length) },
    { l: "eods this week", v: String(weekEods.length) },
    { l: "avg performance", v: avgPerf },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
            nova / operator
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Mission control</h1>
          <p className="mt-1 text-sm text-[#9c886a]">
            {clients.length} client orgs · {setters.length} setters · live.
          </p>
        </div>
        <Link
          href="/admin/clients"
          className="inline-flex h-10 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30]"
        >
          Manage clients
        </Link>
      </div>

      {/* mono status strip */}
      <Panel className="grid grid-cols-2 overflow-hidden font-mono sm:grid-cols-6">
        {strip.map((s, i) => (
          <div key={s.l} className={`p-4 ${i ? "border-l border-[#3a2a1c]" : ""}`}>
            <div className="text-[10px] uppercase tracking-wide text-[#9c886a]">{s.l}</div>
            <div className="mt-1.5 text-2xl font-bold text-white">{s.v}</div>
          </div>
        ))}
      </Panel>

      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
          announcement · live on client &amp; setter pages
        </p>
        <Panel className="p-5">
          <AnnouncementComposer current={announcement?.message ?? null} />
        </Panel>
      </div>

      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
          clients · click a card to open that dashboard
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const members = users.filter((u) => u.clientId === c.id);
            const reps = members.filter((u) => u.role === "sales_rep").length;
            const connected = members.length > 0;
            return (
              <Link key={c.id} href={`/${c.slug}/dashboard`}>
                <Panel className="p-5 transition hover:border-caramel">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-caramel text-xs font-semibold text-white">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <b className="text-white">{c.name}</b>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 font-mono text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-[#9c886a]">members</span>
                      <span className="text-white">{members.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9c886a]">setters</span>
                      <span className="text-white">{reps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9c886a]">status</span>
                      <span className={connected ? "text-[#8fb36a]" : "text-[#9c886a]"}>
                        {connected ? "active" : "no members"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 font-mono text-xs text-caramel">open dashboard →</div>
                </Panel>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
