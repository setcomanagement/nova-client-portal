/*
  nova-sentinel · report.mjs
  Posts a run summary / alert to a Discord webhook. Reads a JSON payload on
  stdin (a run-result from run.mjs, optionally augmented by the routine with
  `title` and `actions[]`). No-op (warns) if DISCORD_SENTINEL_WEBHOOK is unset,
  so a missing webhook never breaks the pipeline.

  Usage: node scripts/sentinel/run.mjs | node scripts/sentinel/report.mjs
*/
import fs from "node:fs";

const WEBHOOK = process.env.DISCORD_SENTINEL_WEBHOOK;
const raw = fs.readFileSync(0, "utf8").trim();
let r;
try { r = JSON.parse(raw); } catch { r = { ok: false, parseError: true, raw: raw.slice(0, 500) }; }

function summarize(res) {
  const lines = [];
  if (res.health) lines.push(`• Health: ${res.health.ok ? "✅ healthy" : "❌ FAILING"}${res.health.latestSha ? ` (${res.health.latestSha})` : ""}`);
  if (res.audit) lines.push(`• Audit: ${res.audit.ok ? "✅ clean" : `❌ ${res.audit.counts.high} high-severity`}`);
  if (res.stress) {
    if (res.stress.skipped) lines.push(`• Stress: ⏭️ skipped (${res.stress.reason || "light run"})`);
    else lines.push(`• Stress: ${res.stress.ok ? "✅ pass" : "❌ FAIL"} (${(res.stress.suites || []).map((s) => `${s.name} ${s.failed ? s.failed + " fail" : "ok"}`).join(", ")})`);
  }
  // High-signal detail
  const details = [];
  (res.audit?.findings || []).filter((f) => f.severity === "high").slice(0, 5).forEach((f) => details.push(`  ⚠︎ ${f.rule} · ${f.file}${f.line ? ":" + f.line : ""}`));
  (res.stress?.suites || []).flatMap((s) => (s.failures || []).map((x) => `  ✗ ${s.name}: ${x}`)).slice(0, 8).forEach((d) => details.push(d));
  (res.stress?.consoleErrors || []).slice(0, 3).forEach((e) => details.push(`  ✗ console: ${e}`));
  if (res.actions?.length) { details.push("Actions taken:"); res.actions.forEach((a) => details.push(`  → ${a}`)); }
  return { lines, details };
}

const { lines, details } = summarize(r);
const ok = r.ok === true;
const title = r.title || (ok ? "🟢 nova-sentinel — all healthy" : "🔴 nova-sentinel — needs attention");
const color = ok ? 0x3ba55d : 0xed4245;
const description = [lines.join("\n"), details.length ? "\n" + details.join("\n") : ""].join("").slice(0, 3900);

if (!WEBHOOK) {
  process.stderr.write("[report] DISCORD_SENTINEL_WEBHOOK unset — printing instead of posting:\n");
  process.stderr.write(`${title}\n${description}\n`);
  process.exit(0);
}

const res = await fetch(WEBHOOK, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ embeds: [{ title, description, color, timestamp: new Date().toISOString() }] }),
});
if (!res.ok) { process.stderr.write(`[report] Discord POST failed: ${res.status} ${await res.text()}\n`); process.exit(1); }
process.stderr.write("[report] posted to Discord\n");
