import "server-only";
import type { BriefingSections } from "@/lib/db/queries";

/** Post the morning digest to Discord. No-op if DISCORD_BRIEFING_WEBHOOK is unset. */
export async function postBriefingDigest(r: {
  date: string;
  sections: BriefingSections;
  status: string;
}): Promise<void> {
  const webhook = process.env.DISCORD_BRIEFING_WEBHOOK;
  if (!webhook) return;
  const k = r.sections.kpis as
    | { status: string; setters?: unknown[]; topBottlenecks?: { label: string; count: number }[] }
    | undefined;
  const lines: string[] = [];
  if (k?.status === "ok") {
    lines.push(`• Setters logged: ${k.setters?.length ?? 0}`);
    const bn = (k.topBottlenecks ?? []).map((b) => `${b.label} (${b.count})`).join(", ");
    lines.push(`• Top bottlenecks: ${bn || "none"}`);
  } else {
    lines.push(`• KPIs: ${k?.status ?? "unavailable"}`);
  }
  lines.push("• Content / Audience / Calendar / Actions: not connected yet");
  const body = {
    embeds: [
      {
        title: `☀️ Morning briefing — ${r.date}`,
        description: lines.join("\n"),
        color: r.status === "ok" ? 0x3ba55d : 0xe0a53b,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
