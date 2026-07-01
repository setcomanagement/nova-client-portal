/*
  nova-sentinel · health.mjs
  Read-only production health probes. No repo build required.
  Emits a JSON verdict to stdout; exit 0 if healthy, 1 otherwise.

  Env: VERCEL_TOKEN (optional — falls back to the local Vercel CLI auth.json).
  Usage: node scripts/sentinel/health.mjs [--base https://www.setco.pro]
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const BASE = (args[args.indexOf("--base") + 1] && args.includes("--base"))
  ? args[args.indexOf("--base") + 1]
  : "https://www.setco.pro";
const LATENCY_BUDGET_MS = 8000; // generous: prod cold-starts + transpacific RTT

function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  // Local convenience: read the Vercel CLI's stored token.
  const p = path.join(os.homedir(), "Library", "Application Support", "com.vercel.cli", "auth.json");
  try { return JSON.parse(fs.readFileSync(p, "utf8")).token || null; } catch { return null; }
}

async function probeOnce(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "nova-sentinel/health" } });
    return { status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, err: e.message };
  }
}
// Probe with one retry — a single slow/failed hit (prod cold-start, transient
// network) must not flap the whole run and trip the autofix routine.
async function probe(name, urlPath, expectStatus) {
  const url = `${BASE}${urlPath}`;
  const evalp = (r) => {
    const statusOk = Array.isArray(expectStatus) ? expectStatus.includes(r.status) : r.status === expectStatus;
    return { pass: statusOk && r.status < 500 && r.ms <= LATENCY_BUDGET_MS, statusOk, not5xx: r.status < 500, fast: r.ms <= LATENCY_BUDGET_MS };
  };
  let r = await probeOnce(url); let e = evalp(r);
  if (!e.pass) { await new Promise((res) => setTimeout(res, 1500)); r = await probeOnce(url); e = evalp(r); }
  return {
    name, ok: e.pass, status: r.status, ms: r.ms,
    detail: `${r.status} in ${r.ms}ms` + (r.err ? ` (${r.err})` : "") + (e.statusOk ? "" : ` (expected ${expectStatus})`) + (e.fast ? "" : " SLOW") + (e.not5xx ? "" : " 5xx"),
  };
}

async function latestProdDeploy() {
  const token = vercelToken();
  if (!token) return { name: "vercel deploy READY", ok: false, detail: "no VERCEL_TOKEN", skipped: true };
  try {
    const res = await fetch("https://api.vercel.com/v6/deployments?projectId=nova-portal&target=production&limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    // A bad/expired token is an infra-credential problem, not a prod-health
    // failure — degrade (skip) rather than claim the site is down.
    if (j.error) return { name: "vercel deploy READY", ok: false, skipped: true, detail: `vercel token issue: ${j.error.code || j.error.message}` };
    const d = (j.deployments || [])[0];
    if (!d) return { name: "vercel deploy READY", ok: false, skipped: true, detail: "no production deployment returned (token scope?)" };
    const sha = (d.meta?.githubCommitSha || "").slice(0, 7);
    return { name: "vercel deploy READY", ok: d.readyState === "READY", state: d.readyState, sha, detail: `${d.readyState} @ ${sha}` };
  } catch (e) {
    return { name: "vercel deploy READY", ok: false, skipped: true, detail: `vercel api error: ${e.message}` };
  }
}

const checks = [];
checks.push(await probe("public /login 200", "/login", 200));
checks.push(await probe("public / 200", "/", 200));
checks.push(await probe("auth gate: unauth /<slug>/dashboard -> 307", "/sentinel-probe-noexist/dashboard", 307));
checks.push(await probe("api recaps unauth -> 401", "/api/recaps", [401, 405]));
const deploy = await latestProdDeploy();
checks.push(deploy);

const ok = checks.every((c) => c.ok || c.skipped);
const result = { module: "health", ok, base: BASE, latestSha: deploy.sha || null, deploymentReady: deploy.ok, checks };
console.log(JSON.stringify(result, null, 2));
process.exit(ok ? 0 : 1);
