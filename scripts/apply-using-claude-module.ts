/*
  Apply scripts/migrate-using-claude-module.sql to the target database.

    no DATABASE_URL  -> PGlite (./.pglite)  — local dry run
    DATABASE_URL set -> postgres-js (Neon)  — production

  The .sql file is the source of truth (idempotent INSERT ... WHERE NOT EXISTS);
  this runner just executes it and verifies the result. It does NOT touch the
  modules table schema or any existing rows.

  Run against prod:
    DATABASE_URL='postgres://...' pnpm tsx scripts/apply-using-claude-module.ts
*/
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { resolveMigrationUrl } from "../lib/db/url";

// Load .env.local if present (Node 20.12+/24 builtin).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — fall back to ambient env (e.g. CI / Vercel)
}

const TITLE = "Using Claude to Compound Your Operations";
const SQL_FILE = path.join(__dirname, "migrate-using-claude-module.sql");

type Row = Record<string, unknown>;
type Query = (text: string) => Promise<Row[]>;

async function run(query: Query, label: string): Promise<void> {
  console.log(`\nApplying migration to ${label}…`);
  const sqlText = readFileSync(SQL_FILE, "utf8");
  await query(sqlText);

  // --- Verify -------------------------------------------------------------
  const found = await query(
    `select id, title, category, order_index,
            jsonb_array_length(chapters) as chapters,
            (select coalesce(sum(jsonb_array_length(ch->'lessons')), 0)
               from jsonb_array_elements(chapters) ch) as lessons
       from modules where title = '${TITLE.replace(/'/g, "''")}'`,
  );

  if (found.length !== 1) {
    throw new Error(`Expected exactly 1 module named "${TITLE}", found ${found.length}`);
  }
  const m = found[0];
  console.log("Inserted/verified module:");
  console.table([
    {
      id: m.id,
      title: m.title,
      category: m.category,
      order_index: m.order_index,
      chapters: m.chapters,
      lessons: m.lessons,
    },
  ]);

  const problems: string[] = [];
  if (m.category !== "Backend Optimisation") problems.push(`category is "${m.category}", expected "Backend Optimisation"`);
  if (Number(m.chapters) !== 6) problems.push(`chapters = ${m.chapters}, expected 6`);
  if (Number(m.lessons) !== 6) problems.push(`lessons = ${m.lessons}, expected 6`);
  if (problems.length) throw new Error("Verification failed:\n  - " + problems.join("\n  - "));

  const [{ count }] = await query(`select count(*)::int as count from modules`);
  console.log(`\n✓ Verified: 6 chapters / 6 lessons, category "Backend Optimisation".`);
  console.log(`✓ modules table now holds ${count} rows.`);
}

async function main(): Promise<void> {
  const url = resolveMigrationUrl();
  if (url) {
    const sql = postgres(url, { prepare: false });
    try {
      await run((text) => sql.unsafe(text) as unknown as Promise<Row[]>, "Neon (production)");
    } finally {
      await sql.end();
    }
  } else {
    const client = new PGlite("./.pglite");
    try {
      await run(async (text) => (await client.query(text)).rows as Row[], "local PGlite (dry run)");
    } finally {
      await client.close();
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
