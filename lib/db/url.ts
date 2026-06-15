/*
  Resolve a Postgres connection string from the various env var names different
  hosts use. Neon's Vercel integration, for example, often leaves DATABASE_URL
  empty and populates POSTGRES_URL / *_UNPOOLED instead. Empty strings are
  treated as "not set" so we fall through to the next candidate.

  No "server-only" import here so the migration script (scripts/setup-db.ts)
  can share this with the runtime client (lib/db/index.ts).
*/
function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) if (v && v.trim()) return v;
  return undefined;
}

/** Runtime (serverless) — prefer the pooled URL. */
export function resolveDatabaseUrl(): string | undefined {
  return firstNonEmpty(
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  );
}

/** Migrations / DDL — prefer a direct (unpooled) connection. */
export function resolveMigrationUrl(): string | undefined {
  return firstNonEmpty(
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  );
}
