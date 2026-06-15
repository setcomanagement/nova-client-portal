import { listAllBookings, listAllUsers } from "@/lib/db/queries";
import type { BookingOutcome } from "@/lib/db/schema";

function pct(num: number, den: number): string {
  return den ? `${Math.round((num / den) * 100)}%` : "—";
}

export default async function AdminFunnelPage() {
  const [bookings, users] = await Promise.all([listAllBookings(), listAllUsers()]);
  const setters = users.filter((u) => u.role === "sales_rep");

  const rows = setters
    .map((s) => {
      const mine = bookings.filter((b) => b.setterUserId === s.id);
      const booked = mine.length;
      const showed = mine.filter((b) => {
        const o = (b.outcome ?? null) as BookingOutcome | null;
        return b.status === "completed" || o?.showedUp === true;
      }).length;
      const closed = mine.filter(
        (b) => ((b.outcome ?? null) as BookingOutcome | null)?.closed === true,
      ).length;
      return { name: s.name, booked, showed, closed };
    })
    .filter((r) => r.booked > 0)
    .sort((a, b) => b.closed - a.closed || b.booked - a.booked);

  const total = rows.reduce(
    (acc, r) => ({
      booked: acc.booked + r.booked,
      showed: acc.showed + r.showed,
      closed: acc.closed + r.closed,
    }),
    { booked: 0, showed: 0, closed: 0 },
  );

  const ledger = [
    { l: "booked", v: String(total.booked) },
    { l: "showed", v: String(total.showed), sub: pct(total.showed, total.booked) + " show-up" },
    { l: "closed", v: String(total.closed), sub: pct(total.closed, total.showed) + " win" },
    { l: "setters", v: String(rows.length) },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
          nova / funnel
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Setter funnel</h1>
        <p className="mt-1 text-sm text-[#9c886a]">
          Booked → showed → closed across every client, by setter.
        </p>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#3a2a1c] bg-[#251910] font-mono sm:grid-cols-4">
        {ledger.map((s, i) => (
          <div key={s.l} className={`p-4 ${i ? "border-l border-[#3a2a1c]" : ""}`}>
            <div className="text-[10px] uppercase tracking-wide text-[#9c886a]">{s.l}</div>
            <div className="mt-1.5 text-2xl font-bold text-white">{s.v}</div>
            {s.sub && <div className="mt-0.5 text-[11px] text-[#9c886a]">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#3a2a1c]">
        <table className="w-full text-sm">
          <thead className="bg-[#1c130a] font-mono text-[11px] uppercase tracking-wide text-[#9c886a]">
            <tr>
              <th className="px-4 py-3 text-left">Setter</th>
              <th className="px-4 py-3 text-right">Booked</th>
              <th className="px-4 py-3 text-right">Showed</th>
              <th className="px-4 py-3 text-right">Show-up %</th>
              <th className="px-4 py-3 text-right">Closed</th>
              <th className="px-4 py-3 text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-[#3a2a1c] bg-[#251910]">
                <td colSpan={6} className="px-4 py-4 text-[#9c886a]">
                  No booking activity yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.name} className="border-t border-[#3a2a1c] bg-[#251910]">
                  <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{r.booked}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{r.showed}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#9c886a]">{pct(r.showed, r.booked)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{r.closed}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#8fb36a]">{pct(r.closed, r.showed)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
