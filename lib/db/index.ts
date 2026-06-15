import "server-only";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./url";

/*
  Pluggable database client.

  - No DATABASE_URL  -> in-process PGlite (real Postgres, persisted to ./.pglite).
                        Used for local development; no external infra required.
  - DATABASE_URL set -> postgres-js against Neon (production / deploy).

  The Drizzle schema and every query are identical across both drivers, so
  switching to Neon is a one-line env change. Both drivers expose the same
  core query builder; the postgres-js instance is structurally compatible and
  is narrowed to the shared type via `unknown` (no `any`).
*/
export const LOCAL_PGLITE_DIR = "./.pglite";

export type Database = PgliteDatabase<typeof schema>;

function createDb(): Database {
  const url = resolveDatabaseUrl();
  if (url) {
    const client = postgres(url, { prepare: false });
    return drizzlePostgres(client, { schema }) as unknown as Database;
  }
  const client = new PGlite(LOCAL_PGLITE_DIR);
  return drizzlePglite(client, { schema });
}

// Reuse a single instance across HMR reloads in development.
const globalForDb = globalThis as unknown as { __novaDb?: Database };

function getDb(): Database {
  if (!globalForDb.__novaDb) {
    globalForDb.__novaDb = createDb();
  }
  return globalForDb.__novaDb;
}

/*
  Lazily initialized: the underlying client (PGlite/postgres-js) is only created
  on the first actual query, never at module-import time. This keeps build-time
  page-data collection (which imports the module graph across many workers)
  from spinning up PGlite instances and racing on the ./.pglite directory.
*/
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
