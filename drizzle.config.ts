import { defineConfig } from "drizzle-kit";

// Used by `drizzle-kit generate` to diff the schema into SQL migrations
// (offline; no DB connection needed). Runtime migration + seeding is handled
// by scripts/setup-db.ts so it works for both PGlite and Neon.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
