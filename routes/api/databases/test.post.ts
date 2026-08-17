import { defineHandler, readBody } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db, pool } from "../../../src/db";
import { databases } from "../../../src/db/schema";
import { requireAuth } from "../../../src/lib/requireAuth";

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as { databaseId?: string; id?: string; sqlalchemyUri?: string; backend?: string };
  const databaseId = (body?.databaseId ?? body?.id ?? "").trim() || null;

  let backend = (body?.backend ?? "").trim() || null;
  const resolvedId: string | null = databaseId;

  if (databaseId) {
    const [row] = await db.select().from(databases).where(eq(databases.id, databaseId));
    if (row) backend = row.backend;
  }
  if (!backend) backend = "Postgres";

  const lowerBackend = backend.toLowerCase();
  const isPostgres = lowerBackend === "postgres" || lowerBackend === "postgresql";

  if (!isPostgres) {
    return {
      ok: false,
      backend,
      databaseId: resolvedId,
      message: `Test not implemented for ${backend} — only Postgres can be probed live (SELECT 1 on the app pool). Other backends require their native driver/gateway, not yet wired.`,
    };
  }

  const start = Date.now();
  try {
    // Same pool as SQL Lab — flagged as simplification (app DB == analytics DB)
    await pool.query("SELECT 1 AS ping");
    const latencyMs = Date.now() - start;
    return { ok: true, backend, databaseId: resolvedId, latencyMs, message: `Connection to "${resolvedId ?? "app Postgres"}" succeeded — 1 row in ${latencyMs} ms` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const latencyMs = Date.now() - start;
    return { ok: false, backend, databaseId: resolvedId, latencyMs, message: `Postgres probe failed: ${msg}` };
  }
});