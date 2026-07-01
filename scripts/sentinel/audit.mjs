/*
  nova-sentinel · audit.mjs
  Static invariant checks over the repo — encodes the conventions whose breakage
  caused real bugs this project hit. No build required. JSON findings to stdout;
  exit 0 if clean, 1 if any high-severity finding.

  Usage: node scripts/sentinel/audit.mjs   (run from repo root)
*/
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const findings = [];
const add = (rule, file, line, snippet, severity, fix) =>
  findings.push({ rule, file: path.relative(ROOT, file), line, snippet: snippet.trim().slice(0, 200), severity, fix });

function walk(dir, filter, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === ".pglite") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}
const read = (f) => fs.readFileSync(f, "utf8");
const lines = (f) => read(f).split("\n");
const CLIENT_PAGES = path.join(ROOT, "app", "(client)", "[slug]");

// R1 — cross-tenant: client pages must resolve via resolveClientAccess, never getClientBySlug.
for (const f of walk(CLIENT_PAGES, (p) => p.endsWith("page.tsx"))) {
  lines(f).forEach((ln, i) => {
    if (/\bgetClientBySlug\b/.test(ln)) {
      add("tenant-isolation", f, i + 1, ln, "high",
        "Replace getClientBySlug(slug) with resolveClientAccess({slug, role: session.role, clientId: session.clientId}) + notFound() before any data fetch.");
    }
  });
}

// R2 — live refresh: EOD-writing actions must revalidatePath.
for (const rel of ["app/(client)/[slug]/eod/actions.ts", "app/(client)/[slug]/statistics/actions.ts"]) {
  const f = path.join(ROOT, rel);
  if (fs.existsSync(f) && !/revalidatePath\s*\(/.test(read(f))) {
    add("eod-revalidate", f, 0, "(file)", "high",
      "EOD-writing action does not call revalidatePath — logged EODs won't refresh dashboard/milestones/statistics. Add revalidatePath for the affected routes.");
  }
}

// R3 — uuid guard: every dynamic [id] page must guard with isUuid (Postgres uuid-cast crashes otherwise).
const idPages = walk(path.join(ROOT, "app"), (p) => /\[id\][\/\\]page\.tsx$/.test(p));
for (const f of idPages) {
  if (!/\bisUuid\s*\(/.test(read(f))) {
    add("uuid-guard", f, 0, "(file)", "high",
      "Dynamic [id] page lacks an isUuid() guard — a malformed id crashes the page via a Postgres uuid cast. Add `if (!isUuid(id)) notFound();`.");
  }
}

// R4 — secret hygiene: never log tokens/jwts/password hashes.
for (const f of walk(path.join(ROOT, "app"), (p) => /\.(ts|tsx)$/.test(p)).concat(walk(path.join(ROOT, "lib"), (p) => /\.(ts|tsx)$/.test(p)))) {
  lines(f).forEach((ln, i) => {
    if (/console\.(log|info|warn|error|debug)\s*\(/.test(ln) && /\b(token|jwt|passwordHash|password|secret|apiKey)\b/i.test(ln)) {
      add("secret-logging", f, i + 1, ln, "high", "Possible secret in a console.* call — remove it. Never log tokens, JWTs, or password hashes.");
    }
  });
}

// R5 — no raw drivers/SQL outside lib/db (informational).
for (const f of walk(path.join(ROOT, "app"), (p) => /\.(ts|tsx)$/.test(p))) {
  lines(f).forEach((ln, i) => {
    if (/from\s+["']postgres["']/.test(ln) || /drizzle\s*\(/.test(ln)) {
      add("raw-db-outside-lib", f, i + 1, ln, "info", "DB driver used outside lib/db/. Route DB access through lib/db/queries.ts.");
    }
  });
}

const high = findings.filter((f) => f.severity === "high");
const result = { module: "audit", ok: high.length === 0, counts: { high: high.length, total: findings.length }, findings };
console.log(JSON.stringify(result, null, 2));
process.exit(high.length ? 1 : 0);
