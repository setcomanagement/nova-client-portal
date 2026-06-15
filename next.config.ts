import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native Postgres drivers out of the server bundle so they load at
  // runtime. PGlite ships a wasm payload; postgres-js opens raw sockets.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Pin the workspace root so Turbopack ignores lockfiles in parent directories.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
