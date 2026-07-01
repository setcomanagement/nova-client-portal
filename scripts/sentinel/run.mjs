/*
  nova-sentinel · run.mjs  — orchestrator
  Runs health + audit + (unless --light) stress, aggregates into one run-result
  JSON on stdout. Exit 0 iff everything is ok. The daily routine parses this to
  decide whether to autofix; on-demand you can pipe it to report.mjs.

  Usage:
    node scripts/sentinel/run.mjs            # full sweep (health + audit + stress)
    node scripts/sentinel/run.mjs --light    # health + audit only (no build/Playwright)
    node scripts/sentinel/run.mjs --report   # also post the raw result to Discord
    node scripts/sentinel/run.mjs --no-build  # stress without rebuilding
*/
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const LIGHT = args.includes("--light");
const REPORT = args.includes("--report");
const NO_BUILD = args.includes("--no-build");

function runJson(cmd, cmdArgs) {
  const p = spawnSync(cmd, cmdArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  // scripts print JSON to stdout even on non-zero exit; parse the last JSON blob.
  const out = (p.stdout || "").trim();
  try { return JSON.parse(out); } catch {
    return { ok: false, parseError: true, exitCode: p.status, stderr: (p.stderr || "").slice(-500) };
  }
}

const result = { module: "run", ts: new Date().toISOString(), ok: false };
result.health = runJson("node", ["scripts/sentinel/health.mjs"]);
result.audit = runJson("node", ["scripts/sentinel/audit.mjs"]);
if (LIGHT) {
  result.stress = { ok: true, skipped: true, reason: "light run" };
} else {
  result.stress = runJson("node", ["scripts/sentinel/stress.mjs", ...(NO_BUILD ? ["--no-build"] : [])]);
}

result.ok = Boolean(result.health.ok && result.audit.ok && result.stress.ok);
console.log(JSON.stringify(result));

if (REPORT) {
  spawnSync("node", ["scripts/sentinel/report.mjs"], { input: JSON.stringify(result), stdio: ["pipe", "inherit", "inherit"] });
}
process.exit(result.ok ? 0 : 1);
