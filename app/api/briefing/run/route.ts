import { NextResponse, type NextRequest } from "next/server";
import { assembleBriefing } from "@/lib/briefing/assemble";
import { upsertDailyBriefing } from "@/lib/db/queries";
import { postBriefingDigest } from "@/lib/briefing/report";

/**
 * Assembles the daily morning briefing, upserts it, and pushes a Discord digest.
 * Triggered by Vercel Cron (x-vercel-cron header) or a manual bearer token.
 * `?dry=1` returns the assembled JSON without writing or pushing.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = req.headers.get("x-vercel-cron") != null;
  if (!isCron && token !== process.env.BRIEFING_RUN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const { date, sections, status } = await assembleBriefing();
  if (dry) return NextResponse.json({ date, sections, status, dry: true });
  await upsertDailyBriefing(date, sections, status);
  await postBriefingDigest({ date, sections, status });
  return NextResponse.json({ date, status, ok: true });
}
