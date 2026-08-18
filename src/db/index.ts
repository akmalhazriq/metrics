import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import * as schema from "./schema";

// Fail fast if DATABASE_URL is missing — especially in production where
// the host injects it (Railway / Render / Neon). In dev, the error message
// points to .env.example.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const hint =
    process.env.NODE_ENV === "production"
      ? "DATABASE_URL is required in production. Set it in your host's environment variables dashboard."
      : "DATABASE_URL is not set. Copy .env.example to .env and set it (default: postgresql://postgres:postgres@localhost:5432/metrics_bi).";
  throw new Error(hint);
}

// Managed providers (Neon, Supabase) use ?sslmode=require in the URL and
// may need explicit ssl config. pg respects sslmode in the URL, but some
// hosts require ssl: { rejectUnauthorized: false } for pooled connections.
// Only enable when the URL signals it, so local dev stays plain.
const needsSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech") ||
  connectionString.includes("supabase.co");

const poolConfig: PoolConfig = {
  connectionString,
  // Sensible defaults for a small BI app. Hosts like Railway/Render run
  // a single Node process, so a small pool is sufficient.
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
};

const pool = new Pool(poolConfig);

// Surface pool errors instead of silently crashing. pg emits 'error' on
// idle clients that hit a network blip (common with pooled Neon/Supabase).
pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });
export { pool };
