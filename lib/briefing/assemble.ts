import "server-only";
import type { BriefingSections } from "@/lib/db/queries";
import { buildKpisSlice } from "./kpis";
import { yesterdayISO } from "./dates";

const NOT_CONNECTED = (reason: string) => ({ status: "not_connected" as const, reason });

/** Runs each module best-effort; a failing module never breaks the briefing. */
export async function assembleBriefing(): Promise<{
  date: string;
  sections: BriefingSections;
  status: "ok" | "partial";
}> {
  const date = yesterdayISO();
  const kpis = await buildKpisSlice(date);
  const sections: BriefingSections = {
    kpis,
    content: NOT_CONNECTED("Instagram/YouTube not connected (P2)"),
    audience: NOT_CONNECTED("Follower sources not connected (P2)"),
    calendar: NOT_CONNECTED("Google Calendar not connected (P2)"),
    actions: NOT_CONNECTED("Fathom not connected (P3)"),
  };
  const status: "ok" | "partial" = kpis.status !== "ok" ? "partial" : "ok";
  return { date, sections, status };
}
