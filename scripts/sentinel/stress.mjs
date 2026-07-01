/*
  nova-sentinel · stress.mjs
  Regression/stress suite on a production build. Seeds a deterministic dataset,
  builds (unless --no-build), starts next, and drives Playwright through:
    A. statistics aggregation + per-entry log + segregation + cross-client isolation
    B. cross-tenant leak probe (HTML + RSC payload)
    C. EOD->stats live flow (mutating; runs last)
    D. role/route sweep + console-error + malformed-uuid 404
  Emits aggregated JSON; exit 0 if all pass.

  Usage: node scripts/sentinel/stress.mjs [--no-build] [--port 3100]
*/
import { chromium } from "@playwright/test";
import { execSync, spawn } from "node:child_process";

const args = process.argv.slice(2);
const PORT = args.includes("--port") ? Number(args[args.indexOf("--port") + 1]) : 3100;
const BASE = `http://localhost:${PORT}`;
const NO_BUILD = args.includes("--no-build");
const log = (...a) => process.stderr.write(a.join(" ") + "\n"); // human log to stderr; JSON result to stdout

// ---- page formatters (verbatim from statistics/page.tsx) ----
const commas = (v) => Math.round(v).toLocaleString("en-US");
const money = (v) => `$${commas(v)}`;
const moneyK = (v) => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 2)}k` : `$${commas(v)}`;
const pct = (num, den) => den ? `${((num / den) * 100).toFixed(num % den === 0 ? 0 : 2)}%` : "0%";
const avg = (total, den) => den ? (total / den).toFixed(2) : "0";
const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const isoDaysAgo = (days) => { const n = new Date(); const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); };
const sinceFor = (key) => key === "all" ? "2000-01-01" : isoDaysAgo(Number(key));

function expectAgg(eods, rate) {
  const z = { outbound: 0, followUps: 0, totalConvos: 0, callsPitched: 0, callsBooked: 0, showUps: 0, closes: 0, cashCollected: 0 };
  const sum = eods.reduce((a, e) => { for (const k in z) a[k] += e[k]; return a; }, { ...z });
  const submissions = eods.length, activeDays = new Set(eods.map((e) => e.date)).size, commission = sum.cashCollected * rate;
  const scorecards = [commas(sum.callsBooked), commas(sum.callsPitched), commas(sum.totalConvos), pct(sum.callsBooked, sum.callsPitched), avg(sum.outbound, submissions), commas(sum.showUps), commas(sum.callsBooked), moneyK(commission), pct(sum.callsBooked, sum.totalConvos), avg(sum.followUps, submissions)];
  const aggregates = [pct(sum.showUps, sum.callsBooked), money(sum.cashCollected), money(sum.closes ? sum.cashCollected / sum.closes : 0), pct(sum.closes, sum.showUps), avg(sum.totalConvos, activeDays), money(commission)];
  return [...scorecards, ...aggregates];
}

async function main() {
  // 1. build
  if (!NO_BUILD) { log("[stress] building…"); execSync("pnpm build", { stdio: "ignore" }); }
  // 2. seed (wipe + deterministic dataset + tokens)
  log("[stress] seeding…");
  const data = JSON.parse(execSync("npx tsx scripts/sentinel/seed.ts", { encoding: "utf8" }).trim().split("\n").pop());
  const commBySlug = Object.fromEntries(data.clients.map((c) => [c.slug, c.commissionPct]));
  const eodsFor = (slug, key, setterId) => { const since = sinceFor(key); return data.eods.filter((e) => e.clientSlug === slug && e.date >= since && (!setterId || e.setterId === setterId)); };

  // 3. start server
  log("[stress] starting next on", PORT);
  const srv = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid); } catch {} };
  try {
    let up = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASE}/login`); if (r.status === 200) { up = true; break; } } catch {} await new Promise((r) => setTimeout(r, 1000)); }
    if (!up) throw new Error("server did not become ready");

    const browser = await chromium.launch();
    const suites = [];
    const ctx = async (token) => { const c = await browser.newContext(); await c.addCookies([{ name: "nova_session", value: token, url: BASE, httpOnly: true, secure: false, sameSite: "Lax" }]); return c; };
    const errs = [];

    // ---- A. aggregation + per-entry + segregation + isolation (super) ----
    {
      let passed = 0; const failures = [];
      const sc = await ctx(data.tokens.super); const sp = await sc.newPage();
      sp.on("console", (m) => { if (m.type() === "error" && !/404 \(Not Found\)/.test(m.text())) errs.push(`[A super] ${m.text()}`); });
      for (const c of data.clients) for (const key of ["all", "90", "30"]) {
        await sp.goto(`${BASE}/${c.slug}/statistics?range=${key}`, { waitUntil: "networkidle" });
        const nums = await sp.$$eval(".num", (els) => els.map((e) => e.textContent.trim()));
        const want = expectAgg(eodsFor(c.slug, key), commBySlug[c.slug]);
        for (let i = 0; i < 16; i++) { if (String(nums[i]) === String(want[i])) passed++; else failures.push(`${c.slug}/${key} metric[${i}] got "${nums[i]}" want "${want[i]}"`); }
      }
      // per-entry table + isolation (range all)
      for (const c of data.clients) {
        await sp.goto(`${BASE}/${c.slug}/statistics?range=all`, { waitUntil: "networkidle" });
        const rows = await sp.$$eval("table tbody tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim())));
        const eods = eodsFor(c.slug, "all").slice().sort((a, b) => b.date.localeCompare(a.date) || a.setterName.localeCompare(b.setterName));
        if (rows.length === eods.length) passed++; else failures.push(`${c.slug} entry rowcount got ${rows.length} want ${eods.length}`);
        for (let i = 0; i < eods.length; i++) { const e = eods[i]; const w = [fmtDate(e.date), e.setterName, commas(e.totalConvos), commas(e.callsPitched), commas(e.callsBooked), commas(e.showUps), commas(e.closes), money(e.cashCollected)]; if (JSON.stringify(rows[i]) === JSON.stringify(w)) passed++; else failures.push(`${c.slug} entry row ${i} mismatch`); }
        const body = await sp.locator("body").textContent();
        const foreign = data.clients.filter((o) => o.slug !== c.slug).flatMap((o) => o.setters.map((s) => s.name)).filter((nm) => body.includes(nm));
        if (foreign.length === 0) passed++; else failures.push(`${c.slug} leaked foreign setters: ${foreign.join(",")}`);
      }
      // segregation: each rep sees only self
      for (const c of data.clients) {
        const rep = data.tokens[`rep_${c.slug}`]; const rc = await ctx(rep.token); const rp = await rc.newPage();
        await rp.goto(`${BASE}/${c.slug}/statistics?range=all`, { waitUntil: "networkidle" });
        const nums = await rp.$$eval(".num", (els) => els.map((e) => e.textContent.trim()));
        const want = expectAgg(eodsFor(c.slug, "all", rep.setterId), commBySlug[c.slug]);
        let ok = true; for (let i = 0; i < 16; i++) if (String(nums[i]) !== String(want[i])) ok = false;
        const body = await rp.locator("body").textContent();
        const coworkerLeak = c.setters.filter((s) => s.id !== rep.setterId).map((s) => s.name).filter((nm) => body.includes(nm));
        if (ok && coworkerLeak.length === 0) passed++; else failures.push(`rep ${c.slug} segregation: aggOk=${ok} coworkerLeak=${coworkerLeak.join(",")}`);
        await rc.close();
      }
      await sc.close();
      suites.push({ name: "statistics-aggregation", passed, failed: failures.length, failures });
    }

    // ---- B. cross-tenant leak: Tone rep -> Akira pages ----
    {
      let passed = 0; const failures = [];
      const rc = await ctx(data.tokens.rep_tone.token); const rp = await rc.newPage();
      rp.on("console", (m) => { if (m.type() === "error" && !/404 \(Not Found\)/.test(m.text())) errs.push(`[B] ${m.text()}`); });
      for (const p of ["dashboard", "statistics", "milestones", "leads", "recaps", "calendar"]) {
        const r = await rp.goto(`${BASE}/akira/${p}`, { waitUntil: "networkidle" });
        const html = await rp.content();
        const rscRes = await fetch(`${BASE}/akira/${p}`, { headers: { Cookie: `nova_session=${data.tokens.rep_tone.token}`, RSC: "1" } });
        const rsc = await rscRes.text();
        const leak = /Akira/.test(html) || /Akira/.test(rsc);
        if (r.status() === 404 && !leak) passed++; else failures.push(`/akira/${p}: status=${r.status()} leak=${leak}`);
      }
      await rc.close();
      suites.push({ name: "cross-tenant-isolation", passed, failed: failures.length, failures });
    }

    // ---- D. role/route sweep + console errors + malformed uuid ----
    {
      let passed = 0; const failures = [];
      // super: every tone route -> no 5xx
      const sc = await ctx(data.tokens.super); const sp = await sc.newPage();
      sp.on("console", (m) => { if (m.type() === "error" && !/404 \(Not Found\)/.test(m.text())) errs.push(`[D super] ${m.text()}`); });
      for (const p of ["dashboard", "statistics", "milestones", "leads", "recaps", "modules", "integrations", "calendar", "settings"]) {
        const r = await sp.goto(`${BASE}/tone/${p}`, { waitUntil: "networkidle" });
        if (r.status() < 500) passed++; else failures.push(`super /tone/${p} -> ${r.status()}`);
      }
      // notFound() inside a page streams as HTTP 200 + the custom not-found UI, so
      // we assert on the VISIBLE not-found heading. getByText ignores the RSC flight
      // payload in <script> tags (which contains the not-found boundary on every
      // page), unlike body.textContent — so this reliably distinguishes blocked
      // pages from allowed ones.
      const nfVisible = (page) => page.getByText("Page not found").first().isVisible().catch(() => false);
      // malformed uuid -> clean not-found UI, no 5xx crash.
      const rUuid = await sp.goto(`${BASE}/tone/leads/not-a-uuid`, { waitUntil: "networkidle" });
      const uNF = await nfVisible(sp);
      if (rUuid.status() < 500 && uNF) passed++; else failures.push(`malformed uuid -> status ${rUuid.status()} notFoundVisible=${uNF}`);
      await sc.close();
      // manager: client-content/integrations are role-gated -> not-found UI visible;
      // allowed routes must NOT show the not-found UI.
      const mc = await ctx(data.tokens.tone_manager.token); const mp = await mc.newPage();
      for (const p of ["recaps", "modules", "integrations"]) {
        await mp.goto(`${BASE}/tone/${p}`, { waitUntil: "networkidle" });
        if (await nfVisible(mp)) passed++; else failures.push(`manager gated /tone/${p}: NOT blocked (not-found UI not visible)`);
      }
      for (const p of ["dashboard", "leads", "milestones"]) {
        const r = await mp.goto(`${BASE}/tone/${p}`, { waitUntil: "networkidle" });
        const nf = await nfVisible(mp);
        if (r.status() < 500 && !nf) passed++; else failures.push(`manager /tone/${p} -> status ${r.status()} notFoundVisible=${nf}`);
      }
      await mc.close();
      suites.push({ name: "role-route-sweep", passed, failed: failures.length, failures });
    }

    // ---- C. EOD->stats live flow (mutating, last) ----
    {
      let passed = 0; const failures = [];
      const today = isoDaysAgo(0);
      const sc = await ctx(data.tokens.super); const sp = await sc.newPage();
      const num0 = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;
      await sp.goto(`${BASE}/tone/statistics?range=90`, { waitUntil: "networkidle" });
      const before = num0((await sp.$$eval(".num", (e) => e.map((x) => x.textContent)))[0]);
      // submit EOD as Anthony (rep_tone)
      const rc = await ctx(data.tokens.rep_tone.token); const rp = await rc.newPage();
      await rp.goto(`${BASE}/tone/eod`, { waitUntil: "networkidle" });
      for (const [name, val] of Object.entries({ submissionDate: today, outbound: "30", totalConvos: "20", callsPitched: "8", callsBooked: "5", qualifiedBooked: "3", showUps: "3", closes: "2", revenue: "4000", cashCollected: "4000" })) { const el = rp.locator(`[name="${name}"]`); if (await el.count()) await el.first().fill(String(val)); }
      await Promise.all([rp.waitForURL(/\/tone\/rep/, { timeout: 15000 }).catch(() => {}), rp.click('button:has-text("Submit EOD")')]);
      await rp.waitForLoadState("networkidle");
      await sp.goto(`${BASE}/tone/statistics?range=90`, { waitUntil: "networkidle" });
      const after = num0((await sp.$$eval(".num", (e) => e.map((x) => x.textContent)))[0]);
      if (after - before === 5) passed++; else failures.push(`statistics booked delta ${after - before} (want 5)`);
      const anthonyRows = await sp.$$eval("table tbody tr", (trs) => trs.filter((tr) => /Anthony/.test(tr.textContent || "")).length);
      if (anthonyRows >= 1) passed++; else failures.push("no Anthony row in per-entry log after submit");
      await sp.goto(`${BASE}/tone/milestones`, { waitUntil: "networkidle" });
      const mBody = (await sp.locator("body").textContent()) || "";
      if (/Anthony/.test(mBody)) passed++; else failures.push("milestones did not show Anthony after submit");
      await sp.goto(`${BASE}/tone/dashboard`, { waitUntil: "networkidle" });
      const dBooked = await sp.evaluate(() => { const lab = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim() === "Calls booked"); return Number(lab?.parentElement?.querySelector(".num")?.textContent?.replace(/[^0-9]/g, "") || "0"); });
      if (dBooked >= 5) passed++; else failures.push(`dashboard Calls booked ${dBooked} (<5)`);
      await rc.close(); await sc.close();
      suites.push({ name: "eod-to-stats-flow", passed, failed: failures.length, failures });
    }

    await browser.close();
    const realErrs = errs;
    const ok = suites.every((s) => s.failed === 0) && realErrs.length === 0;
    const result = { module: "stress", ok, suites, consoleErrors: realErrs };
    console.log(JSON.stringify(result, null, 2));
    cleanup();
    process.exit(ok ? 0 : 1);
  } catch (e) {
    cleanup();
    console.log(JSON.stringify({ module: "stress", ok: false, error: e.message, suites: [] }, null, 2));
    process.exit(1);
  }
}
main();
