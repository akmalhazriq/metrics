/**
 * POST /api/sqllab/execute — real Postgres execution.
 *
 * Simplification (flagged): the analytics database IS the app database for this
 * pass. We look up the requested databaseId from the databases table to validate
 * it exists, but execute every query against the same pg Pool that Drizzle uses
 * (src/db/index.ts). A later phase can route to the per-database sqlalchemyUri
 * via a dedicated connection pool / gateway.
 *
 * Safety: every query runs inside a READ ONLY transaction with a statement
 * timeout and an appended LIMIT guard so a stray SELECT cannot dump the whole
 * table. DML is rejected early and also blocked by READ ONLY.
 */

import { defineHandler, getHeader, readBody, setResponseStatus } from "nitro/h3";
import { eq } from "drizzle-orm";

import { db, pool } from "../../../src/db";
import { databases, queryHistory } from "../../../src/db/schema";
import { resolveUserByToken } from "../../../src/db/auth";
import { requireAuth } from "../../../src/lib/requireAuth";

function hasLimit(sql: string): boolean {
  return /\bLIMIT\s+\d+/i.test(sql);
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "").trimEnd();
}

function looksLikeDml(sql: string): boolean {
  return /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i.test(sql);
}

export default defineHandler(async (event) => {
  await requireAuth(event);
  const body = (await readBody(event)) as {
    sql?: string;
    limit?: number;
    databaseId?: string;
    schema?: string;
  };
  const rawSql = (body?.sql ?? "").trim();
  const limit = Math.max(1, Math.min(1000, Number(body?.limit ?? 100) || 100));
  const databaseId = (body?.databaseId ?? "analytics").trim() || "analytics";
  const schemaName = (body?.schema ?? "public").trim() || "public";

  if (!rawSql) {
    setResponseStatus(event, 400);
    return { error: "SQL is required", statusCode: 400 as const };
  }

  // Validate database exists (but execute on the app pool — see header comment).
  const [dbRow] = await db.select().from(databases).where(eq(databases.id, databaseId));
  // If the id is unknown, fall back to "analytics" rather than 404 — the page
  // seeds "analytics"/"public" by default and the toast already guides the user.
  // Still track what the user asked for in query_history.
  const effectiveDatabaseId = dbRow ? databaseId : "analytics";

  if (dbRow && !dbRow.allowRunSync) {
    // Honour the per-database "Allow run sync" flag from the editor.
    setResponseStatus(event, 400);
    return { error: `Database "${effectiveDatabaseId}" does not allow synchronous execution.`, statusCode: 400 as const };
  }

  // Early DML guard with a friendly message — READ ONLY would also reject, but
  // the pg error is cryptic ("cannot execute INSERT in a read-only transaction").
  if (looksLikeDml(rawSql)) {
    const targetDb = dbRow ?? null;
    if (targetDb && !targetDb.allowDml) {
      const startDml = Date.now();
      const durationMsDml = Date.now() - startDml;
      // Persist the denied attempt as an error so history is complete.
      try {
        const token =
          (getHeader(event, "authorization") as string | undefined) ??
          (getHeader(event, "x-session-token") as string | undefined) ??
          null;
        const resolved = await resolveUserByToken(token ?? null);
        let userId: number | null = resolved?.user.id ?? null;
        if (userId == null) {
          const fallback = await db.select().from((await import("../../../src/db/schema")).users).then((r) => r[0]);
          userId = fallback?.id ?? null;
        }
        await db.insert(queryHistory).values({
          sql: rawSql,
          databaseId: effectiveDatabaseId,
          schema: schemaName,
          userId,
          status: "error",
          rows: 0,
          durationMs: durationMsDml,
          errorMessage: "DML is disabled for this database (allowDml = false).",
        });
      } catch {
        // history insert is best-effort — don't mask the primary error
      }
      setResponseStatus(event, 400);
      return { error: "DML is disabled for this database (allowDml = false).", statusCode: 400 as const };
    }
  }

  // Append LIMIT guard if the user didn't provide one — keep existing LIMIT
  // untouched so `SELECT ... LIMIT 5` stays 5, not 1000.
  const sqlWithLimit = hasLimit(rawSql) ? rawSql : `${stripTrailingSemicolon(rawSql)} LIMIT ${limit}`;

  const started = Date.now();
  const client = await pool.connect();

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let pgError: string | null = null;

  try {
    await client.query("BEGIN READ ONLY");
    // 10 s statement timeout per query — prevents a single Run from hanging.
    await client.query("SET LOCAL statement_timeout = '10000'");
    const result = await client.query(sqlWithLimit);
    columns = result.fields.map((f) => f.name);
    // pg returns rows as objects with string keys; keep them as-is for the page.
    rows = result.rows as Record<string, unknown>[];
    await client.query("COMMIT");
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Surface the raw Postgres error (e.g. `relation "nonexistent_table" does not exist`)
    // so the self-healing AI can offer a diff and the user sees what to fix.
    pgError = msg;
  } finally {
    client.release();
  }

  const durationMs = Date.now() - started;

  // Resolve user for history — Bearer or x-session-token, fallback to first user.
  let historyUserId: number | null = null;
  try {
    const token =
      (getHeader(event, "authorization") as string | undefined) ??
      (getHeader(event, "x-session-token") as string | undefined) ??
      null;
    const resolved = await resolveUserByToken(token ?? null);
    historyUserId = resolved?.user.id ?? null;
    if (historyUserId == null) {
      const { users } = await import("../../../src/db/schema");
      const [fallback] = await db.select().from(users).limit(1);
      historyUserId = fallback?.id ?? null;
    }
  } catch {
    // keep null — query_history.userId is nullable
  }

  if (pgError) {
    // Persist the failed run before returning the error shape the page handles.
    try {
      await db.insert(queryHistory).values({
        sql: rawSql,
        databaseId: effectiveDatabaseId,
        schema: schemaName,
        userId: historyUserId,
        status: "error",
        rows: 0,
        durationMs,
        errorMessage: pgError,
      });
    } catch {
      // best-effort
    }
    setResponseStatus(event, 400);
    return { error: pgError, statusCode: 400 as const };
  }

  // Persist success
  try {
    await db.insert(queryHistory).values({
      sql: rawSql,
      databaseId: effectiveDatabaseId,
      schema: schemaName,
      userId: historyUserId,
      status: "success",
      rows: rows.length,
      durationMs,
      errorMessage: null,
    });
  } catch {
    // best-effort — still return the result
  }

  // Normalise rows to string|number for the QueryResult type (pg may return
  // Dates, booleans, etc — stringify for the table grid which calls String()).
  const normalised = rows.map((r) => {
    const out: Record<string, string | number> = {};
    for (const c of columns) {
      const v = (r as Record<string, unknown>)[c];
      if (typeof v === "string" || typeof v === "number") out[c] = v;
      else if (v == null) out[c] = "";
      else if (v instanceof Date) out[c] = v.toISOString();
      else out[c] = String(v);
    }
    return out;
  });

  return {
    columns,
    rows: normalised,
    rowCount: normalised.length,
    durationMs,
  };
});