import "server-only";
import { listAllEod, listAllUsers, listBottlenecksSince } from "@/lib/db/queries";

export type KpisSlice =
  | {
      status: "ok";
      date: string;
      setters: { name: string; callsBooked: number; showUps: number; closes: number; cash: number }[];
      topBottlenecks: { label: string; count: number }[];
    }
  | { status: "error"; reason: string };

/** Yesterday's per-setter KPIs + top-3 bottlenecks, summed from EOD submissions. */
export async function buildKpisSlice(yesterday: string): Promise<KpisSlice> {
  try {
    const [eods, users, bottlenecks] = await Promise.all([
      listAllEod(),
      listAllUsers(),
      listBottlenecksSince(yesterday),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const acc = new Map<string, { callsBooked: number; showUps: number; closes: number; cash: number }>();
    for (const e of eods) {
      if (e.submissionDate !== yesterday) continue;
      const cur = acc.get(e.setterUserId) ?? { callsBooked: 0, showUps: 0, closes: 0, cash: 0 };
      cur.callsBooked += e.callsBooked;
      cur.showUps += e.showUps;
      cur.closes += e.closes;
      cur.cash += Number(e.cashCollected);
      acc.set(e.setterUserId, cur);
    }
    const setters = [...acc.entries()].map(([id, v]) => ({ name: nameById.get(id) ?? "Unknown", ...v }));
    return { status: "ok", date: yesterday, setters, topBottlenecks: bottlenecks.slice(0, 3) };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}
